'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchChampionships,
  fetchEventsStats,
  fetchLeagueEvents,
  fetchSportEvents,
} from '../lib/api';
import { useBetSlipStore } from '../lib/betSlipStore';
import InlineBetSlip from './InlineBetSlip';
import LiveCalendar from './LiveCalendar';
import OddsFilterBar from './OddsFilterBar';
import PrematchEventList, { type PrematchListEvent } from './PrematchEventList';
import {
  countEventsWithMarket,
  defaultMarketForSport,
  getMarketFiltersForSport,
  type SportCategory,
} from '../lib/oddsUtils';

type Championship = {
  id: number;
  discipline: number;
  sport: string;
  nation: string;
  name: string;
  label: string;
};

const SPORTS: { id: SportCategory; label: string; discipline: number }[] = [
  { id: 'soccer', label: 'Calcio', discipline: 1 },
  { id: 'tennis', label: 'Tennis', discipline: 4 },
  { id: 'basketball', label: 'Basket', discipline: 5 },
];

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function PrematchSportsbook({
  forceNationSlug,
  forceLeagueSlug,
}: {
  forceNationSlug?: string;
  forceLeagueSlug?: string;
}) {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [sportStats, setSportStats] = useState<Record<string, { events: number; leagues: number }>>(
    {}
  );
  const [metaLoading, setMetaLoading] = useState(true);
  const [events, setEvents] = useState<PrematchListEvent[]>([]);
  const [listMeta, setListMeta] = useState({ events: 0, leagues: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<SportCategory | null>(null);
  const [selectedNation, setSelectedNation] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<Championship | null>(null);
  const [leagueSearch, setLeagueSearch] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string>('h2h');

  const { selections, addSelection, removeSelection } = useBetSlipStore();

  useEffect(() => {
    let disposed = false;
    async function loadMeta() {
      try {
        setMetaLoading(true);
        const [champs, stats] = await Promise.all([fetchChampionships(), fetchEventsStats()]);
        if (disposed) return;
        setChampionships(champs as Championship[]);
        setSportStats(stats);
        if (!forceNationSlug) {
          setSelectedSport('soccer');
          setViewAllLeagues(true);
        }
        setError(null);
      } catch (e) {
        if (disposed) return;
        setError(e instanceof Error ? e.message : 'Errore caricamento campionati');
      } finally {
        if (!disposed) setMetaLoading(false);
      }
    }
    loadMeta();
  }, [forceNationSlug]);

  useEffect(() => {
    if (!forceNationSlug || !forceLeagueSlug || championships.length === 0) return;
    const match = championships.find(
      (c) => slugify(c.nation) === forceNationSlug && slugify(c.name) === forceLeagueSlug
    );
    if (match) {
      setSelectedSport(match.sport as SportCategory);
      setSelectedNation(match.nation);
      setSelectedLeague(match);
    }
  }, [championships, forceNationSlug, forceLeagueSlug]);

  useEffect(() => {
    if (!selectedSport) {
      setEvents([]);
      setListMeta({ events: 0, leagues: 0 });
      return;
    }

    let disposed = false;

    async function loadEvents() {
      try {
        setLoading(true);
        setError(null);

        if (!selectedNation) {
          // Mostra solo nazioni
          setEvents([]);
          setListMeta({ events: 0, leagues: leaguesForNation.length });
        } else if (!selectedLeague) {
          // Mostra solo leghe della nazione
          setEvents([]);
          setListMeta({ events: 0, leagues: leaguesForSelectedNation.length });
        } else {
          // Carica partite della lega
          const data = (await fetchLeagueEvents(
            selectedLeague!.id,
            selectedLeague!.discipline
          )) as PrematchListEvent[];
          if (disposed) return;
          const leagueEvents = data.filter((e) => !e.live);
          setEvents(leagueEvents);
          setListMeta({ events: leagueEvents.length, leagues: 1 });
        }

        setSelectedMarket(defaultMarketForSport(selectedSport!));
      } catch (e) {
        if (disposed) return;
        setEvents([]);
        setListMeta({ events: 0, leagues: 0 });
        setError(e instanceof Error ? e.message : 'Errore caricamento eventi');
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      disposed = true;
    };
  }, [selectedSport, selectedNation, selectedLeague]);

  const leaguesForSport = useMemo(() => {
    if (!selectedSport) return [];
    const q = leagueSearch.trim().toLowerCase();
    return championships
      .filter((c) => c.sport === selectedSport)
      .filter(
        (c) =>
          !q ||
          c.label.toLowerCase().includes(q) ||
          c.nation.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [championships, selectedSport, leagueSearch]);

  const nationsForSport = useMemo(() => {
    if (!selectedSport) return [];
    const nations = new Set<string>();
    leaguesForSport.forEach((c) => nations.add(c.nation));
    return Array.from(nations).sort();
  }, [leaguesForSport]);

  const leaguesForSelectedNation = useMemo(() => {
    if (!selectedSport || !selectedNation) return [];
    return leaguesForSport.filter((c) => c.nation === selectedNation);
  }, [leaguesForSport, selectedSport, selectedNation]);

  const leaguesForNation = useMemo(() => {
    if (!selectedSport) return [];
    return leaguesForSport;
  }, [leaguesForSport, selectedSport]);

  const marketFilters = useMemo(
    () => (selectedSport ? getMarketFiltersForSport(selectedSport) : []),
    [selectedSport]
  );

  const marketCounts = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const m of marketFilters) {
      counts[m.id] = countEventsWithMarket(events, m.id);
    }
    return counts;
  }, [events, marketFilters]);

  useEffect(() => {
    if (!selectedSport) return;
    const firstWithData = marketFilters.find((m) => (marketCounts[m.id] ?? 0) > 0);
    if (firstWithData && (marketCounts[selectedMarket] ?? 0) === 0) {
      setSelectedMarket(firstWithData.id);
    }
  }, [marketCounts, marketFilters, selectedMarket, selectedSport]);

  const visibleEvents = useMemo(() => {
    const today = new Date().toDateString();
    const q = matchSearch.trim().toLowerCase();
    return events.filter((e) => {
      if (todayOnly) {
        const d = new Date((e.time ?? 0) * 1000).toDateString();
        if (d !== today) return false;
      }
      if (q) {
        const text = `${e.home.name} ${e.away.name} ${e.league?.name ?? ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [events, matchSearch, todayOnly]);

  function toggleSelection(
    event: PrematchListEvent,
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
    if (existing) return removeSelection(event.id, existing.outcome);
    addSelection({
      event_id: event.id,
      nome_evento: `${event.home.name} vs ${event.away.name}`,
      market,
      outcome: code,
      betcode: code,
      quota: odd,
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

  const showEvents = !!selectedSport && !!selectedLeague;
  const headerLabel = selectedLeague
    ? selectedLeague.label
    : selectedNation
    ? selectedNation
    : selectedSport
    ? `Tutti — ${SPORTS.find((s) => s.id === selectedSport)?.label ?? ''}`
    : '';

  function selectSport(sport: SportCategory) {
    setSelectedSport(sport);
    setSelectedNation(null);
    setSelectedLeague(null);
    setLeagueSearch('');
  }

  function selectNation(nation: string) {
    setSelectedNation(nation);
    setSelectedLeague(null);
  }

  function selectLeague(league: Championship) {
    setSelectedLeague(league);
  }

  function goBackToNations() {
    setSelectedNation(null);
    setSelectedLeague(null);
  }

  function goBackToLeagues() {
    setSelectedLeague(null);
  }

  function sportEventCount(sport: SportCategory) {
    return sportStats[sport]?.events ?? championships.filter((c) => c.sport === sport).length;
  }

  return (
    <div className='sb-page-shell'>
      <aside className='sb-left-rail'>
        <div className='sb-panel sb-rail-block'>
          <div className='sb-rail-title'>Sport</div>
          {SPORTS.map((sport) => (
            <button
              key={sport.id}
              type='button'
              className={`sb-filter-btn ${selectedSport === sport.id ? 'active' : ''}`}
              onClick={() => selectSport(sport.id)}
            >
              {sport.label} ({sportEventCount(sport.id)})
            </button>
          ))}
        </div>

        <div className='sb-panel sb-nations-panel sb-rail-block'>
          {!selectedSport && <div className='sb-rail-hint'>Seleziona uno sport</div>}
          {selectedSport && !selectedNation && !selectedLeague && (
            <>
              <div className='sb-rail-title'>
                Nazioni ({nationsForSport.length})
              </div>
              <div className='sb-nations-scroll'>
                {nationsForSport.map((nation) => (
                  <button
                    key={nation}
                    type='button'
                    className='sb-filter-btn'
                    onClick={() => selectNation(nation)}
                  >
                    {nation}
                  </button>
                ))}
              </div>
            </>
          )}
          {selectedSport && selectedNation && !selectedLeague && (
            <>
              <div className='sb-rail-title flex justify-between items-center'>
                <button onClick={goBackToNations} className='sb-filter-btn text-xs p-1'>
                  ← Nazioni
                </button>
                Leghe ({leaguesForSelectedNation.length})
              </div>
              <input
                value={leagueSearch}
                onChange={(e) => setLeagueSearch(e.target.value)}
                placeholder='Cerca lega...'
                className='betslip-input sb-rail-search'
              />
              <div className='sb-nations-scroll'>
                {leaguesForSelectedNation.map((league) => (
                  <button
                    key={league.id}
                    type='button'
                    className='sb-filter-btn'
                    onClick={() => selectLeague(league)}
                  >
                    {league.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {selectedSport && selectedLeague && (
            <>
              <div className='sb-rail-title flex justify-between items-center'>
                <button onClick={goBackToLeagues} className='sb-filter-btn text-xs p-1'>
                  ← Leghe
                </button>
                {selectedLeague.label}
              </div>
            </>
          )}
        </div>
      </aside>

      <section className='sb-content'>
        <div className='sb-toolbar sb-panel'>
          <div className='sb-toolbar-main'>
            <h1>Prematch</h1>
            {showEvents && <span className='chip'>{headerLabel}</span>}
            {showEvents && (
              <span className='chip accent'>
                {visibleEvents.length} partite
                {listMeta.leagues > 1 ? ` · ${listMeta.leagues} campionati` : ''}
              </span>
            )}
          </div>
          <div className='sb-toolbar-actions'>
            <label className='chip chip-check'>
              <input type='checkbox' checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />
              Oggi
            </label>
            {showEvents && (
              <input
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                placeholder='Cerca squadra o lega...'
                className='betslip-input sb-toolbar-search'
              />
            )}
          </div>
        </div>

        {!showEvents && !metaLoading && (
          <div className='sb-panel sb-empty'>Seleziona uno sport per vedere tutte le partite.</div>
        )}

        {metaLoading && <div className='sb-panel sb-empty'>Caricamento palinsesto...</div>}

        {showEvents && (
          <div className='sb-panel sb-filter-panel'>
            <OddsFilterBar
              variant='prematch'
              selectedMarket={selectedMarket}
              onMarketChange={setSelectedMarket}
              counts={marketCounts}
              filters={marketFilters}
            />
          </div>
        )}

        {loading && <div className='sb-panel sb-empty'>Caricamento quote...</div>}
        {error && showEvents && <div className='sb-panel sb-error'>{error}</div>}

        {!loading && showEvents && visibleEvents.length === 0 && (
          <div className='sb-panel sb-empty'>Nessuna partita trovata.</div>
        )}

        {!loading && showEvents && selectedSport && visibleEvents.length > 0 && (
          <>
            {selectedLeague && !viewAllLeagues && (
              <div className='sb-panel sb-league-block'>
                <div className='sb-league-header'>
                  <Link
                    href={`/prematch/${slugify(selectedLeague.nation)}/${slugify(selectedLeague.name)}`}
                  >
                    {selectedLeague.label} — quote complete
                  </Link>
                </div>
              </div>
            )}
            <PrematchEventList
              events={visibleEvents}
              selectedMarket={selectedMarket}
              selectedSport={selectedSport}
              isSelected={isSelected}
              onToggle={toggleSelection}
            />
          </>
        )}
      </section>

      <aside className='sb-right-rail'>
        <LiveCalendar />
        <InlineBetSlip />
      </aside>
    </div>
  );
}
