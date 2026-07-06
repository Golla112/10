// Chiamate xcodetec via proxy backend (Next.js rewrite → /xcodetec/proxy/*)
const XCODE_API_BASE = '/api/xcodetec';
const LIVE_SOCKET_URL = 'wss://livetracker.live/socket.io/?EIO=3&transport=websocket';

type GenericRecord = Record<string, unknown>;

interface XcLiveEvent {
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

interface MarketOutcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  outcomes: MarketOutcome[];
}

interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface LiveEvent {
  id: string;
  home: { name: string };
  away: { name: string };
  time: number;
  live: true;
  sport_category: string;
  league: { name: string };
  minute?: number | null;
  score?: { home: number | null; away: number | null };
  bookmakers: Bookmaker[];
}

// Fetch live snapshot from xcodetec directly
export async function fetchXcodetecLiveSnapshot(): Promise<LiveEvent[]> {
  try {
    const res = await fetch(`${XCODE_API_BASE}/live/snapshot`);
    if (!res.ok) {
      console.log('[xcodetec-direct] HTTP', res.status);
      return [];
    }
    const raw = (await res.json()) as GenericRecord;
    const data = (raw.data ?? {}) as GenericRecord;

    const events: LiveEvent[] = [];

    // Try to find events in the response
    const candidates: GenericRecord[] = [];

    // Check direct events array
    const directEvents = data.events;
    if (Array.isArray(directEvents)) {
      for (const e of directEvents) {
        if (typeof e === 'object' && e) candidates.push(e as GenericRecord);
      }
    }

    // Flatten nested objects
    const flattened: GenericRecord[] = [];
    collectNestedObjects(data, flattened);
    for (const obj of flattened) {
      if ((obj.home_team || obj.home) && (obj.event_id || obj.id || obj.tracker_id)) {
        candidates.push(obj);
      }
    }

    for (const candidate of candidates) {
      const event = mapToLiveEvent(candidate);
      if (event) events.push(event);
    }

    console.log(`[xcodetec-direct] Loaded ${events.length} live events`);
    return events;
  } catch (err) {
    console.error('[xcodetec-direct] Error:', err);
    return [];
  }
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

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
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

function mapToLiveEvent(raw: GenericRecord): LiveEvent | null {
  const rawId = safeString(raw.event_id ?? raw.id ?? raw.tracker_id);
  if (!rawId) return null;

  const home = safeString(raw.home_team ?? raw.home) || 'Home';
  const away = safeString(raw.away_team ?? raw.away) || 'Away';
  const league = safeString(raw.tournament_title ?? raw.league_title ?? raw.category_title ?? raw.league) || 'Live';
  const sportCategory = normalizeSportCategory(raw.sport_key, raw.sport_title);
  const startTs = parseTs(raw.start_date ?? raw.startTs);
  const minute = safeNumber(raw.live_minute ?? raw.minute);
  const scoreHome = safeNumber(raw.home_score ?? raw.scoreHome);
  const scoreAway = safeNumber(raw.away_score ?? raw.scoreAway);

  // Build markets from available odds data
  const markets: Market[] = [];

  // Try to extract h2h odds if available
  const oddsData = raw.odds ?? raw.markets;
  if (Array.isArray(oddsData)) {
    for (const market of oddsData) {
      if (typeof market !== 'object' || !market) continue;
      const outcomes: MarketOutcome[] = [];
      const marketOutcomes = market.outcomes ?? market.odds;
      if (Array.isArray(marketOutcomes)) {
        for (const o of marketOutcomes) {
          if (typeof o === 'object' && o) {
            const name = safeString(o.name ?? o.label);
            const price = safeNumber(o.value ?? o.price ?? o.odds);
            if (name && price && price > 1) {
              outcomes.push({ name, price });
            }
          }
        }
      }
      if (outcomes.length > 0) {
        markets.push({
          key: safeString(market.key ?? market.market_key ?? 'h2h'),
          outcomes
        });
      }
    }
  }

  // Default h2h market if no odds found
  if (markets.length === 0) {
    markets.push({
      key: 'h2h',
      outcomes: [
        { name: home, price: 1.85 },
        { name: 'Draw', price: 3.4 },
        { name: away, price: 1.85 }
      ]
    });
  }

  const bookmakers: Bookmaker[] = markets.length > 0
    ? [{ key: 'xcodetec', title: 'Xcodetec', markets }]
    : [];

  return {
    id: `xc_live_${rawId}`,
    home: { name: home },
    away: { name: away },
    time: startTs,
    live: true,
    sport_category: sportCategory,
    league: { name: league },
    minute,
    score: scoreHome != null || scoreAway != null
      ? { home: scoreHome, away: scoreAway }
      : undefined,
    bookmakers
  };
}

// WebSocket connection for real-time updates
export function connectXcodetecLiveWebSocket(
  onUpdate: (events: LiveEvent[]) => void
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let joinedEvents = new Set<string>();
  let stopped = false;
  let reconnectAttempts = 0;

  function connect() {
    if (stopped) return;
    ws = new WebSocket(LIVE_SOCKET_URL);

    ws.onopen = () => {
      console.log('[xcodetec-ws] Connected');
      joinedEvents.clear();
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      const message = event.data as string;
      if (!message) return;

      // Socket.io protocol handling
      if (message === '2') {
        // Ping - respond with pong
        ws?.send('3');
        return;
      }

      if (message.startsWith('42')) {
        try {
          const payload = JSON.parse(message.slice(2)) as unknown[];
          if (!Array.isArray(payload) || payload.length === 0) return;

          const eventName = payload[0] as string;
          const eventData = payload[1] as GenericRecord;

          // Handle event-data for live events
          if (eventName === 'event-data' && typeof eventData === 'object') {
            const rawEventId = safeString(eventData.event_id ?? eventData.tracker_id ?? eventData.id);
            if (rawEventId && !joinedEvents.has(rawEventId)) {
              joinedEvents.add(rawEventId);
              // Join the event channel for updates
              ws?.send(`42["join",${rawEventId},"it"]`);
            }
          }

          // Handle market updates
          if (eventName === 'live.markets.update') {
            // Trigger a refresh to get latest data
            fetchXcodetecLiveSnapshot().then(onUpdate);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    ws.onclose = () => {
      if (stopped) return;
      console.log('[xcodetec-ws] Disconnected, reconnecting...');
      scheduleReconnect();
    };

    ws.onerror = () => {
      if (!stopped) ws?.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer || stopped) return;
    reconnectAttempts += 1;
    const delay = Math.min(30000, 2000 * reconnectAttempts);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  connect();

  // Initial fetch
  fetchXcodetecLiveSnapshot().then(onUpdate);

  // Return cleanup function
  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
    ws = null;
  };
}
