import { BetStackEvent } from '../services/betStackService';
import { fetchSibet90Prematch } from '../services/sibet90LiveService';
import { getEvents, setEvents, acquireLock, releaseLock } from '../services/cacheService';
import { invalidateEventsIndex } from '../services/eventsIndexService';

const LOCK_KEY = 'lock:events:refresh';
const LOCK_TTL = 5 * 60;
const EVENTS_TTL = 7 * 24 * 60 * 60;

function normalizeLeagueName(name?: string): string {
  if (!name) return 'Prematch';
  return name.trim();
}

function finalizeEvents(events: BetStackEvent[]): BetStackEvent[] {
  return events.map((e) => ({
    ...e,
    live: false,
    league: { name: normalizeLeagueName(e.league?.name) },
  }));
}

export async function refreshEvents(): Promise<void> {
  const acquired = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!acquired) {
    console.log('[refresh] Lock attivo, skip');
    const existing = await getEvents();
    if (!existing || (existing as unknown[]).length === 0) {
      await releaseLock(LOCK_KEY);
      return refreshEvents();
    }
    return;
  }

  console.log('[refresh] Avvio refresh prematch...');

  try {
    let events: BetStackEvent[] = [];

    // Primary: sibet90.net prematch
    try {
      events = await fetchSibet90Prematch();
      if (events.length > 0) {
        console.log(`[refresh] sibet90: ${events.length} eventi`);
      }
    } catch (apiErr) {
      console.warn('[refresh] sibet90 fallita:', apiErr);
    }

    const finalEvents = finalizeEvents(events);

    if (finalEvents.length === 0) {
      console.warn('[refresh] Nessun evento prematch da sibet90, cache invariata');
      return;
    }

    await setEvents(finalEvents, EVENTS_TTL);
    invalidateEventsIndex();
    console.log(`[refresh] Cache prematch aggiornata: ${finalEvents.length} eventi`);
  } catch (err) {
    console.error('[refresh] errore refresh eventi:', err);
  } finally {
    await releaseLock(LOCK_KEY);
  }
}


