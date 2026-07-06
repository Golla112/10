'use client';

import { useEffect, useMemo, useState } from 'react';
import { connectLiveWS } from '../../lib/api';
import { useBetSlipStore } from '../../lib/betSlipStore';
import TeamLogo from '../../components/TeamLogo';
import InlineBetSlip from '../../components/InlineBetSlip';
import OddsFilterBar from '../../components/OddsFilterBar';
import EventOddsButtons from '../../components/EventOddsButtons';
import {
  countEventsWithMarket,
  getAllMarkets,
  getMarketFiltersForSport,
  marketLabel,
  formatOutcomeLabel,
  outcomeSelectionKey,
} from '../../lib/oddsUtils';
import { marketKeysForFilter } from '../../lib/betcodes';

type LiveEvent = {
  id: string;
  home: { name: string };
  away: { name: string };
  live?: boolean;
  minute?: number | null;
  score?: { home: number | null; away: number | null };
  sport_category?: string;
  league?: { name?: string };
  bookmakers?: Array<{
    markets?: Array<{
      key?: string;
      name?: string;
      outcomes?: Array<{ name: string; price: number; locked?: boolean }>;
    }>;
  }>;
};

const TIME_FILTERS = [
  { value: 'all', label: 'TUTTI', minutes: Infinity },
  { value: '30min', label: '30m', minutes: 30 },
  { value: '60min', label: '1h', minutes: 60 },
  { value: '90min', label: '90m', minutes: 90 },
  { value: '120min', label: '2h', minutes: 120 },
];

function getLeagueParts(name?: string): { nation: string; league: string } {
  const raw = (name ?? 'Live — Match').trim();
  const sep = raw.indexOf('—');
  if (sep > 0) {
    return { nation: raw.slice(0, sep).trim(), league: raw.slice(sep + 1).trim() };
  }
  return { nation: 'Live', league: raw };
}

