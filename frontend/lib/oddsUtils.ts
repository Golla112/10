import {
  marketFiltersForSport,
  marketKeysForFilter,
  type MarketFilterDef,
  type SportCategory,
} from './betcodes';

export type SportsbookEvent = {
  id: string;
  home: { name: string };
  away: { name: string };
  sport_category?: string;
  bookmakers?: Array<{
    markets?: Array<{
      key?: string;
      name?: string;
      outcomes?: Array<{ name: string; price: number; point?: number; betcode?: string; locked?: boolean }>;
    }>;
  }>;
};

export type MarketFilterId = string;

export function getMarketFiltersForSport(sport: string): MarketFilterDef[] {
  return [...marketFiltersForSport(sport)];
}

type Market = NonNullable<NonNullable<SportsbookEvent['bookmakers']>[number]['markets']>[number];

export function getMarket(event: SportsbookEvent, marketType: string): Market | null {
  const keys = marketKeysForFilter(marketType).map((k) => k.toLowerCase());
  for (const bk of event.bookmakers ?? []) {
    for (const m of bk.markets ?? []) {
      const key = (m.key ?? m.name ?? '').toLowerCase();
      if (keys.includes(key)) return m;
    }
  }
  return null;
}

export function hasMarket(event: SportsbookEvent, marketType: string): boolean {
  const m = getMarket(event, marketType);
  return !!m?.outcomes?.some((o) => o.price > 1 && !o.locked);
}

export function countEventsWithMarket(events: SportsbookEvent[], marketType: string): number {
  return events.filter((e) => hasMarket(e, marketType)).length;
}

export function extractH2H(
  event: SportsbookEvent,
  marketType = 'h2h',
  twoWay = false
): { home: number; draw: number; away: number } {
  const m =
    getMarket(event, marketType) ??
    (marketType === 'h2h' ? getMarket(event, 'tennis_h2h') : null);
  const outcomes = (m?.outcomes ?? []).filter((o) => o.price > 1);
  if (outcomes.length < 2) return { home: 0, draw: 0, away: 0 };

  const byName = (needle: string) =>
    outcomes.find((o) => o.name.toLowerCase() === needle.toLowerCase())?.price ?? 0;

  const home =
    outcomes.find((o) => o.name === event.home.name)?.price ??
    byName('1') ??
    outcomes[0]?.price ??
    0;
  const away =
    outcomes.find((o) => o.name === event.away.name)?.price ??
    byName('2') ??
    (outcomes.length >= 2 ? outcomes[outcomes.length - 1]?.price ?? 0 : 0);

  if (twoWay || !getMarket(event, 'h2h')) {
    return { home, draw: 0, away };
  }

  const draw =
    byName('draw') ||
    byName('x') ||
    byName('pareggio') ||
    (outcomes.length >= 3 ? outcomes[1]?.price ?? 0 : 0);

  return { home, draw: draw > 1 ? draw : 0, away };
}

export function marketLabel(marketType: string, sport?: string): string {
  const filters = sport ? getMarketFiltersForSport(sport) : getMarketFiltersForSport('soccer');
  const fromFilters = filters.find((m) => m.id === marketType);
  if (fromFilters) return fromFilters.label;
  const fromKeys = getMarketFiltersForSport('soccer').find((f) =>
    f.marketKeys.some((k) => k.toLowerCase() === marketType.toLowerCase())
  );
  if (fromKeys) return fromKeys.label;
  return marketType.toUpperCase();
}

export function formatOutcomeLabel(
  name: string,
  index: number,
  marketType: string,
  event: SportsbookEvent
): string {
  const normalized = (name || '').trim();
  if (
    !normalized ||
    normalized.startsWith('Outcome ') ||
    /^\d+$/.test(normalized) ||
    normalized === event.home.name ||
    normalized === event.away.name
  ) {
    if (marketType === 'h2h' || marketType === 'tennis_h2h' || marketType === 'h2h_h1' || marketType === 'h2h_h2') {
      if (marketType === 'tennis_h2h') return index === 0 ? '1' : '2';
      return index === 0 ? '1' : index === 1 ? 'Draw' : '2';
    }
    if (marketType.startsWith('totals')) return index === 0 ? 'Over' : 'Under';
    if (marketType === 'btts') return index === 0 ? 'GG' : 'NG';
    if (marketType === 'double_chance') return index === 0 ? '1X' : index === 1 ? '12' : 'X2';
    return String(index + 1);
  }
  if (/over/i.test(normalized)) return 'Over';
  if (/under/i.test(normalized)) return 'Under';
  if (/yes|ggs|gg/i.test(normalized)) return 'GG';
  if (/no|ggn|ng/i.test(normalized)) return 'NG';
  if (/^draw$/i.test(normalized)) return 'Draw';
  return normalized.slice(0, 14);
}

export function outcomeSelectionKey(
  marketType: string,
  displayName: string,
  rawName: string,
  betcode?: string
): string {
  if (betcode) return betcode;
  if (marketType === 'h2h' || marketType === 'h2h_h1' || marketType === 'h2h_h2') {
    if (displayName === '1' || displayName === '2') return displayName;
    if (displayName === 'Draw' || displayName === 'X') return '0';
  }
  if (marketType === 'tennis_h2h') {
    if (displayName === '1') return '1';
    if (displayName === '2') return '2';
  }
  return displayName || rawName;
}

export function getAllMarkets(event: SportsbookEvent): Market[] {
  return event.bookmakers?.flatMap((bk) => bk.markets ?? []) ?? [];
}

export function defaultMarketForSport(sport: SportCategory | string): string {
  if (sport === 'tennis') return 'tennis_h2h';
  return 'h2h';
}

export function isTwoWayWinnerMarket(marketType: string): boolean {
  return marketType === 'tennis_h2h';
}

export type { SportCategory, MarketFilterDef };
