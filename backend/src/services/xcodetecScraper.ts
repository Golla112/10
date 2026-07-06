// Puppeteer scraper for xcodetec live data
// Bypasses Cloudflare protection by simulating real browser

import puppeteer from 'puppeteer';
import path from 'path';

const XCODE_API_BASE = 'https://api.xcodetec.com/api';
const XCODE_ORIGIN = 'https://www.joverbet.com';

let browser: any = null;
let page: any = null;
let prematchPage: any = null;
let lastData: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

async function initBrowser() {
  if (browser && browser.isConnected?.() && page && prematchPage) return;

  // Browser instance exists but is no longer usable: reset references first.
  if (browser && !browser.isConnected?.()) {
    browser = null;
    page = null;
    prematchPage = null;
  }
  
  // Try to find Chrome executable
  let executablePath: string | undefined;
  
  // Check for Chrome in common Windows locations
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  
  for (const p of possiblePaths) {
    if (p && require('fs').existsSync(p)) {
      executablePath = p;
      console.log('[xcodetec-scraper] Found Chrome at:', p);
      break;
    }
  }
  
  if (!executablePath) {
    console.log('[xcodetec-scraper] Chrome not found, trying Puppeteer bundled Chromium...');
  }
  
  browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ]
  });
  
  page = await browser.newPage();
  
  // Set headers to mimic real browser
  await page.setExtraHTTPHeaders({
    'Accept': 'application/json',
    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
    'Origin': XCODE_ORIGIN,
    'Referer': `${XCODE_ORIGIN}/`,
    'Skin-Language': 'it-IT',
    'Skin-TZ': 'Europe/Rome',
    'Authorization': 'Bearer null',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
  });

  // Pagina separata per prematch (evita conflitti con live)
  prematchPage = await browser.newPage();
  await prematchPage.setExtraHTTPHeaders({
    'Accept': 'application/json',
    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
    'Origin': XCODE_ORIGIN,
    'Referer': `${XCODE_ORIGIN}/`,
    'Skin-Language': 'it-IT',
    'Skin-TZ': 'Europe/Rome',
    'Authorization': 'Bearer null',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
  });
}

async function ensurePrematchPageReady() {
  await initBrowser();

  // Extra safety: recreate prematch page if it was closed/null while browser stayed alive.
  if (!prematchPage || prematchPage.isClosed?.()) {
    if (!browser || !browser.isConnected?.()) {
      browser = null;
      page = null;
      prematchPage = null;
      await initBrowser();
    } else {
      prematchPage = await browser.newPage();
      await prematchPage.setExtraHTTPHeaders({
        'Accept': 'application/json',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        'Origin': XCODE_ORIGIN,
        'Referer': `${XCODE_ORIGIN}/`,
        'Skin-Language': 'it-IT',
        'Skin-TZ': 'Europe/Rome',
        'Authorization': 'Bearer null',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
      });
    }
  }
}

