/**
 * xcodetecLiveClient — Client live che usa la struttura originale xcodetec
 *
 * Replica il pattern del sito di riferimento:
 * - Carica snapshot completo (palimpsest + config_markets + events + quotes)
 * - Applica JSON Patch per aggiornamenti incrementali
 * - Espone config mercati con spread, group_id, odds labels
 */

// ── JSON Patch minimale (RFC 6902) senza dipendenze esterne ──────────────────

type PatchOp = { op: 'add' | 'replace' | 'remove'; path: string; value?: unknown };

function applyPatch<T>(doc: T, ops: PatchOp[]): T {
  let result: unknown = JSON.parse(JSON.stringify(doc));
  for (const op of ops) {
    const parts = op.path.split('/').filter(Boolean);
    if (parts.length === 0) { if (op.op !== 'remove') result = op.value; continue; }
    let obj: unknown = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj == null || typeof obj !== 'object') break;
      obj = (obj as Record<string, unknown>)[parts[i]];
    }
    if (obj == null || typeof obj !== 'object') continue;
    const key = parts[parts.length - 1];
    if (op.op === 'remove') delete (obj as Record<string, unknown>)[key];
    else (obj as Record<string, unknown>)[key] = op.value;
  }
  return result as T;
}

// ── Tipi (specchio di XcLiveSnapshot backend) ─────────────────────────────────

export interface XcPalimpsestItem {
  id: number;
  label: string;
  icon: string;
  order: number;
  type: string;
  sport_id?: number;
  category_id?: number;
  widget?: boolean;
}

export interface XcMarketOddConfig {
  id: number;
  label: string;
  order: number;
}

export interface XcMarketConfig {
  id: number;
  label: string;
  sport_id: number;
  group_id: number;
  main: boolean;
  order: number;
  spread: boolean;
  spread_type?: string;
  spread_default?: string;
  player?: boolean;
  odds: XcMarketOddConfig[];
}

export interface XcGroupConfig {
  id: number;
  label: string;
  hint?: string;
  main: boolean;
  sport_id: number;
}

export interface XcLiveOdd {
  id: number;
  locked: boolean;
  code: string;
  unique: string;
  value?: number;
  extra?: string;
}

export interface XcLiveMarket {
  id: number;
  odds: Record<string, XcLiveOdd>;
  extra?: string; // spread value
}

export interface XcLiveEvent {
  id: number;
  home: string;
  away: string;
  label?: string;
  short?: number;
  phase?: string;
  score?: string;
  time?: string;
  timer?: string;
  begin: number;
  sport_id: number;
  category_id: number;
  tournament_id: number;
  started?: boolean;
  stream_id?: number;
}

export interface XcLiveSnapshot {
  config_palimpsest: {
    sports: Record<string, XcPalimpsestItem>;
    categories: Record<string, XcPalimpsestItem>;
    tournaments: Record<string, XcPalimpsestItem>;
  };
  config_markets: {
    markets: Record<string, XcMarketConfig>;
  };
  events_labels: Record<string, XcLiveEvent>;
  events_markets: Record<string, Record<string, XcLiveMarket>>;
}

export interface XcSportConfig {
  marketgroups: XcGroupConfig[];
  markets: XcMarketConfig[];
}

// ── Stato interno ─────────────────────────────────────────────────────────────

let snapshot: XcLiveSnapshot | null = null;
let sportConfig: XcSportConfig | null = null;
let snapshotListeners: Array<(s: XcLiveSnapshot) => void> = [];
let configListeners: Array<(c: XcSportConfig) => void> = [];

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ── Snapshot live ─────────────────────────────────────────────────────────────

export async function loadLiveSnapshot(): Promise<XcLiveSnapshot | null> {
  const data = await apiFetch<XcLiveSnapshot>('/xcodetec/live/snapshot');
  if (!data) return snapshot;
  snapshot = data;
  snapshotListeners.forEach(cb => cb(snapshot!));
  return snapshot;
}

export function applySnapshotPatch(patches: {
  palimpsest?: PatchOp[];
  markets?: PatchOp[];
  events?: PatchOp[];
  mainMarkets?: PatchOp[];
}): void {
  if (!snapshot) return;

  if (patches.palimpsest?.length) {
    snapshot.config_palimpsest = applyPatch(snapshot.config_palimpsest, patches.palimpsest);
  }
  if (patches.markets?.length) {
    snapshot.config_markets = applyPatch(snapshot.config_markets, patches.markets);
  }
  if (patches.events?.length) {
    snapshot.events_labels = applyPatch(snapshot.events_labels ?? {}, patches.events);
  }
  if (patches.mainMarkets?.length) {
    snapshot.events_markets = applyPatch(snapshot.events_markets ?? {}, patches.mainMarkets);
  }

  snapshotListeners.forEach(cb => cb(snapshot!));
}

