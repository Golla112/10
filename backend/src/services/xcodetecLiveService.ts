import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import { BetStackEvent } from './betStackService';

const XCODE_API_BASE = process.env.XCODETEC_API_BASE ?? 'https://api.xcodetec.com/api';
const LIVE_SOCKET_URL =
  process.env.XCODETEC_LIVETRACKER_WS ??
  'wss://livetracker.live/socket.io/?EIO=3&transport=websocket';

const ORIGIN = process.env.XCODETEC_ORIGIN ?? 'https://www.betsport.one';
const REFERER = process.env.XCODETEC_REFERER ?? 'https://www.betsport.one/';
const LANGUAGE = process.env.XCODETEC_LANGUAGE ?? 'it-IT';
const TIMEZONE = process.env.XCODETEC_TIMEZONE ?? 'Europe/Rome';

const SESSION_TOKEN = process.env.XCODETEC_LIVETRACKER_SESSION ?? '';

// Rate limiting state
let lastRequestTime = 0;
let consecutiveErrors = 0;
const MIN_REQUEST_INTERVAL_MS = 2000; // 2 seconds between requests
const MAX_CONSECUTIVE_ERRORS = 5;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 60000; // Max 1 minute backoff

const HTTP_HEADERS = {
  Accept: 'application/json',
  Origin: ORIGIN,
  Referer: REFERER,
  'Skin-Language': LANGUAGE,
  'Skin-TZ': TIMEZONE,
  Authorization: process.env.XCODETEC_BEARER_TOKEN
    ? `Bearer ${process.env.XCODETEC_BEARER_TOKEN}`
    : 'Bearer null',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

type GenericRecord = Record<string, unknown>;

interface PatchOp {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: unknown;
}

interface LiveSocketEnvelope {
  event?: string;
  channel?: string;
  data?: unknown;
}

interface MarketOutcomeState {
  id: string;
  value: number;
  locked?: boolean;
  spread?: string;
}

interface MarketState {
  marketId: string;
  outcomes: Map<string, MarketOutcomeState>;
}

interface XcLiveEventCore {
  id: string;
  home: string;
  away: string;
  league: string;
  sportCategory: string;
  startTs: number;
  minute?: number | null;
  scoreHome?: number | null;
  scoreAway?: number | null;
}

interface ListenerPayload {
  events: BetStackEvent[];
  changedEventIds: string[];
}

const eventCoreById = new Map<string, XcLiveEventCore>();
const eventMarketsById = new Map<string, Map<string, MarketState>>();

const outcomeLabelById = new Map<string, string>();
const marketLabelById = new Map<string, string>();

const joinedEvents = new Set<string>();
const listeners = new Set<(payload: ListenerPayload) => void>();

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let bootstrapped = false;

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function normalizeSportCategory(rawSport: unknown, rawSportTitle: unknown): string {
  const key = safeString(rawSport).toLowerCase();
  const title = safeString(rawSportTitle).toLowerCase();
  const candidate = key || title;
  if (!candidate) return 'soccer';
  if (candidate.includes('basket')) return 'basketball';
  if (candidate.includes('tennis')) return 'tennis';
  if (candidate.includes('hockey')) return 'hockey';
  if (candidate.includes('volley')) return 'volleyball';
  if (candidate.includes('football') || candidate.includes('soccer')) return 'soccer';
  return candidate.replace(/\s+/g, '_');
}

function parseTs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === 'string' && value) {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) {
      return asNum > 10_000_000_000 ? Math.floor(asNum / 1000) : asNum;
    }
    const dt = new Date(value).getTime();
    if (Number.isFinite(dt)) return Math.floor(dt / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function guessOutcomeName(
  event: XcLiveEventCore,
  outcomes: MarketOutcomeState[],
  idx: number,
  state: MarketOutcomeState
): string {
  const explicit = outcomeLabelById.get(state.id);
  if (explicit) return explicit;
  if (outcomes.length === 2) return idx === 0 ? event.home : event.away;
  if (outcomes.length === 3) {
    if (idx === 0) return event.home;
    if (idx === 1) return 'Draw';
    return event.away;
  }
  return `Outcome ${idx + 1}`;
}

function toBetStackEvent(eventId: string): BetStackEvent | null {
  const core = eventCoreById.get(eventId);
  if (!core) return null;

  const marketsForEvent = eventMarketsById.get(eventId);
  const markets = [];
  if (marketsForEvent) {
    for (const marketState of marketsForEvent.values()) {
      const outcomes = Array.from(marketState.outcomes.values())
        .filter((o) => o.value > 1)
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((o, idx, arr) => ({
          name: guessOutcomeName(core, arr, idx, o),
          price: o.value,
          ...(o.spread ? { point: Number(o.spread) || undefined } : {}),
        }));

      if (outcomes.length > 0) {
        markets.push({
          key: marketLabelById.get(marketState.marketId) ?? `xc_market_${marketState.marketId}`,
          outcomes,
        });
      }
    }
  }

  return {
    id: `xc_live_${eventId}`,
    home: { name: core.home },
    away: { name: core.away },
    time: core.startTs,
    sport_id: `xc_live_${core.sportCategory}`,
    sport_category: core.sportCategory,
    league: { name: core.league || 'Live' },
    live: true,
    minute: core.minute ?? null,
    score:
      core.scoreHome != null || core.scoreAway != null
        ? { home: core.scoreHome ?? null, away: core.scoreAway ?? null }
        : undefined,
    bookmakers: markets.length
      ? [{ key: 'xcodetec_live', title: 'xcodetec live', markets }]
      : [],
  };
}

function emit(changedEventIds: string[]): void {
  if (listeners.size === 0) return;
  const events = getXcodetecLiveEvents();
  for (const cb of listeners) {
    try {
      cb({ events, changedEventIds });
    } catch {
      // ignore listener errors
    }
  }
}

function ensureMarket(eventId: string, marketId: string): MarketState {
  let eventMap = eventMarketsById.get(eventId);
  if (!eventMap) {
    eventMap = new Map<string, MarketState>();
    eventMarketsById.set(eventId, eventMap);
  }
  let market = eventMap.get(marketId);
  if (!market) {
    market = {
      marketId,
      outcomes: new Map<string, MarketOutcomeState>(),
    };
    eventMap.set(marketId, market);
  }
  return market;
}

function applyPatchOp(op: PatchOp): string | null {
  const parts = op.path.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const eventId = parts[0];
  const marketId = parts[1];
  const market = ensureMarket(eventId, marketId);

  const oddId = parts[parts.length - 2] === 'value' ? parts[parts.length - 3] : parts[parts.length - 1];
  const spreadCandidate = parts.length >= 5 ? parts[3] : '';

  if (!oddId) return eventId;

  if (op.op === 'remove') {
    market.outcomes.delete(oddId);
    return eventId;
  }

  if (op.op === 'add' || op.op === 'replace') {
    if (typeof op.value === 'object' && op.value !== null && !Array.isArray(op.value)) {
      const valueObj = op.value as GenericRecord;
      if (safeNumber(valueObj.value) != null) {
        market.outcomes.set(oddId, {
          id: oddId,
          value: safeNumber(valueObj.value) ?? 0,
          spread: spreadCandidate,
        });
      } else {
        for (const [nestedOddId, nestedVal] of Object.entries(valueObj)) {
          const nestedObj = nestedVal as GenericRecord;
          const parsedValue = safeNumber(nestedObj?.value);
          if (parsedValue != null) {
            market.outcomes.set(nestedOddId, {
              id: nestedOddId,
              value: parsedValue,
              spread: spreadCandidate,
            });
          }
        }
      }
      return eventId;
    }

    const directValue = safeNumber(op.value);
    if (directValue != null) {
      market.outcomes.set(oddId, {
        id: oddId,
        value: directValue,
        spread: spreadCandidate,
      });
      return eventId;
    }
  }

  return eventId;
}

function handleMarketUpdateEnvelope(envelope: LiveSocketEnvelope): void {
  if (!envelope || envelope.event !== 'live.markets.update') return;

  const rawData = envelope.data;
  const parsed =
    typeof rawData === 'string'
      ? (JSON.parse(rawData) as GenericRecord)
      : (rawData as GenericRecord);

  const updates = Array.isArray(parsed?.update) ? (parsed.update as PatchOp[]) : [];
  if (updates.length === 0) return;

  const changed = new Set<string>();
  for (const op of updates) {
    const changedEvent = applyPatchOp(op);
    if (changedEvent) changed.add(changedEvent);
  }

  if (changed.size > 0) emit(Array.from(changed));
}

function handleEventData(payload: GenericRecord): void {
  const rawEventId = safeString(payload.event_id ?? payload.tracker_id ?? payload.id);
  if (!rawEventId) return;

  const core: XcLiveEventCore = {
    id: rawEventId,
    home: safeString(payload.home_team) || safeString(payload.home) || 'Home',
    away: safeString(payload.away_team) || safeString(payload.away) || 'Away',
    league:
      safeString(payload.tournament_title) ||
      safeString(payload.league_title) ||
      safeString(payload.category_title) ||
      'Live',
    sportCategory: normalizeSportCategory(payload.sport_key, payload.sport_title),
    startTs: parseTs(payload.start_date),
  };

  eventCoreById.set(rawEventId, core);
  emit([rawEventId]);

  if (ws && ws.readyState === WebSocket.OPEN && !joinedEvents.has(rawEventId)) {
    joinedEvents.add(rawEventId);
    ws.send(`42["join",${rawEventId},"it"]`);
  }
}

function parseSocketMessage(raw: string): void {
  if (!raw) return;
  if (raw === '2') {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send('3');
    return;
  }
  if (raw.startsWith('42')) {
    const payload = raw.slice(2);
    try {
      const decoded = JSON.parse(payload) as unknown[];
      if (!Array.isArray(decoded) || decoded.length === 0) return;
      const eventName = decoded[0];
      const eventPayload = decoded[1];

      if (eventName === 'event-data' && typeof eventPayload === 'object' && eventPayload) {
        handleEventData(eventPayload as GenericRecord);
        return;
      }
      if (
        eventName === 'live.markets.update' &&
        typeof eventPayload === 'object' &&
        eventPayload
      ) {
        handleMarketUpdateEnvelope({
          event: 'live.markets.update',
          data: (eventPayload as GenericRecord).data ?? eventPayload,
        });
        return;
      }
      if (
        typeof eventPayload === 'object' &&
        eventPayload &&
        (eventPayload as GenericRecord).event
      ) {
        handleMarketUpdateEnvelope(eventPayload as LiveSocketEnvelope);
      }
      return;
    } catch {
      return;
    }
  }

  const firstBrace = raw.indexOf('{');
  if (firstBrace >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(firstBrace)) as GenericRecord;
      if (parsed.event) handleMarketUpdateEnvelope(parsed as LiveSocketEnvelope);
    } catch {
      // ignore parse errors
    }
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (started) connectSocket();
  }, 5000);
}