function EventMarketsPanel({
  event,
  excludeFilter,
}: {
  event: LiveEvent;
  excludeFilter?: string;
}) {
  const { addSelection, removeSelection, selections } = useBetSlipStore();
  const excludeKeys = new Set(
    (excludeFilter ? marketKeysForFilter(excludeFilter) : []).map((k) => k.toLowerCase())
  );
  const markets = (event.bookmakers?.flatMap((bk) => bk.markets ?? []) ?? []).filter((m) => {
    const key = (m.key ?? m.name ?? '').toLowerCase();
    return !excludeKeys.has(key);
  });

  if (!markets.length) return null;

  return (
    <div className='event-markets-panel'>
      {markets.map((m) => {
        const mKey = m.key ?? m.name ?? 'market';
        const mLabel = marketLabel(mKey);
        return (
          <div key={mKey}>
            <div className='event-market-block-label'>{mLabel}</div>
            <div className='event-market-odds'>
              {(m.outcomes ?? [])
                .filter((o) => o.price > 1 && !o.locked)
                .map((o, idx) => {
                  const label = formatOutcomeLabel(o.name, idx, mKey || 'h2h', event);
                  const selKey = outcomeSelectionKey(mKey || 'h2h', label, o.name);
                  const selected = selections.some(
                    (s) => s.event_id === event.id && s.market === mLabel && s.outcome === selKey
                  );
                  return (
                    <button
                      key={`${mKey}-${o.name}`}
                      className={`sb-odd-btn ${selected ? 'active' : ''}`}
                      style={{ minWidth: 64, height: 38 }}
                      onClick={() => {
                        if (selected) removeSelection(event.id, selKey);
                        else
                          addSelection({
                            event_id: event.id,
                            nome_evento: `${event.home.name} vs ${event.away.name}`,
                            market: mLabel,
                            outcome: selKey,
                            quota: o.price,
                            live: true,
                          });
                      }}
                    >
                      {label} {o.price.toFixed(2)}
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<string>('h2h');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const { selections, addSelection, removeSelection } = useBetSlipStore();

  useEffect(() => {
    return connectLiveWS(
      (data) => {
        const next = (data as LiveEvent[])
          .filter((e) => e.live)
          .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
        setEvents(next);
      },
      setStatus
    );
  }, []);

  const toggleTournament = (leagueName: string) => {
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(leagueName)) next.delete(leagueName);
      else next.add(leagueName);
      return next;
    });
  };

  const liveMarketFilters = useMemo(() => getMarketFiltersForSport('soccer'), []);

  const marketCounts = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const m of liveMarketFilters) {
      counts[m.id] = countEventsWithMarket(events, m.id);
    }
    return counts;
  }, [events, liveMarketFilters]);

  const visible = useMemo(() => {
    let filtered = events;
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((e) =>
        `${e.home.name} ${e.away.name} ${e.league?.name ?? ''}`.toLowerCase().includes(q)
      );
    }
    if (selectedTimeFilter !== 'all') {
      const filter = TIME_FILTERS.find((f) => f.value === selectedTimeFilter);
      if (filter && filter.minutes !== Infinity) {
        filtered = filtered.filter((e) => (e.minute ?? 0) <= filter.minutes);
      }
    }
    return filtered;
  }, [events, search, selectedTimeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, LiveEvent[]>();
    for (const e of visible) {
      const key = e.league?.name ?? 'Live — Match';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [visible]);

  useEffect(() => {
    if (grouped.length === 0) return;
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      for (const [name] of grouped) next.add(name);
      return next;
    });
  }, [grouped]);

  function toggleSelection(
    event: LiveEvent,
    market: string,
    outcome: string,
    odd: number,
    betcode?: string
  ) {
    if (!odd || odd <= 1) return;
    const code = betcode ?? outcome;
    const existing = selections.find(
      (s) => s.event_id === event.id && (s.betcode ?? s.outcome) === code
    );
    if (existing) {
      removeSelection(event.id, existing.outcome);
      return;
    }
    addSelection({
      event_id: event.id,
      nome_evento: `${event.home.name} vs ${event.away.name}`,
      market,
      outcome: code,
      betcode: code,
      quota: odd,
      live: true,
    });
  }

  function isSelected(eventId: string, market: string, outcome: string) {
    return selections.some(
      (s) =>
        s.event_id === eventId &&
        s.market === market &&
        ((s.betcode ?? s.outcome) === outcome || s.outcome === outcome)
    );
  }

  return (
    <div className='sb-page-shell'>
      <aside className='sb-left-rail'>
        <div className='sb-panel sb-rail-block'>
          <div className='sb-rail-title'>Live</div>
          <div className='chip accent'>{events.length} in gioco</div>
          <div className='chip' style={{ marginTop: 8 }}>
            {status === 'open' ? 'Realtime' : status}
          </div>
        </div>
      </aside>

      <section className='sb-content'>
        <div className='sb-toolbar sb-panel'>
          <div className='sb-toolbar-main'>
            <h1>Live</h1>
            <span className='sb-live-dot' />
            <span className='chip accent'>{visible.length} visibili</span>
          </div>
          <div className='sb-toolbar-actions'>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Cerca match...'
              className='betslip-input sb-toolbar-search'
            />
          </div>
        </div>

        <div className='sb-panel sb-filter-panel'>
          <OddsFilterBar
            variant='live'
            selectedMarket={selectedMarket}
            onMarketChange={setSelectedMarket}
            counts={marketCounts}
            filters={liveMarketFilters}
          />
        </div>

        <div className='sb-panel' style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {TIME_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type='button'
                onClick={() => setSelectedTimeFilter(filter.value)}
                className={`sb-segment ${selectedTimeFilter === filter.value ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {grouped.length === 0 && (
          <div className='sb-panel' style={{ padding: 24, color: '#d9e8f5', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Nessun evento live disponibile.</div>
          </div>
        )}

        {grouped.map(([leagueName, leagueEvents]) => {
          const { nation, league } = getLeagueParts(leagueName);
          const isExpanded = expandedTournaments.has(leagueName);

          return (
            <div key={leagueName} className='sb-panel' style={{ marginBottom: 14, overflow: 'hidden' }}>
              <div
                onClick={() => toggleTournament(leagueName)}
                style={{
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg, rgba(24, 194, 139, 0.14), rgba(24, 194, 139, 0.08))',
                  borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#edfff8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span>{nation} — {league}</span>
                <span style={{ fontSize: 10, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </div>

              {isExpanded &&
                leagueEvents.map((event) => {
                  const allMarkets = getAllMarkets(event);

                  return (
                    <div
                      className='sb-row'
                      key={event.id}
                      style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '12px 16px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 36 }}>
                          <span className='sb-live-dot' />
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#ffb8c3' }}>
                            {event.minute != null ? `${event.minute}'` : 'LIVE'}
                          </span>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TeamLogo name={event.home.name} size={16} borderRadius={3} />
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{event.home.name}</span>
                            </div>
                            <strong style={{ fontSize: 14, fontWeight: 800, color: '#edfff8' }}>
                              {event.score?.home ?? '-'}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TeamLogo name={event.away.name} size={16} borderRadius={3} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#c8dceb' }}>{event.away.name}</span>
                            </div>
                            <strong style={{ fontSize: 14, fontWeight: 800, color: '#edfff8' }}>
                              {event.score?.away ?? '-'}
                            </strong>
                          </div>
                        </div>

                        <div style={{ minWidth: 200, maxWidth: 240 }}>
                          <EventOddsButtons
                            event={event}
                            selectedMarket={selectedMarket}
                            isSelected={isSelected}
                            onToggle={toggleSelection}
                            compact
                          />
                          {allMarkets.length > 1 && (
                            <button
                              type='button'
                              className='sb-filter-btn'
                              style={{ width: '100%', marginTop: 4, padding: '3px 8px', fontSize: 9, textAlign: 'center' }}
                              onClick={() =>
                                setExpandedEventId(expandedEventId === event.id ? null : event.id)
                              }
                            >
                              {expandedEventId === event.id ? 'Chiudi' : `+${allMarkets.length} mercati`}
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedEventId === event.id && (
                        <EventMarketsPanel event={event} excludeFilter={selectedMarket} />
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </section>

      <aside className='sb-right-rail'>
        <InlineBetSlip />
      </aside>
    </div>
  );
}