export async function fetchLiveSnapshot(): Promise<any[]> {
  const now = Date.now();
  
  // Return cached data if fresh
  if (now - lastFetchTime < CACHE_TTL && lastData.length > 0) {
    return lastData;
  }
  
  try {
    await ensurePrematchPageReady();
    
    // Navigate to API endpoint
    const response = await page.goto(`${XCODE_API_BASE}/live/snapshot`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    if (!response || response.status() !== 200) {
      console.log(`[xcodetec-scraper] HTTP ${response?.status() || 'error'}`);
      return lastData; // Return stale data on error
    }
    
    // Get response body
    const body = await response.text();
    const json = JSON.parse(body);
    
    // Log data structure for debugging
    if (json.data && typeof json.data === 'object') {
      const dataKeys = Object.keys(json.data);
      console.log(`[xcodetec-scraper] Snapshot data keys: ${dataKeys.join(', ')}`);
      
      // Check for events_labels (new structure)
      if (json.data.events_labels) {
        const eventCount = Object.keys(json.data.events_labels).length;
        console.log(`[xcodetec-scraper] Found events_labels with ${eventCount} events`);
      }
      // Check for events_markets
      if (json.data.events_markets) {
        const marketCount = Object.keys(json.data.events_markets).length;
        console.log(`[xcodetec-scraper] Found events_markets with ${marketCount} events with markets`);
      }
    }
    
    if (json.data) {
      // Extract events from nested structure
      const events = extractEvents(json.data);
      
      // Check if events have odds
      const eventsWithOdds = events.filter(e => e.odds && e.odds.length > 0).length;
      console.log(`[xcodetec-scraper] Extracted ${events.length} live events, ${eventsWithOdds} with odds`);
      
      // Log first event with odds for verification
      const firstWithOdds = events.find(e => e.odds && e.odds.length > 0);
      if (firstWithOdds) {
        console.log(`[xcodetec-scraper] Sample: ${firstWithOdds.home} vs ${firstWithOdds.away}, ${firstWithOdds.odds.length} markets`);
      }
      
      lastData = events;
      lastFetchTime = now;
      return events;
    }
    
    return [];
  } catch (error) {
    console.error('[xcodetec-scraper] Error:', error);
    return lastData; // Return stale data on error
  }
}

function extractEvents(data: any): any[] {
  const events: any[] = [];
  
  // NEW: xcodetec snapshot structure has events_labels and events_markets
  if (data.events_labels && data.events_markets) {
    const eventsLabels = data.events_labels;
    const eventsMarkets = data.events_markets;
    const markets = data.markets || {};
    const tournaments = data.tournaments || {};
    const sports = data.sports || {};
    
    // DEBUG: Log available markets metadata
    const marketIds = Object.keys(markets).slice(0, 10);
    console.log(`[xcodetec-scraper] DEBUG Available markets: ${marketIds.map(id => `${id}=${markets[id]?.label || markets[id]?.name || '?'}`).join(', ')}`);
    
    // DEBUG: Log structure of events_markets
    const sampleEventIds = Object.keys(eventsMarkets).slice(0, 3);
    console.log(`[xcodetec-scraper] DEBUG Sample event IDs with markets: ${sampleEventIds.join(', ')}`);
    
    if (sampleEventIds.length > 0) {
      const firstEventId = sampleEventIds[0];
      const eventMarketIds = Object.keys(eventsMarkets[firstEventId]);
      console.log(`[xcodetec-scraper] DEBUG Event ${firstEventId} has ${eventMarketIds.length} markets: ${eventMarketIds.map(id => `${id}=${markets[id]?.label || markets[id]?.name || '?'}${markets[id]?.group_label ? ` (${markets[id]?.group_label})` : ''}`).join(', ')}`);
    }
    
    // DEBUG: Check first event from labels
    const firstLabelEventId = Object.keys(eventsLabels)[0];
    console.log(`[xcodetec-scraper] DEBUG First label event ID: ${firstLabelEventId}, has markets? ${!!eventsMarkets[firstLabelEventId]}`);
    
    let totalOddsCount = 0;
    
    for (const eventId of Object.keys(eventsLabels)) {
      const event = eventsLabels[eventId];
      const eventMarkets = eventsMarkets[eventId];
      
      // Build odds array from events_markets
      const odds: any[] = [];
      if (eventMarkets) {
        for (const marketId of Object.keys(eventMarkets)) {
          const marketData = eventMarkets[marketId];
          const marketInfo = markets[marketId];
          
          if (marketData && marketData.odds) {
            // Parse odds - they come in various formats
            const outcomes = parseOddsData(marketData.odds);
            if (outcomes.length > 0) {
              odds.push({
                key: marketInfo?.label || marketInfo?.name || `market_${marketId}`,
                name: marketInfo?.label || marketInfo?.name || 'Market',
                market_id: marketId,
                outcomes
              });
            }
          }
        }
      }
      
      if (odds.length > 0) totalOddsCount++;
      
      const tournament = tournaments[event.tournament_id?.toString()] || {};
      const sport = sports[event.sport_id?.toString()] || {};
      
      events.push({
        id: event.id || eventId,
        home: event.home || 'Home',
        away: event.away || 'Away',
        league: tournament.label || tournament.name || 'Live',
        sport: sport.label || sport.name || 'soccer',
        startTs: event.begin || Math.floor(Date.now() / 1000),
        minute: event.timer || event.live_minute || null,
        scoreHome: event.score ? parseInt(event.score.split(':')[0]) : null,
        scoreAway: event.score ? parseInt(event.score.split(':')[1]) : null,
        odds: odds,
        phase: event.phase,
        result: event.result,
        widget: event.widget
      });
    }
    
    console.log(`[xcodetec-scraper] DEBUG Total events with odds: ${totalOddsCount}/${events.length}`);
    return events;
  }
  
  // FALLBACK: Recursive function to find events (old structure)
  function traverse(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    
    // Check if this is an event object
    if ((obj.home_team || obj.home) && (obj.event_id || obj.id)) {
      events.push({
        id: obj.event_id || obj.id || obj.tracker_id,
        home: obj.home_team || obj.home || 'Home',
        away: obj.away_team || obj.away || 'Away',
        league: obj.tournament_title || obj.league_title || obj.category_title || 'Live',
        sport: obj.sport_key || obj.sport || 'soccer',
        startTs: obj.start_date ? new Date(obj.start_date).getTime() / 1000 : Math.floor(Date.now() / 1000),
        minute: obj.live_minute || obj.minute || null,
        scoreHome: obj.home_score ?? null,
        scoreAway: obj.away_score ?? null,
        odds: obj.odds || obj.markets || obj.live_markets || obj.main_markets || obj.available_markets || []
      });
      return;
    }
    
    // Recurse into arrays and objects
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value)) {
        value.forEach(traverse);
      } else if (typeof value === 'object') {
        traverse(value);
      }
    }
  }
  
  traverse(data);
  return events;
}