function connectSocket(): void {
  if (ws) {
    try {
      ws.terminate();
    } catch {
      // noop
    }
    ws = null;
  }

  ws = new WebSocket(LIVE_SOCKET_URL, {
    headers: {
      Origin: ORIGIN,
      Referer: REFERER,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    },
  });

  ws.on('open', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send('40');
    if (SESSION_TOKEN) {
      const clientId = randomUUID();
      ws.send(`42["session-id","${SESSION_TOKEN}","${clientId}"]`);
    }
  });

  ws.on('message', (message) => {
    parseSocketMessage(message.toString());
  });

  ws.on('close', () => {
    scheduleReconnect();
  });

  ws.on('error', () => {
    scheduleReconnect();
  });
}

function collectNestedObjects(value: unknown, sink: GenericRecord[]): void {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectNestedObjects(item, sink);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as GenericRecord;
    sink.push(obj);
    for (const nested of Object.values(obj)) {
      collectNestedObjects(nested, sink);
    }
  }
}

async function loadMarketConfig(): Promise<void> {
  try {
    const res = await fetch(`${XCODE_API_BASE}/sport/config`, {
      headers: HTTP_HEADERS,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return;

    const raw = (await res.json()) as GenericRecord;
    const allObjects: GenericRecord[] = [];
    collectNestedObjects(raw, allObjects);

    for (const obj of allObjects) {
      const marketId = safeString(obj.id);
      const marketName = safeString(obj.name || obj.label || obj.key);
      if (marketId && marketName) marketLabelById.set(marketId, marketName);

      if (Array.isArray(obj.odds)) {
        for (const odd of obj.odds as GenericRecord[]) {
          const oddId = safeString(odd.id);
          const oddName = safeString(odd.name || odd.label || odd.key);
          if (oddId && oddName) outcomeLabelById.set(oddId, oddName);
        }
      }
    }
  } catch {
    // ignore config errors
  }
}

function mapSnapshotEvent(raw: GenericRecord): XcLiveEventCore | null {
  const rawId = safeString(raw.event_id ?? raw.id ?? raw.tracker_id);
  if (!rawId) return null;
  return {
    id: rawId,
    home: safeString(raw.home_team || raw.home) || 'Home',
    away: safeString(raw.away_team || raw.away) || 'Away',
    league:
      safeString(raw.tournament_title) ||
      safeString(raw.league_title) ||
      safeString(raw.category_title) ||
      'Live',
    sportCategory: normalizeSportCategory(raw.sport_key, raw.sport_title),
    startTs: parseTs(raw.start_date),
    minute: safeNumber(raw.live_minute) ?? null,
    scoreHome: safeNumber(raw.home_score),
    scoreAway: safeNumber(raw.away_score),
  };
}

// Persistent cache for live events (survives rate limit errors)
let persistentEventCache: Map<string, XcLiveEventCore> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function rateLimitedFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
  const now = Date.now();

  // Calculate backoff delay based on consecutive errors
  let backoffDelay = 0;
  if (consecutiveErrors > 0) {
    backoffDelay = Math.min(
      MIN_REQUEST_INTERVAL_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveErrors - 1),
      MAX_BACKOFF_MS
    );
  }

  // Ensure minimum interval between requests
  const timeSinceLastRequest = now - lastRequestTime;
  const waitTime = Math.max(0, backoffDelay - timeSinceLastRequest);

  if (waitTime > 0) {
    console.log(`[xcodetec] Rate limit: waiting ${waitTime}ms before request`);
    await new Promise(r => setTimeout(r, waitTime));
  }

  lastRequestTime = Date.now();

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...HTTP_HEADERS, ...(options.headers || {}) },
      signal: options.signal || AbortSignal.timeout(12_000),
    });

    // Handle rate limit
    if (res.status === 429) {
      consecutiveErrors++;
      console.log(`[xcodetec] HTTP 429 received, consecutive errors: ${consecutiveErrors}`);
      return null;
    }

    // Reset consecutive errors on success
    if (res.ok) {
      consecutiveErrors = 0;
    }

    return res;
  } catch (err) {
    consecutiveErrors++;
    console.log(`[xcodetec] Fetch error: ${err}, consecutive errors: ${consecutiveErrors}`);
    return null;
  }
}

