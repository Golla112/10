'use client';
import BetSlip from '../../components/BetSlip';
import Link from 'next/link';

export default function BetSlipPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-lg p-4">
        <div className="mb-4">
          <Link href="/" className="text-blue-400 text-sm hover:underline">← Torna agli eventi</Link>
        </div>
        <BetSlip />
      </div>
    </main>
  );
}