// Parse odds data from xcodetec format: odds._ -> {id, value, locked}
function parseOddsData(oddsData: any): any[] {
  const outcomes: any[] = [];
  
  if (!oddsData) return outcomes;
  
  // xcodetec format: odds = { _: { outcomeId: { id, value, locked, code, unique }, ... } }
  const outcomesObj = oddsData._ || oddsData;
  
  if (typeof outcomesObj === 'object' && !Array.isArray(outcomesObj)) {
    for (const key of Object.keys(outcomesObj)) {
      const item = outcomesObj[key];
      if (typeof item === 'object' && item.value) {
        outcomes.push({
          name: item.outcome || `Outcome ${key}`,
          price: parseFloat(item.value),
          id: item.id,
          locked: item.locked
        });
      }
    }
  }
  // Fallback: array format
  else if (Array.isArray(outcomesObj)) {
    for (const item of outcomesObj) {
      if (typeof item === 'object' && (item.value || item.price)) {
        outcomes.push({
          name: item.name || item.label || item.outcome || 'Outcome',
          price: parseFloat(item.value || item.price || item.odd || '0'),
          id: item.id,
          locked: item.locked
        });
      }
    }
  }
  
  return outcomes.filter(o => o.price > 1);
}

// Rate limiting for odds requests
let lastOddsRequestTime = 0;
const ODDS_REQUEST_DELAY = 1000; // 1 second between requests
const MAX_ODDS_FETCHES = 10; // Limit to avoid rate limit

