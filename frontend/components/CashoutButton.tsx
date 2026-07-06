'use client';

import { useState } from 'react';
import { verifyCashout, confirmCashout } from '../lib/xcodetecApi';

interface CashoutButtonProps {
  couponId: string;
  authToken: string;
  onSuccess?: () => void;
}

export default function CashoutButton({ couponId, authToken, onSuccess }: CashoutButtonProps) {
  const [verifying, setVerifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cashoutData, setCashoutData] = useState<{
    available: boolean;
    amount: number;
    message?: string;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleVerify() {
    if (!authToken) return;
    setVerifying(true);
    try {
      const data = await verifyCashout(couponId, authToken);
      setCashoutData(data);
      if (data.available) {
        setShowConfirm(true);
      }
    } catch (err) {
      console.error('Cashout verify failed:', err);
    } finally {
      setVerifying(false);
    }
  }

  async function handleConfirm() {
    if (!authToken) return;
    setConfirming(true);
    try {
      await confirmCashout(couponId, authToken);
      setShowConfirm(false);
      onSuccess?.();
    } catch (err) {
      console.error('Cashout confirm failed:', err);
    } finally {
      setConfirming(false);
    }
  }

  if (!authToken) return null;

  return (
    <>
      {!showConfirm ? (
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="bg-[#ffa502] hover:bg-[#e69500] disabled:bg-gray-600 text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          {verifying ? (
            <>
              <span className="animate-spin">⏳</span>
              Verifica...
            </>
          ) : (
            <>
              💰 Cashout
            </>
          )}
        </button>
      ) : (
        <div className="bg-[#ffa502]/10 border border-[#ffa502]/30 rounded-lg p-3">
          <p className="text-sm text-gray-300 mb-2">Cashout disponibile:</p>
          <p className="text-2xl font-bold text-[#ffa502] mb-3">
            €{cashoutData?.amount?.toFixed(2)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 bg-[#ffa502] hover:bg-[#e69500] disabled:bg-gray-600 text-black font-bold py-2 rounded-lg text-sm transition-colors"
            >
              {confirming ? '⏳ Conferma...' : '✓ Conferma Cashout'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={confirming}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
