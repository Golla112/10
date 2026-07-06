'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBetSlipStore } from '../lib/betSlipStore';
import { detectOddsChanges, OddsChange } from '../lib/couponUtils';
import { showToast } from '../components/Toast';

interface UseOddsUpdatesOptions {
  enabled?: boolean;
  pollingInterval?: number;
  onOddsChange?: (changes: OddsChange[]) => void;
  onEventLock?: (eventIds: string[]) => void;
}

export function useOddsUpdates(options: UseOddsUpdatesOptions = {}) {
  const { 
    enabled = true, 
    pollingInterval = 5000,
    onOddsChange,
    onEventLock 
  } = options;
  
  const { selections, updateSelectionOdds, setSelectionLocked } = useBetSlipStore();
  const prevSelectionsRef = useRef(selections);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkOddsUpdates = useCallback(async () => {
    if (selections.length === 0) return;
    
    const eventIds = Array.from(new Set(selections.map(s => s.event_id)));
    
    try {
      // Fetch latest odds from API
      const response = await fetch('/api/odds/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds }),
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const { odds: latestOdds, locked: lockedEventIds } = data;
      
      // Check for locked events
      if (lockedEventIds?.length > 0) {
        lockedEventIds.forEach((eventId: string) => {
          setSelectionLocked(eventId, true);
        });
        onEventLock?.(lockedEventIds);
        showToast(`${lockedEventIds.length} eventi bloccati per inizio partita`, 'warning');
      }
      
      // Update odds in store
      latestOdds?.forEach((update: any) => {
        updateSelectionOdds(
          update.eventId,
          update.market,
          update.outcome,
          update.newOdds
        );
      });
      
      // Detect changes for UI feedback
      const changes = detectOddsChanges(prevSelectionsRef.current, selections);
      
      if (changes.length > 0) {
        onOddsChange?.(changes);
        
        // Show toast for significant changes (> 10%)
        const significantChanges = changes.filter(c => 
          Math.abs(c.newOdds - c.oldOdds) / c.oldOdds > 0.1
        );
        
        if (significantChanges.length > 0) {
          const direction = significantChanges[0].direction === 'up' ? '↑' : '↓';
          showToast(
            `${significantChanges.length} quote cambiate ${direction}`,
            'info'
          );
        }
      }
      
      prevSelectionsRef.current = selections;
    } catch (err) {
      // Silent fail - don't spam errors
      console.debug('Odds update check failed:', err);
    }
  }, [selections, updateSelectionOdds, setSelectionLocked, onOddsChange, onEventLock]);

  useEffect(() => {
    if (!enabled || selections.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkOddsUpdates();
    
    // Start polling
    intervalRef.current = setInterval(checkOddsUpdates, pollingInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, selections.length, pollingInterval, checkOddsUpdates]);

  return {
    checkNow: checkOddsUpdates,
  };
}

// Hook for live event monitoring (admin)
export function useLiveEventMonitoring(enabled: boolean = false) {
  const [events, setEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/admin-ws');
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          switch (data.type) {
            case 'live_events':
              setEvents(data.events);
              break;
            case 'alert':
              setAlerts(prev => [data.alert, ...prev].slice(0, 50));
              showToast(data.alert.message, data.alert.severity);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (destroyed) return;
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(30_000, 2000 * reconnectAttemptsRef.current);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  return { events, alerts };
}
