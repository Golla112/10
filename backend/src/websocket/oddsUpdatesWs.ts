import { WebSocket } from 'ws';
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
const clientSubscriptions = new Map<WebSocket, Set<string>>();
const eventOddsCache = new Map<string, Map<string, number>>();
const eventStatusCache = new Map<string, EventStatus>();

// Polling configuration
const POLLING_INTERVAL = 5000;
const LOCK_BEFORE_START = 300; // 5 minutes before event starts

let pollingInterval: NodeJS.Timeout | null = null;

export function setupOddsUpdatesWebSocket(wss: any) {
  // Handle new connections on /ws/odds path
  wss.on('connection', (ws: WebSocket, req: any) => {
    // Only handle /ws/odds connections
    if (!req.url?.includes('/ws/odds')) {
      return;
    }

    console.log('[OddsWS] Client connected to odds updates');
    clientSubscriptions.set(ws, new Set());

    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'subscribe':
            await handleSubscribe(ws, message.eventIds);
            break;
          case 'unsubscribe':
            handleUnsubscribe(ws, message.eventIds);
            break;
        }
      } catch (err) {
        console.error('[OddsWS] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[OddsWS] Client disconnected');
      clientSubscriptions.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[OddsWS] WebSocket error:', err);
      clientSubscriptions.delete(ws);
    });
  });

  // Start polling
  startPolling(wss);

  return wss;
}

async function handleSubscribe(ws: WebSocket, eventIds: string[]) {
  console.log('[OddsWS] Client subscribing to events:', eventIds);
  
  const currentSubs = clientSubscriptions.get(ws) || new Set();
  eventIds.forEach(id => currentSubs.add(id));
  clientSubscriptions.set(ws, currentSubs);

  // Send current odds immediately
  for (const eventId of eventIds) {
    const currentOdds = await fetchCurrentOdds(eventId);
    const status = await checkEventStatus(eventId);
    
    ws.send(JSON.stringify({
      type: 'odds:initial',
      eventId,
      odds: currentOdds,
      status,
    }));

    // Cache the odds
    if (!eventOddsCache.has(eventId)) {
      eventOddsCache.set(eventId, new Map());
    }
    const cache = eventOddsCache.get(eventId)!;
    Object.entries(currentOdds).forEach(([key, value]) => {
      cache.set(key, value as number);
    });
  }
}

function handleUnsubscribe(ws: WebSocket, eventIds: string[]) {
  console.log('[OddsWS] Client unsubscribing from events:', eventIds);
  const currentSubs = clientSubscriptions.get(ws);
  if (currentSubs) {
    eventIds.forEach(id => currentSubs.delete(id));
  }
}

async function fetchCurrentOdds(eventId: string): Promise<Record<string, number>> {
  try {
    // Try to get from xcodetec live service
    const { data: event } = await supabase
      .from('cached_events')
      .select('bookmakers')
      .eq('id', eventId)
      .single();

    if (event?.bookmakers) {
      const odds: Record<string, number> = {};
      
      // Extract H2H odds
      for (const bookmaker of event.bookmakers as any[]) {
        for (const market of bookmaker.markets || []) {
          if (market.key === 'h2h' && market.outcomes) {
            for (const outcome of market.outcomes) {
              const key = `h2h-${outcome.name}`;
              odds[key] = outcome.price;
            }
          }
        }
      }
      
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
    const cached = eventStatusCache.get(eventId);
    if (cached && (Date.now() - (cached as any).cachedAt) < 30000) {
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
    
    let status: EventStatus['status'] = event.status || 'upcoming';
    
    // Auto-lock before event starts
    if (beginTime && now >= beginTime - LOCK_BEFORE_START) {
      status = 'suspended';
    }

    const result: EventStatus = {
      eventId,
      status,
      startTime: beginTime ? new Date(beginTime * 1000).toISOString() : undefined,
    };

    (result as any).cachedAt = Date.now();
    eventStatusCache.set(eventId, result);
    return result;
  } catch (err) {
    console.error(`[OddsWS] Error checking event status for ${eventId}:`, err);
    return { eventId, status: 'suspended' };
  }
}

function startPolling(wss: any) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  pollingInterval = setInterval(async () => {
    // Get all unique event IDs being tracked
    const allEventIds = new Set<string>();
    clientSubscriptions.forEach(eventIds => {
      eventIds.forEach(id => allEventIds.add(id));
    });

    if (allEventIds.size === 0) return;

    for (const eventId of allEventIds) {
      try {
        const currentOdds = await fetchCurrentOdds(eventId);
        const cachedOdds = eventOddsCache.get(eventId);
        const status = await checkEventStatus(eventId);

        // Check for locked events
        if (status.status === 'suspended' || status.status === 'live') {
          const lockMessage = JSON.stringify({
            type: 'event:locked',
            eventId,
            status: status.status,
            reason: status.status === 'live' ? 'Event started' : 'Event about to start',
            timestamp: Date.now(),
          });

          // Notify all subscribed clients
          clientSubscriptions.forEach((eventIds, ws) => {
            if (eventIds.has(eventId) && ws.readyState === WebSocket.OPEN) {
              ws.send(lockMessage);
            }
          });

          eventOddsCache.delete(eventId);
          continue;
        }

        // Check for odds changes
        if (cachedOdds) {
          const changes: OddsUpdate[] = [];

          Object.entries(currentOdds).forEach(([key, newOdds]) => {
            const oldOdds = cachedOdds.get(key);
            if (oldOdds && Math.abs(oldOdds - newOdds) > 0.01) {
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
            const updateMessage = JSON.stringify({
              type: 'odds:update',
              changes,
            });

            // Broadcast to subscribed clients
            clientSubscriptions.forEach((eventIds, ws) => {
              if (eventIds.has(eventId) && ws.readyState === WebSocket.OPEN) {
                ws.send(updateMessage);
              }
            });

            console.log(`[OddsWS] Broadcast ${changes.length} changes for ${eventId}`);
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
        console.error(`[OddsWS] Polling error for ${eventId}:`, err);
      }
    }
  }, POLLING_INTERVAL);

  console.log(`[OddsWS] Polling started: ${POLLING_INTERVAL}ms`);
}

export function stopOddsPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  clientSubscriptions.clear();
  eventOddsCache.clear();
  eventStatusCache.clear();
  console.log('[OddsWS] Stopped');
}
