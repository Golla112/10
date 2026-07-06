'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBetSlipStore } from '../lib/betSlipStore';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 60 * 1000; // 1 minute warning

export default function IdleTimer() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const { clear } = useBetSlipStore();

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    setTimeLeft(60);
    localStorage.setItem('lastActivity', Date.now().toString());
  }, []);

  useEffect(() => {
    const activities = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      resetTimer();
    };

    activities.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    const checkInterval = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || Date.now().toString());
      const idleTime = Date.now() - lastActivity;

      if (idleTime > IDLE_TIMEOUT - WARNING_TIME && !showWarning) {
        setShowWarning(true);
      }

      if (idleTime > IDLE_TIMEOUT) {
        // Auto logout
        clear();
        localStorage.removeItem('lastActivity');
        window.location.href = '/login';
      }
    }, 1000);

    return () => {
      activities.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(checkInterval);
    };
  }, [clear, resetTimer, showWarning]);

  useEffect(() => {
    if (!showWarning) return;

    const countdown = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [showWarning]);

  const stayLoggedIn = () => {
    resetTimer();
  };

  const logout = () => {
    clear();
    localStorage.removeItem('lastActivity');
    window.location.href = '/login';
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl max-w-sm w-full p-6 text-center">
        <div className="text-5xl mb-4">⏰</div>
        <h3 className="text-xl font-bold text-white mb-2">Sessione in scadenza</h3>
        <p className="text-gray-400 mb-4">
          Sei stato inattivo per troppo tempo. La sessione scadrà tra:
        </p>
        <div className="text-4xl font-bold text-[#ff4757] mb-6">
          {timeLeft}s
        </div>
        <div className="flex gap-3">
          <button
            onClick={stayLoggedIn}
            className="flex-1 bg-[#14805e] hover:bg-[#1a9c70] text-white font-bold py-3 rounded-xl transition-colors"
          >
            Resta connesso
          </button>
          <button
            onClick={logout}
            className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-semibold py-3 rounded-xl transition-colors"
          >
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
