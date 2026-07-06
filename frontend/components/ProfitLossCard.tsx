'use client';
import { ProfitLossResponse } from '../lib/api';

function PLValue({ value }: { value: number }) {
  const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
  const sign = value > 0 ? '+' : '';
  return <span className={`text-xl font-bold ${color}`}>{sign}€{value.toFixed(2)}</span>;
}

const periods: { key: keyof ProfitLossResponse; label: string }[] = [
  { key: 'daily', label: 'Oggi' },
  { key: 'weekly', label: 'Settimana' },
  { key: 'monthly', label: 'Mese' },
  { key: 'yearly', label: 'Anno' },
];

export default function ProfitLossCard({ data }: { data: ProfitLossResponse }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Profitto / Perdita</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {periods.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center rounded-md bg-gray-800 p-3">
            <span className="mb-1 text-xs text-gray-500">{label}</span>
            <PLValue value={data[key]} />
          </div>
        ))}
      </div>
    </div>
  );
}