export async function bootstrapXcodetecLiveFromSnapshot(): Promise<void> {
  if (bootstrapped) {
    // Try to refresh even if already bootstrapped
    return refreshLiveSnapshot();
  }
  bootstrapped = true;

  await loadMarketConfig();
  await refreshLiveSnapshot();
}

async function refreshLiveSnapshot(): Promise<void> {
  // Check if we should use cached data due to rate limiting
  const now = Date.now();
  const cacheAge = now - cacheTimestamp;

  // If we have recent cache and are being rate limited, use cache
  if (persistentEventCache.size > 0 && cacheAge < CACHE_TTL_MS && consecutiveErrors > 0) {
    console.log(`[xcodetec] Using cached live events (${persistentEventCache.size} events, age: ${Math.round(cacheAge/1000)}s)`);
    // Restore from cache
    for (const [id, core] of persistentEventCache) {
      eventCoreById.set(id, core);
    }
    emit(Array.from(eventCoreById.keys()));
    return;
  }

  const res = await rateLimitedFetch(`${XCODE_API_BASE}/live/snapshot`);
  if (!res) {
    // On failure, try to use cache
    if (persistentEventCache.size > 0 && cacheAge < CACHE_TTL_MS) {
      console.log(`[xcodetec] Snapshot failed, using cached ${persistentEventCache.size} events`);
      for (const [id, core] of persistentEventCache) {
        eventCoreById.set(id, core);
      }
      emit(Array.from(eventCoreById.keys()));
    }
    return;
  }

  try {
    const raw = (await res.json()) as GenericRecord;
    const data = (raw.data ?? {}) as GenericRecord;

    const candidates: GenericRecord[] = [];
    const directEvents = data.events;
    if (Array.isArray(directEvents)) {
      for (const e of directEvents) {
        if (typeof e === 'object' && e) candidates.push(e as GenericRecord);
      }
    }

    const flattened: GenericRecord[] = [];
    collectNestedObjects(data, flattened);
    for (const obj of flattened) {
      if ((obj.home_team || obj.away_team) && (obj.event_id || obj.id || obj.tracker_id)) {
        candidates.push(obj);
      }
    }

    // Clear and repopulate
    eventCoreById.clear();
    persistentEventCache.clear();

    for (const candidate of candidates) {
      const mapped = mapSnapshotEvent(candidate);
      if (!mapped) continue;
      eventCoreById.set(mapped.id, mapped);
      persistentEventCache.set(mapped.id, mapped);
    }

    cacheTimestamp = Date.now();
    console.log(`[xcodetec] Snapshot loaded: ${eventCoreById.size} live events`);
    emit(Array.from(eventCoreById.keys()));
  } catch (err) {
    console.log(`[xcodetec] Parse error: ${err}`);
    // On parse error, try to use cache
    if (persistentEventCache.size > 0 && cacheAge < CACHE_TTL_MS) {
      for (const [id, core] of persistentEventCache) {
        eventCoreById.set(id, core);
      }
      emit(Array.from(eventCoreById.keys()));
    }
  }
}

export function getXcodetecLiveEvents(): BetStackEvent[] {
  const result: BetStackEvent[] = [];
  for (const eventId of eventCoreById.keys()) {
    const mapped = toBetStackEvent(eventId);
    if (mapped) result.push(mapped);
  }
  return result.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

export function onXcodetecLiveUpdate(
  listener: (payload: ListenerPayload) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startXcodetecLiveFeed(): void {
  if (started) return;
  started = true;
  bootstrapXcodetecLiveFromSnapshot().catch(() => {});
  connectSocket();
}

export function stopXcodetecLiveFeed(): void {
  started = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try {
      ws.close();
    } catch {
      // noop
    }
    ws = null;
  }
}