// Fetch real odds for event from xcodetec
async function fetchEventOdds(eventId: string): Promise<any[]> {
  try {
    if (!page) return [];
    
    // Rate limiting - wait between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastOddsRequestTime;
    if (timeSinceLastRequest < ODDS_REQUEST_DELAY) {
      await new Promise(r => setTimeout(r, ODDS_REQUEST_DELAY - timeSinceLastRequest));
    }
    lastOddsRequestTime = Date.now();
    
    const url = `${XCODE_API_BASE}/sport/event/${eventId}/odds`;
    console.log(`[xcodetec-scraper] Fetching odds for event ${eventId}`);
    
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    
    if (!response) {
      console.log(`[xcodetec-scraper] No response for odds ${eventId}`);
      return [];
    }
    
    if (response.status() === 429) {
      console.log(`[xcodetec-scraper] Rate limited (429) for odds ${eventId}`);
      return [];
    }
    
    if (response.status() !== 200) {
      console.log(`[xcodetec-scraper] HTTP ${response.status()} for odds ${eventId}`);
      return [];
    }
    
    const body = await response.text();
    console.log(`[xcodetec-scraper] Odds response for ${eventId}: ${body.substring(0, 200)}...`);
    
    const json = JSON.parse(body);
    
    // Extract odds markets from response
    const markets: any[] = [];
    if (json.data && Array.isArray(json.data.markets)) {
      for (const m of json.data.markets) {
        if (m.outcomes && Array.isArray(m.outcomes)) {
          markets.push({
            key: m.key || m.market_key || 'h2h',
            name: m.name || m.label,
            outcomes: m.outcomes.map((o: any) => ({
              name: o.name || o.label || o.value,
              price: parseFloat(o.price || o.odd || o.value || '0')
            })).filter((o: any) => o.price > 1)
          });
        }
      }
    }
    
    console.log(`[xcodetec-scraper] Fetched ${markets.length} markets for event ${eventId}`);
    return markets;
  } catch (err) {
    console.error(`[xcodetec-scraper] Error fetching odds for ${eventId}:`, err);
    return [];
  }
}

// Convert scraped events to BetStack format
export async function convertToBetStackEvents(events: any[]): Promise<any[]> {
  const results: any[] = [];
  
  // Count events with odds for logging
  let eventsWithOdds = 0;
  let totalMarkets = 0;
  
  for (const event of events) {
    // Convert odds from the new snapshot structure
    const markets: any[] = [];
    
    if (Array.isArray(event.odds) && event.odds.length > 0) {
      for (const market of event.odds) {
        if (market.outcomes && market.outcomes.length > 0) {
          markets.push({
            key: market.key || market.name || 'h2h',
            name: market.name || market.key || 'Match Result',
            outcomes: market.outcomes.map((o: any) => ({
              name: o.name,
              price: o.price
            }))
          });
        }
      }
    }
    
    if (markets.length > 0) {
      eventsWithOdds++;
      totalMarkets += markets.length;
    }
    
    results.push({
      id: `xc_live_${event.id}`,
      home: { name: event.home },
      away: { name: event.away },
      time: event.startTs,
      live: true,
      sport_category: event.sport?.toLowerCase() || 'soccer',
      league: { name: event.league },
      minute: event.minute,
      score: event.scoreHome != null || event.scoreAway != null
        ? { home: event.scoreHome, away: event.scoreAway }
        : undefined,
      bookmakers: [{ key: 'xcodetec', title: 'Xcodetec', markets }]
    });
  }
  
  console.log(`[xcodetec-scraper] Converted ${events.length} events, ${eventsWithOdds} with odds (${totalMarkets} total markets)`);
  return results;
}

// Cleanup function
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    prematchPage = null;
  }
}

// ── Prematch via calendar endpoint ───────────────────────────────────────────

let lastPrematchData: any[] = [];
let lastPrematchFetchTime = 0;
const PREMATCH_CACHE_TTL = 3 * 60 * 1000; // 3 minuti

