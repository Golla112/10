'use client';
import { useRouter } from 'next/navigation';

interface Selection {
  event_id: string;
  nome_evento: string;
  quota: number;
  market: string;
  outcome: string;
  betcode?: string;
  live?: boolean;
}

export interface StoredBet {
  codice_schedina: string;
  nome_proprietario: string;
  stake: number;
  selections: Selection[];
  total_odds: number;
  potential_win: number;
  created_at: string;
  bonus_pct?: number;
  tipo_schedina?: string;
  sistema_info?: { k: number; n: number; num_combinations: number; stake_per_combo: number };
}

interface BetConfirmationProps {
  bet: StoredBet;
  onNewBet: () => void;
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export default function BetConfirmation({ bet, onNewBet }: BetConfirmationProps) {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-green-700 bg-gray-900 p-4 space-y-4">
      <div className="text-center">
        <span className="text-green-400 text-2xl">✓</span>
        <h2 className="mt-1 text-lg font-bold text-white">Scommessa confermata!</h2>
      </div>

      <div className="rounded bg-gray-800 p-3 text-center">
        <p className="text-xs text-gray-400 mb-1">Codice Schedina</p>
        <p className="text-2xl font-extrabold tracking-widest text-blue-400">
          {bet.codice_schedina}
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Data / Ora</span>
          <span className="text-white font-medium">{formatDateTime(bet.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Importo</span>
          <span className="text-white font-medium">€ {bet.stake.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Quota totale</span>
          <span className="text-white font-medium">{bet.total_odds.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Vincita potenziale</span>
          <span className="font-bold text-green-400">€ {bet.potential_win.toFixed(2)}</span>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2 uppercase font-semibold">Selezioni</p>
        <div className="space-y-1">
          {bet.selections.map((sel) => (
            <div key={sel.event_id} className="flex items-center justify-between rounded bg-gray-800 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{sel.nome_evento}</p>
                <p className="text-xs text-gray-500">{sel.market} · {sel.outcome}</p>
              </div>
              <span className="ml-2 text-sm font-bold text-blue-400 shrink-0">{sel.quota.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => router.push(`/print/${bet.codice_schedina}`)}
          className="flex-1 rounded bg-blue-700 py-2 text-sm font-bold text-white hover:bg-blue-600 transition"
        >
          Stampa Scommessa
        </button>
        <button
          onClick={onNewBet}
          className="flex-1 rounded border border-gray-600 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
        >
          Nuova Scommessa
        </button>
      </div>
    </div>
  );
}
