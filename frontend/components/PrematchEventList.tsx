'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { VirtualList } from './VirtualList';
import EventOddsButtons from './EventOddsButtons';
import type { SportCategory, SportsbookEvent } from '../lib/oddsUtils';

export type PrematchListEvent = SportsbookEvent & {
  time: number;
  league?: { name?: string };
  live?: boolean;
};

type Props = {
  events: PrematchListEvent[];
  selectedMarket: string;
  selectedSport: SportCategory;
  isSelected: (eventId: string, market: string, outcome: string) => boolean;
  onToggle: (
    event: PrematchListEvent,
    market: string,
    outcome: string,
    odd: number,
    betcode?: string
  ) => void;
};

function teamInitial(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

const PrematchEventRow = memo(function PrematchEventRow({
  event,
  selectedMarket,
  selectedSport,
  isSelected,
  onToggle,
  showLeague,
  extraMarkets,
}: {
  event: PrematchListEvent;
  selectedMarket: string;
  selectedSport: SportCategory;
  isSelected: Props['isSelected'];
  onToggle: Props['onToggle'];
  showLeague: boolean;
  extraMarkets: number;
}) {
  return (
    <div className='sb-row sb-row-compact'>
      {showLeague && (
        <div className='sb-inline-league'>{event.league?.name ?? 'Prematch'}</div>
      )}
      <div className='sb-row-main'>
        <div className='sb-row-time'>
          {new Date((event.time ?? 0) * 1000).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        <div className='sb-row-teams'>
          <Link href={`/events/${event.id}`} className='sb-row-team link'>
            <span className='sb-team-initial'>{teamInitial(event.home.name)}</span>
            <span>{event.home.name}</span>
          </Link>
          <Link href={`/events/${event.id}`} className='sb-row-team away link'>
            <span className='sb-team-initial'>{teamInitial(event.away.name)}</span>
            <span>{event.away.name}</span>
          </Link>
        </div>
        <div className='sb-row-odds'>
          <EventOddsButtons
            event={event}
            selectedMarket={selectedMarket}
            sport={selectedSport}
            isSelected={isSelected}
            onToggle={onToggle}
            compact
          />
          {extraMarkets > 0 && (
            <Link href={`/events/${event.id}`} className='sb-more-markets-btn link'>
              +{extraMarkets} mercati
            </Link>
          )}
        </div>
      </div>
    </div>
  );
});

export default function PrematchEventList({
  events,
  selectedMarket,
  selectedSport,
  isSelected,
  onToggle,
}: Props) {
  const rows = useMemo(() => {
    let prevLeague = '';
    return events.map((event) => {
      const league = event.league?.name ?? 'Prematch';
      const showLeague = league !== prevLeague;
      prevLeague = league;
      const marketCount =
        event.bookmakers?.reduce((n, bk) => n + (bk.markets?.length ?? 0), 0) ?? 0;
      const extraMarkets = Math.max(0, marketCount - 1);
      return { event, showLeague, extraMarkets };
    });
  }, [events]);

  const [containerHeight, setContainerHeight] = useState(560);
  useEffect(() => {
    const update = () => setContainerHeight(Math.min(760, Math.max(460, window.innerHeight - 280)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!events.length) return null;

  const rowHeight = 78;

  return (
    <div className='sb-panel sb-league-block sb-virtual-feed'>
      <VirtualList
        items={rows}
        itemHeight={rowHeight}
        containerHeight={containerHeight}
        overscan={10}
        className='sb-virtual-scroll'
        renderItem={(row) => (
          <PrematchEventRow
            event={row.event}
            selectedMarket={selectedMarket}
            selectedSport={selectedSport}
            isSelected={isSelected}
            onToggle={onToggle}
            showLeague={row.showLeague}
            extraMarkets={row.extraMarkets}
          />
        )}
      />
      <div className='sb-virtual-foot'>{events.length} partite caricate</div>
    </div>
  );
}