export async function fetchPrematchFromCalendar(): Promise<any[]> {
  const now = Date.now();
  if (now - lastPrematchFetchTime < PREMATCH_CACHE_TTL && lastPrematchData.length > 0) {
    return lastPrematchData;
  }

  try {
    const prematchHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      'Origin': XCODE_ORIGIN,
      'Referer': `${XCODE_ORIGIN}/`,
      'Skin-Language': 'it-IT',
      'Skin-TZ': 'Europe/Rome',
      'Authorization': 'Bearer null',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0'
    };
    const getJson = async (path: string) => {
      const res = await fetch(`${XCODE_API_BASE}${path}`, { headers: prematchHeaders });
      if (!res.ok) return null;
      const json = await res.json() as any;
      return (json.data ?? json) as any;
    };

    // Step 1: carica il calendar (eventi senza quote)
    const data = await getJson('/live/calendar');
    if (!data) {
      console.log('[xcodetec-scraper] calendar HTTP error');
      return lastPrematchData;
    }

    // Struttura: { events: { id: {id, home, away, tournament_id, begin, sport_id, ...} }, tournaments, categories, sports }
    const eventsMap: Record<string, any> = data.events ?? {};
    const tournamentsMap: Record<string, any> = data.tournaments ?? {};
    const sportsMap: Record<string, any> = data.sports ?? {};

    if (Object.keys(eventsMap).length === 0) {
      console.log('[xcodetec-scraper] calendar: nessun evento');
      return lastPrematchData;
    }

    // Step 2: raggruppa eventi per tournament_id
    const byTournament = new Map<number, any[]>();
    for (const ev of Object.values(eventsMap)) {
      const tid = ev.tournament_id;
      if (!tid) continue;
      if (!byTournament.has(tid)) byTournament.set(tid, []);
      byTournament.get(tid)!.push(ev);
    }

    console.log(`[xcodetec-scraper] calendar: ${Object.keys(eventsMap).length} eventi in ${byTournament.size} tornei`);

    // Step 3: fetcha config per ottenere i market group ID corretti per sport
    let sportGroupMap: Record<number, number> = {}; // sport_id → group_id principale
    try {
      const cfgData = await getJson('/sport/config');
      if (cfgData) {
        const marketgroups: any[] = cfgData.marketgroups ?? [];
        for (const g of marketgroups) {
          if (g.main && g.sport_id && !sportGroupMap[g.sport_id]) {
            sportGroupMap[g.sport_id] = g.id;
          }
        }
        console.log(`[xcodetec-scraper] sport config: ${Object.keys(sportGroupMap).length} sport con group principale`);
      }
    } catch { /* usa fallback */ }

    // Step 4: fetcha quote per ogni torneo via Puppeteer (bypassa 429)
    const allEvents: any[] = [];
    let torneiProcessati = 0;

    for (const [tournamentId, events] of byTournament) {
      try {
        // Usa il group ID principale per lo sport dell'evento, fallback a 4.
        const sportId = events[0]?.sport_id;
        const preferredGroupId = (sportId && sportGroupMap[sportId]) ? sportGroupMap[sportId] : 4;
        const fetchTournament = async (groupId: number) => await getJson(`/sport/tournament/${tournamentId}/${groupId}`);

        let tData = await fetchTournament(preferredGroupId);
        if (!tData) {
          // Aggiungi eventi senza quote
          for (const ev of events) {
            const sport = sportsMap[ev.sport_id?.toString()];
            const tournament = tournamentsMap[ev.tournament_id?.toString()];
            allEvents.push({
              id: `xc_${ev.id}`,
              home: { name: ev.home },
              away: { name: ev.away },
              time: ev.begin,
              live: false,
              sport_category: normalizeSportCat(sport?.label ?? ''),
              league: { name: tournament?.label ?? 'Prematch' },
              bookmakers: [],
            });
          }
          continue;
        }

        // Se il gruppo preferito non contiene mercati, prova fallback gruppo 4 (es. calcio).
        const hasMarketsPreferred = Array.isArray(tData?.events)
          ? tData.events.some((x: any) => Array.isArray(x?.markets) && x.markets.length > 0)
          : Object.values(tData?.events ?? {}).some((x: any) => Array.isArray(x?.markets) && x.markets.length > 0);
        if (!hasMarketsPreferred && preferredGroupId !== 4) {
          const fallbackData = await fetchTournament(4);
          if (fallbackData) tData = fallbackData;
        }

        // Log struttura primo torneo per debug (solo una volta)
        if (torneiProcessati === 0) {
          const tDataKeys = Object.keys(tData);
          console.log(`[xcodetec-scraper] torneo sample keys: ${tDataKeys.join(', ')}`);
          const firstEvKey = Object.keys(tData.events ?? {})[0];
          if (firstEvKey) {
            const firstEv = tData.events[firstEvKey];
            console.log(`[xcodetec-scraper] torneo first event keys: ${Object.keys(firstEv).join(', ')}`);
            console.log(`[xcodetec-scraper] torneo first event sample: ${JSON.stringify(firstEv).slice(0, 600)}`);
          }
          if (tData.marketgroups) {
            console.log(`[xcodetec-scraper] torneo marketgroups sample: ${JSON.stringify(tData.marketgroups).slice(0, 300)}`);
          }
        }

        // Struttura torneo: tData.events può essere array oppure object keyed by ID.
        const tEventsRaw = tData.events ?? {};
        const tEventsById = new Map<string, any>();
        if (Array.isArray(tEventsRaw)) {
          for (const tev of tEventsRaw) {
            if (tev?.id != null) tEventsById.set(String(tev.id), tev);
          }
        } else if (typeof tEventsRaw === 'object') {
          for (const [k, v] of Object.entries(tEventsRaw)) {
            tEventsById.set(String(k), v);
            const innerId = (v as any)?.id;
            if (innerId != null) tEventsById.set(String(innerId), v);
          }
        }

        for (const ev of events) {
          const tEv = tEventsById.get(ev.id?.toString());
          const sport = sportsMap[ev.sport_id?.toString()];
          const tournament = tournamentsMap[ev.tournament_id?.toString()];
          const markets: any[] = [];

          if (tEv?.markets) {
            // Struttura: markets è un array di { id, odds: [{id, value, locked, ...}] }
            const mktArray: any[] = Array.isArray(tEv.markets) ? tEv.markets : Object.values(tEv.markets);
            for (const market of mktArray) {
              const outcomes = parseOddsData(market.odds);
              if (outcomes.length > 0) {
                markets.push({
                  key: `market_${market.id}`,
                  outcomes,
                });
              }
            }
          }

          allEvents.push({
            id: `xc_${ev.id}`,
            home: { name: ev.home },
            away: { name: ev.away },
            time: ev.begin,
            live: false,
            sport_category: normalizeSportCat(sport?.label ?? ''),
            league: { name: tournament?.label ?? 'Prematch' },
            bookmakers: markets.length > 0 ? [{ key: 'xcodetec', title: 'Xcodetec', markets }] : [],
          });
        }

        torneiProcessati++;
        // Pausa minima tra tornei
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        // Torneo non disponibile, aggiungi eventi senza quote
        for (const ev of events) {
          const sport = sportsMap[ev.sport_id?.toString()];
          const tournament = tournamentsMap[ev.tournament_id?.toString()];
          allEvents.push({
            id: `xc_${ev.id}`,
            home: { name: ev.home },
            away: { name: ev.away },
            time: ev.begin,
            live: false,
            sport_category: normalizeSportCat(sport?.label ?? ''),
            league: { name: tournament?.label ?? 'Prematch' },
            bookmakers: [],
          });
        }
      }
    }

    const withOdds = allEvents.filter(e => e.bookmakers?.length > 0 && e.bookmakers[0].markets?.length > 0).length;
    console.log(`[xcodetec-scraper] calendar: ${allEvents.length} eventi, ${withOdds} con quote (${torneiProcessati} tornei)`);

    lastPrematchData = allEvents;
    lastPrematchFetchTime = now;
    return allEvents;
  } catch (err) {
    console.error('[xcodetec-scraper] calendar error:', err);
    return lastPrematchData;
  }
}

function normalizeSportCat(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('calcio') || l.includes('football') || l.includes('soccer')) return 'soccer';
  if (l.includes('basket')) return 'basketball';
  if (l.includes('tennis')) return 'tennis';
  if (l.includes('hockey')) return 'hockey';
  if (l.includes('volley')) return 'volleyball';
  if (l.includes('rugby')) return 'rugby';
  if (l.includes('baseball')) return 'baseball';
  if (l.includes('pallamano') || l.includes('handball')) return 'handball';
  if (l.includes('mma')) return 'mma';
  if (l.includes('boxe') || l.includes('boxing')) return 'boxing';
  return l.replace(/\s+/g, '_') || 'soccer';
}
