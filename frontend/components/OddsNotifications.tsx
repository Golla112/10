'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveOdds } from '../hooks/useLiveOdds';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

export default function OddsNotifications() {
  const { isConnected, oddsChanges, lockedEvents } = useLiveOdds(true);

  // Show only last 3 changes
  const recentChanges = oddsChanges.slice(-3);

  return (
    <>
      {/* Connection status indicator */}
      <div className="fixed top-20 right-4 z-40 flex items-center gap-2">
        {isConnected ? (
          <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-500/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
            Offline
          </span>
        )}
      </div>

      {/* Odds change notifications */}
      <div className="fixed top-24 right-4 z-40 flex flex-col gap-2 max-w-[200px]">
        <AnimatePresence mode="popLayout">
          {recentChanges.map((change, index) => (
            <motion.div
              key={`${change.eventId}-${change.market}-${change.timestamp}`}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                ${change.direction === 'up' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }
              `}
            >
              {change.direction === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span className="truncate">
                {change.outcome} {change.newOdds.toFixed(2)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Event locked warnings */}
        <AnimatePresence>
          {lockedEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{lockedEvents.length} evento/i bloccato/i</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
