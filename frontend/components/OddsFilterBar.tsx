'use client';

import type { MarketFilterDef } from '../lib/oddsUtils';

type Props = {
  selectedMarket: string;
  onMarketChange: (id: string) => void;
  variant?: 'prematch' | 'live';
  counts?: Partial<Record<string, number>>;
  filters: MarketFilterDef[];
};

export default function OddsFilterBar({
  selectedMarket,
  onMarketChange,
  variant = 'prematch',
  counts,
  filters,
}: Props) {
  const withData = filters.filter((f) => (counts?.[f.id] ?? 0) > 0);
  const visible = withData.length > 0 ? withData : filters.slice(0, 6);

  return (
    <div className={`market-tabs-bar ${variant}`}>
      <div className='market-tabs-label'>
        {variant === 'live' ? 'Mercati live' : 'Mercati'}
      </div>
      <div className='market-tabs-scroll'>
        {visible.map((market) => {
          const active = selectedMarket === market.id;
          const count = counts?.[market.id] ?? 0;
          const disabled = count === 0;
          return (
            <button
              key={market.id}
              type='button'
              className={`market-tab ${active ? 'active' : ''} ${disabled ? 'muted' : ''}`}
              onClick={() => onMarketChange(market.id)}
              aria-pressed={active}
              disabled={disabled && !active}
            >
              <span className='market-tab-label'>{market.label}</span>
              {count > 0 && <span className='market-tab-count'>{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
