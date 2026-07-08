'use client';
import LiveOddsDisplay from '../../components/LiveOddsDisplay';
import Link from 'next/link';

export default function LiveOddsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            ← Torna alla home
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Quote Live in Tempo Reale
          </h1>
          <p className="text-gray-400 mt-2">
            Aggiornamento istantaneo - Tutte le partite e tutte le quote disponibili
          </p>
        </div>

        {/* Live Odds Component */}
        <LiveOddsDisplay className="w-full" />
      </div>
    </main>
  );
}
