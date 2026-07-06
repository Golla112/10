import { Server } from 'socket.io';
import { supabase } from '../db/supabase';

interface OddsUpdate {
  eventId: string;
  market: string;
  outcome: string;
  oldOdds: number;
  newOdds: number;
  timestamp: number;
}

interface EventStatus {
  eventId: string;
  status: 'upcoming' | 'live' | 'finished' | 'suspended';
  startTime?: string;
}

// Store active connections and their tracked events
const clientSubscriptions = new Map<string, Set<string>>(); // socketId -> eventIds
const eventOddsCache = new Map<string, Map<string, number>>(); // eventId -> {market-outcome: odds}
const eventStatusCache = new Map<string, EventStatus>();

// Polling configuration
const POLLING_INTERVAL = 5000; // 5 seconds
const LOCK_BEFORE_START = 300; // 5 minutes before event starts, lock betting

export function setupOddsUpdatesWebSocket(io: Server) {
  const oddsNamespace = io.of('/odds');

  oddsNamespace.on('connection', (socket) => {
    console.log(`[OddsWS] Client connected: ${socket.id}`);
    
    // Initialize empty subscription set for this client
    clientSubscriptions.set(socket.id, new Set());

    // Handle subscription to specific events
    socket.on('subscribe', async (eventIds: string[]) => {
      console.log(`[OddsWS] Client ${socket.id} subscribing to events:`, eventIds);
      
      const currentSubs = clientSubscriptions.get(socket.id) || new Set();
      eventIds.forEach(id => currentSubs.add(id));
      clientSubscriptions.set(socket.id, currentSubs);

      // Send current odds immediately
      for (const eventId of eventIds) {
        const currentOdds = await fetchCurrentOdds(eventId);
        socket.emit('odds:initial', { eventId, odds: currentOdds });
        
        // Cache the odds
        if (!eventOddsCache.has(eventId)) {
          eventOddsCache.set(eventId, new Map());
        }
        const cache = eventOddsCache.get(eventId)!;
        Object.entries(currentOdds).forEach(([key, value]) => {
          cache.set(key, value as number);
        });
      }
    });

    // Handle unsubscription
    socket.on('unsubscribe', (eventIds: string[]) => {
      console.log(`[OddsWS] Client ${socket.id} unsubscribing from events:`, eventIds);
      const currentSubs = clientSubscriptions.get(socket.id);
      if (currentSubs) {
        eventIds.forEach(id => currentSubs.delete(id));
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[OddsWS] Client disconnected: ${socket.id}`);
      clientSubscriptions.delete(socket.id);
    });
  });

  // Start periodic polling
  startPolling(oddsNamespace);

  return oddsNamespace;
}

async function fetchCurrentOdds(eventId: string): Promise<Record<string, number>> {
  try {
    // Try to get from live odds scheduler first
    const { data: liveOdds } = await supabase
      .from('live_odds')
      .select('market, outcome, odds')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false });

    if (liveOdds && liveOdds.length > 0) {
      const odds: Record<string, number> = {};
      liveOdds.forEach((row: any) => {
        odds[`${row.market}-${row.outcome}`] = row.odds;
      });
      return odds;
    }

    // Fallback: get from cached events
    const { data: event } = await supabase
      .from('cached_events')
      .select('markets')
      .eq('id', eventId)
      .single();

    if (event?.markets) {
      const odds: Record<string, number> = {};
      Object.entries(event.markets as Record<string, any>).forEach(([marketKey, marketData]: [string, any]) => {
        if (marketData.outcomes) {
          marketData.outcomes.forEach((outcome: any) => {
            odds[`${marketKey}-${outcome.name}`] = outcome.price;
          });
        }
      });
      return odds;
    }

    return {};
  } catch (err) {
    console.error(`[OddsWS] Error fetching odds for ${eventId}:`, err);
    return {};
  }
}

async function checkEventStatus(eventId: string): Promise<EventStatus> {
  try {
    // Check if we have cached status
    const cached = eventStatusCache.get(eventId);
    if (cached && Date.now() - (cached as any).cachedAt < 30000) { // 30s cache
      return cached;
    }

    const { data: event } = await supabase
      .from('cached_events')
      .select('begin, status')
      .eq('id', eventId)
      .single();

    if (!event) {
      return { eventId, status: 'suspended' };
    }

    const now = Math.floor(Date.now() / 1000);
    const beginTime = event.begin || 0;
    const status: EventStatus = {
      eventId,
      status: event.status || 'upcoming',
      startTime: beginTime ? new Date(beginTime * 1000).toISOString() : undefined,
    };

    // Auto-detect if event should be locked
    if (beginTime && now >= beginTime - LOCK_BEFORE_START) {
      status.status = 'suspended';
    }

    (status as any).cachedAt = Date.now();
    eventStatusCache.set(eventId, status);
    return status;
  } catch (err) {
    console.error(`[OddsWS] Error checking event status for ${eventId}:`, err);
    return { eventId, status: 'suspended' };
  }
}

function startPolling(namespace: any) {
  setInterval(async () => {
    // Get all unique event IDs being tracked
    const allEventIds = new Set<string>();
    clientSubscriptions.forEach(eventIds => {
      eventIds.forEach(id => allEventIds.add(id));
    });

    if (allEventIds.size === 0) return;

    // Check for odds updates on each event
    for (const eventId of allEventIds) {
      try {
        const currentOdds = await fetchCurrentOdds(eventId);
        const cachedOdds = eventOddsCache.get(eventId);
        const status = await checkEventStatus(eventId);

        // Check for status changes (event starting)
        if (status.status === 'suspended' || status.status === 'live') {
          // Find clients subscribed to this event
          const affectedClients: string[] = [];
          clientSubscriptions.forEach((eventIds, socketId) => {
            if (eventIds.has(eventId)) {
              affectedClients.push(socketId);
            }
          });

          // Notify clients that event is locked
          affectedClients.forEach(socketId => {
            const socket = namespace.sockets.get(socketId);
            if (socket) {
              socket.emit('event:locked', {
                eventId,
                status: status.status,
                reason: status.status === 'live' ? 'Event started' : 'Event about to start',
                timestamp: Date.now(),
              });
            }
          });

          // Clear from cache to stop tracking
          eventOddsCache.delete(eventId);
          continue;
        }

        // Check for odds changes
        if (cachedOdds) {
          const changes: OddsUpdate[] = [];

          Object.entries(currentOdds).forEach(([key, newOdds]) => {
            const oldOdds = cachedOdds.get(key);
            if (oldOdds && Math.abs(oldOdds - newOdds) > 0.01) { // Significant change
              const [market, outcome] = key.split('-');
              changes.push({
                eventId,
                market,
                outcome,
                oldOdds,
                newOdds,
                timestamp: Date.now(),
              });
            }
          });

          if (changes.length > 0) {
            // Find clients subscribed to this event
            const affectedClients: string[] = [];
            clientSubscriptions.forEach((eventIds, socketId) => {
              if (eventIds.has(eventId)) {
                affectedClients.push(socketId);
              }
            });

            // Broadcast changes
            affectedClients.forEach(socketId => {
              const socket = namespace.sockets.get(socketId);
              if (socket) {
                changes.forEach(change => {
                  socket.emit('odds:change', change);
                });
              }
            });

            console.log(`[OddsWS] Broadcast ${changes.length} odds changes for event ${eventId}`);
          }
        }

        // Update cache
        if (!eventOddsCache.has(eventId)) {
          eventOddsCache.set(eventId, new Map());
        }
        const cache = eventOddsCache.get(eventId)!;
        Object.entries(currentOdds).forEach(([key, value]) => {
          cache.set(key, value);
        });

      } catch (err) {
        console.error(`[OddsWS] Polling error for event ${eventId}:`, err);
      }
    }
  }, POLLING_INTERVAL);

  console.log(`[OddsWS] Started polling every ${POLLING_INTERVAL}ms`);
}

// Cleanup function for when server shuts down
export function cleanupOddsWebSocket() {
  clientSubscriptions.clear();
  eventOddsCache.clear();
  eventStatusCache.clear();
  console.log('[OddsWS] Cleaned up');
}