export function onSnapshotUpdate(cb: (s: XcLiveSnapshot) => void): () => void {
  snapshotListeners.push(cb);
  if (snapshot) cb(snapshot);
  return () => { snapshotListeners = snapshotListeners.filter(l => l !== cb); };
}

// ── Sport config ──────────────────────────────────────────────────────────────

export async function loadSportConfig(): Promise<XcSportConfig | null> {
  const data = await apiFetch<XcSportConfig>('/xcodetec/sport/config');
  if (!data) return sportConfig;
  sportConfig = data;
  configListeners.forEach(cb => cb(sportConfig!));
  return sportConfig;
}

export function onConfigUpdate(cb: (c: XcSportConfig) => void): () => void {
  configListeners.push(cb);
  if (sportConfig) cb(sportConfig);
  return () => { configListeners = configListeners.filter(l => l !== cb); };
}

export function getSportConfig(): XcSportConfig | null {
  return sportConfig;
}

// ── Mercati evento live ───────────────────────────────────────────────────────

export async function loadEventMarkets(eventId: string): Promise<Record<string, XcLiveMarket> | null> {
  return apiFetch<Record<string, XcLiveMarket>>(`/xcodetec/live/event/${eventId}`);
}

// ── Utility: componi mercati evento con config ────────────────────────────────

export interface ComposedMarket {
  id: number;
  label: string;
  group_id: number;
  groupLabel: string;
  main: boolean;
  spread: boolean;
  spread_type?: string;
  odds: Array<{
    id: number;
    label: string;
    value: number;
    locked: boolean;
    code: string;
    unique: string;
    spread?: string;
  }>;
}

/**
 * Compone i mercati di un evento live unendo le quote reali con la config dei mercati.
 * Equivalente a returnFullMarketDetails() del sito di riferimento.
 */
export function composeEventMarkets(
  eventId: string,
  marketsData?: Record<string, XcLiveMarket>
): ComposedMarket[] {
  const config = sportConfig;
  const snap = snapshot;
  if (!config) return [];

  const rawMarkets = marketsData ?? snap?.events_markets?.[eventId] ?? {};
  const result: ComposedMarket[] = [];

  for (const [marketId, market] of Object.entries(rawMarkets)) {
    const cfg = config.markets.find(m => m.id === Number(marketId));
    if (!cfg) continue;

    const group = config.marketgroups.find(g => g.id === cfg.group_id);

    const odds = cfg.odds.map(oddCfg => {
      const liveOdd = Object.values(market.odds).find(o => o.id === oddCfg.id);
      return {
        id: oddCfg.id,
        label: oddCfg.label,
        value: liveOdd?.value ?? 0,
        locked: liveOdd?.locked ?? true,
        code: liveOdd?.code ?? '',
        unique: liveOdd?.unique ?? '',
        spread: market.extra,
      };
    }).filter(o => o.value > 1 || o.locked);

    if (odds.length === 0) continue;

    result.push({
      id: cfg.id,
      label: cfg.label,
      group_id: cfg.group_id,
      groupLabel: group?.label ?? '',
      main: cfg.main,
      spread: cfg.spread,
      spread_type: cfg.spread_type,
      odds,
    });
  }

  // Ordina: main prima, poi per order
  return result.sort((a, b) => {
    if (a.main && !b.main) return -1;
    if (!a.main && b.main) return 1;
    const cfgA = config.markets.find(m => m.id === a.id);
    const cfgB = config.markets.find(m => m.id === b.id);
    return (cfgA?.order ?? 0) - (cfgB?.order ?? 0);
  });
}

/**
 * Raggruppa i mercati composti per group_id.
 */
export function groupMarketsByGroup(markets: ComposedMarket[]): Record<string, ComposedMarket[]> {
  const grouped: Record<string, ComposedMarket[]> = {};
  for (const m of markets) {
    const key = m.groupLabel || String(m.group_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }
  return grouped;
}

/**
 * Ritorna i mercati principali (main=true) per uno sport.
 */
export function getMainMarketsForSport(sportId: number): XcMarketConfig[] {
  if (!sportConfig) return [];
  return sportConfig.markets
    .filter(m => m.sport_id === sportId && m.main)
    .sort((a, b) => a.order - b.order);
}

/**
 * Ritorna i gruppi disponibili per uno sport.
 */
export function getGroupsForSport(sportId: number): XcGroupConfig[] {
  if (!sportConfig) return [];
  return sportConfig.marketgroups
    .filter(g => g.sport_id === sportId)
    .sort((a, b) => (a.id - b.id));
}

// ── Polling ───────────────────────────────────────────────────────────────────

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startLivePolling(intervalMs = 5000): void {
  if (pollingInterval) return;
  loadLiveSnapshot();
  pollingInterval = setInterval(loadLiveSnapshot, intervalMs);
}

export function stopLivePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function getSnapshot(): XcLiveSnapshot | null {
  return snapshot;
}
