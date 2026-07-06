'use client';
import { useBetSlipStore, Selection } from '../lib/betSlipStore';

interface OddsButtonProps {
  eventId: string;
  eventName: string;
  market: string;
  outcome: string;
  quota: number;
  disabled?: boolean;
}

export default function OddsButton({
  eventId,
  eventName,
  market,
  outcome,
  quota,
  disabled,
}: OddsButtonProps) {
  const { selections, addSelection, removeSelection } = useBetSlipStore();
  const isSelected = selections.some(
    (s) => s.event_id === eventId && s.market === market && s.outcome === outcome
  );

  function handleClick() {
    if (disabled) return;
    if (isSelected) {
      removeSelection(eventId);
    } else {
      const sel: Selection = {
        event_id: eventId,
        nome_evento: eventName,
        quota,
        market,
        outcome,
      };
      addSelection(sel);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex flex-col items-center rounded px-3 py-2 text-sm font-medium transition
        ${disabled ? 'cursor-not-allowed bg-gray-800 text-gray-600' : ''}
        ${isSelected && !disabled ? 'bg-blue-700 text-white' : ''}
        ${!isSelected && !disabled ? 'bg-gray-800 text-white hover:bg-gray-700' : ''}
      `}
    >
      <span className="text-xs text-gray-400">{outcome}</span>
      <span className="text-base font-bold">{quota.toFixed(2)}</span>
    </button>
  );
}
