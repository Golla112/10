'use client';

import type { SportsbookEvent } from '../lib/oddsUtils';
import {
  extractH2H,
  formatOutcomeLabel,
  getMarket,
  isTwoWayWinnerMarket,
  marketLabel,
  outcomeSelectionKey,
} from '../lib/oddsUtils';

type Props<E extends SportsbookEvent = SportsbookEvent> = {
  event: E;
  selectedMarket: string;
  sport?: string;
  isSelected: (eventId: string, market: string, outcome: string) => boolean;
  onToggle: (
    event: E,
    market: string,
    outcome: string,
    odd: number,
    betcode?: string
  ) => void;
  compact?: boolean;
};

export default function EventOddsButtons<E extends SportsbookEvent>({
  event,
  selectedMarket,
  sport,
  isSelected,
  onToggle,
  compact = false,
}: Props<E>) {
  const twoWay = isTwoWayWinnerMarket(selectedMarket);
  const isWinner =
    selectedMarket === 'h2h' ||
    selectedMarket === 'tennis_h2h' ||
    selectedMarket === 'h2h_h1' ||
    selectedMarket === 'h2h_h2';

  if (isWinner) {
    const h2h = extractH2H(event, selectedMarket, twoWay);
    const marketName =
      selectedMarket === 'h2h' ? '1X2' : marketLabel(selectedMarket, sport);
    const cells = twoWay
      ? [
          { label: '1', key: '1', price: h2h.home, betcode: '1' },
          { label: '2', key: '2', price: h2h.away, betcode: '2' },
        ]
      : [
          { label: '1', key: '1', price: h2h.home, betcode: '1' },
          { label: 'Draw', key: 'Draw', price: h2h.draw, betcode: '0' },
          { label: '2', key: '2', price: h2h.away, betcode: '2' },
        ];
    const cols = twoWay ? 'cols-2' : 'cols-3';
    return (
      <div className={`event-odds-strip ${cols} ${compact ? 'compact' : ''}`}>
        {cells.map((cell) => (
          <button
            key={cell.key}
            type='button'
            className={`event-odd-cell ${isSelected(event.id, marketName, cell.betcode) ? 'active' : ''}`}
            disabled={!cell.price || cell.price <= 1}
            onClick={() => onToggle(event, marketName, cell.betcode, cell.price, cell.betcode)}
          >
            <span className='event-odd-label'>{cell.label}</span>
            <span className='event-odd-price'>
              {cell.price > 1 ? cell.price.toFixed(2) : '—'}
            </span>
          </button>
        ))}
      </div>
    );
  }

  const market = getMarket(event, selectedMarket);
  const marketName = market?.name ?? marketLabel(selectedMarket, sport);
  const outcomes = (market?.outcomes ?? []).filter((o) => o.price > 1 && !o.locked);

  if (outcomes.length === 0) {
    const cols = 'cols-3';
    return (
      <div className={`event-odds-strip ${cols} ${compact ? 'compact' : ''}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className='event-odd-cell disabled'>
            <span className='event-odd-label'>—</span>
            <span className='event-odd-price'>—</span>
          </div>
        ))}
      </div>
    );
  }

  const maxCells = outcomes.length >= 3 ? 3 : outcomes.length;
  const cols = maxCells >= 3 ? 'cols-3' : maxCells === 2 ? 'cols-2' : 'cols-1';

  return (
    <div className={`event-odds-strip ${cols} ${compact ? 'compact' : ''}`}>
      {outcomes.slice(0, 3).map((outcome, idx) => {
        const label = formatOutcomeLabel(outcome.name, idx, selectedMarket, event);
        const selKey = outcomeSelectionKey(selectedMarket, label, outcome.name, outcome.betcode);
        return (
          <button
            key={`${outcome.name}-${idx}`}
            type='button'
            className={`event-odd-cell ${isSelected(event.id, marketName, selKey) ? 'active' : ''}`}
            onClick={() =>
              onToggle(event, marketName, selKey, outcome.price, outcome.betcode ?? selKey)
            }
          >
            <span className='event-odd-label'>{label}</span>
            <span className='event-odd-price'>{outcome.price.toFixed(2)}</span>
          </button>
        );
      })}
    </div>
  );
}
