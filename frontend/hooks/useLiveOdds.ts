'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useBetSlipStore } from '../lib/betSlipStore';

interface OddsChange {
  eventId: string;
  market: string;
  outcome: string;
  oldOdds: number;
  newOdds: number;
  direction: 'up' | 'down';
  timestamp?: number;
}

interface EventStatus {
  eventId: string;
  status: 'upcoming' | 'live' | 'finished' | 'suspended';
  reason?: string;
}

function buildOddsWsUrl(): string {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return 'ws://localhost:4000/ws/odds';

  const normalized = backendUrl.replace(/\/$/, '').replace(/\/api$/i, '');
  const wsBase = normalized.startsWith('https://')
    ? normalized.replace('https://', 'wss://')
    : normalized.replace('http://', 'ws://');

  return `${wsBase}/ws/odds`;
}

export function useLiveOdds(enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [oddsChanges, setOddsChanges] = useState<OddsChange[]>([]);
  const [lockedEvents, setLockedEvents] = useState<string[]>([]);

  const { selections, updateSelectionOdds, setSelectionLocked } = useBetSlipStore();

  const eventIds = useMemo(
    () => Array.from(new Set(selections.map((s) => s.event_id))).filter(Boolean),
    [selections]
  );

  const shouldConnect = enabled && eventIds.length > 0;

  const cleanupConnection = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!shouldConnect || typeof window === 'undefined') return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = buildOddsWsUrl();

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      shouldReconnectRef.current = true;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);

        socket.send(
          JSON.stringify({
            type: 'subscribe',
            eventIds,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type?: string;
            eventId?: string;
            changes?: Array<{
              eventId: string;
              market: string;
              outcome: string;
              oldOdds: number;
              newOdds: number;
            }>;
          };

          switch (data.type) {
            case 'odds:update':
              if (!data.changes) return;
              data.changes.forEach((change) => {
                updateSelectionOdds(change.eventId, change.market, change.outcome, change.newOdds);
                setOddsChanges((prev) => [
                  ...prev.slice(-9),
                  {
                    ...change,
                    direction: change.newOdds > change.oldOdds ? 'up' : 'down',
                    timestamp: Date.now(),
                  },
                ]);
              });
              break;

            case 'event:locked':
              if (!data.eventId) return;
              setSelectionLocked(data.eventId, true);
              setLockedEvents((prev) => (prev.includes(data.eventId!) ? prev : [...prev, data.eventId!]));
              break;

            default:
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (!shouldReconnectRef.current) return;

        reconnectAttemptsRef.current += 1;
        const delay = Math.min(30000, 2000 * reconnectAttemptsRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, delay);
      };

      socket.onerror = () => {
        // Close triggers onclose where reconnect is handled.
        socket.close();
      };
    } catch {
      // Retry via onclose-style path.
      if (shouldReconnectRef.current) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(30000, 2000 * reconnectAttemptsRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, delay);
      }
    }
  }, [shouldConnect, eventIds, updateSelectionOdds, setSelectionLocked]);

  useEffect(() => {
    if (!shouldConnect) {
      cleanupConnection();
      return;
    }

    connect();

    return () => {
      cleanupConnection();
    };
  }, [shouldConnect, connect, cleanupConnection]);

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || eventIds.length === 0) return;

    socket.send(
      JSON.stringify({
        type: 'subscribe',
        eventIds,
      })
    );
  }, [eventIds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOddsChanges((prev) => prev.slice(-5));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    oddsChanges,
    lockedEvents,
    hasLockedEvents: lockedEvents.length > 0,
  };
}

export function useOddsNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'up' | 'down';
    timestamp: number;
  }>>([]);

  const addNotification = useCallback((change: OddsChange) => {
    const id = `${change.eventId}-${change.market}-${Date.now()}`;
    const direction = change.newOdds > change.oldOdds ? '↑' : '↓';
    const message = `${change.outcome} ${direction} ${change.newOdds.toFixed(2)}`;

    setNotifications((prev) => [
      ...prev.slice(-2),
      {
        id,
        message,
        type: change.direction,
        timestamp: Date.now(),
      },
    ]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  return { notifications, addNotification };
}
