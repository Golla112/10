const axios = require('axios');

// Solo 3 sport: Calcio, Basket, Tennis
const ALLOWED_SPORTS = ['football', 'basketball', 'tennis'];

// Configurazione Complete Sports API
const SPORTS_API_URL = process.env.SPORTS_API_URL || 'http://localhost:5002';

/**
 * Recupera tutti gli sport disponibili (solo football, basketball, tennis)
 */
async function getAllSports() {
  try {
    const response = await axios.get(`${SPORTS_API_URL}/api/sports`, { timeout: 10000 });
    if (response.data.success) {
      // Filtra solo i 3 sport consentiti
      return response.data.data.filter(sport => ALLOWED_SPORTS.includes(sport.id));
    }
    return [];
  } catch (error) {
    console.error('Error fetching sports:', error.message);
    return [];
  }
}

/**
 * Recupera tutti i campionati per uno sport
 */
async function getLeaguesBySport(sportId) {
  try {
    const response = await axios.get(`${SPORTS_API_URL}/api/sports/${sportId}/leagues`, { timeout: 10000 });
    if (response.data.success) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error(`Error fetching leagues for ${sportId}:`, error.message);
    return [];
  }
}

/**
 * Recupera tutti i mercati per uno sport
 */
async function getMarketsBySport(sportId) {
  try {
    const response = await axios.get(`${SPORTS_API_URL}/api/sports/${sportId}/markets`, { timeout: 10000 });
    if (response.data.success) {
      return response.data.markets;
    }
    return [];
  } catch (error) {
    console.error(`Error fetching markets for ${sportId}:`, error.message);
    return [];
  }
}

/**
 * Recupera eventi per una specifica lega
 */
async function getEventsByLeague(sport, country, league, count = 10) {
  try {
    const response = await axios.get(
      `${SPORTS_API_URL}/api/events/${sport}/${country}/${league}?count=${count}`,
      { timeout: 15000 }
    );
    if (response.data.success) {
      return transformEvents(response.data.data);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching events for ${sport}/${country}/${league}:`, error.message);
    return [];
  }
}

/**
 * Recupera tutti gli eventi (solo football, basketball, tennis)
 */
async function getAllEvents(limit = 200) {
  try {
    // Richiedi eventi per ogni sport singolarmente per filtrare
    let allEvents = [];
    
    for (const sport of ALLOWED_SPORTS) {
      try {
        const response = await axios.get(`${SPORTS_API_URL}/api/events/${sport}/all?limit=${Math.ceil(limit/3)}`, { timeout: 20000 });
        if (response.data.success) {
          allEvents = allEvents.concat(transformEvents(response.data.data));
        }
      } catch (e) {
        console.log(`⚠️ Error fetching ${sport} events:`, e.message);
      }
    }
    
    return allEvents;
  } catch (error) {
    console.error('Error fetching all events:', error.message);
    return [];
  }
}

/**
 * Recupera solo eventi live (solo football, basketball, tennis)
 */
async function getLiveEvents() {
  try {
    const response = await axios.get(`${SPORTS_API_URL}/api/events/live`, { timeout: 15000 });
    if (response.data.success) {
      // Filtra solo i 3 sport consentiti
      const filteredEvents = response.data.data.filter(ev => ALLOWED_SPORTS.includes(ev.sport));
      return transformEvents(filteredEvents);
    }
    return [];
  } catch (error) {
    console.error('Error fetching live events:', error.message);
    return [];
  }
}

/**
 * Cerca eventi
 */
async function searchEvents(query, sportFilter = '') {
  try {
    let url = `${SPORTS_API_URL}/api/search?q=${encodeURIComponent(query)}`;
    if (sportFilter) url += `&sport=${sportFilter}`;
    
    const response = await axios.get(url, { timeout: 15000 });
    if (response.data.success) {
      return transformEvents(response.data.data);
    }
    return [];
  } catch (error) {
    console.error('Error searching events:', error.message);
    return [];
  }
}

/**
 * Trasforma eventi dal formato API al formato interno
 */
function transformEvents(apiEvents) {
  if (!Array.isArray(apiEvents)) return [];
  
  return apiEvents.map(ev => {
    // Converte ISO string in timestamp
    const startTime = new Date(ev.startTime).getTime();
    
    return {
      id: ev.id,
      sport: ev.sport,
      competition: ev.league,
      country: ev.country,
      homeTeam: ev.homeTeam,
      awayTeam: ev.awayTeam,
      startTime: startTime,
      status: ev.status,
      score: ev.score || null,
      odds: ev.odds || {},
      availableMarkets: ev.available_markets || [],
      marketCount: ev.market_count || 0,
      source: 'complete-sports-api'
    };
  });
}

/**
 * Recupera template quote per uno sport
 */
async function getOddsTemplate(sportId) {
  try {
    const response = await axios.get(`${SPORTS_API_URL}/api/odds/${sportId}`, { timeout: 10000 });
    if (response.data.success) {
      return {
        markets: response.data.markets,
        example: response.data.odds_example
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching odds template for ${sportId}:`, error.message);
    return null;
  }
}

/**
 * Sync completo - popola lo stato con eventi da football, basketball, tennis
 */
async function syncAllSports(state) {
  console.log('🔄 Syncing Football, Basketball, Tennis...');
  
  // Ottieni eventi dai 3 sport
  const allEvents = await getAllEvents(300);
  
  // Filtra eventi per sicurezza
  const filteredEvents = allEvents.filter(ev => ALLOWED_SPORTS.includes(ev.sport));
  
  if (filteredEvents.length === 0) {
    console.log('⚠️ No events fetched from Complete Sports API');
    return { total: 0, added: 0, updated: 0, bySport: {} };
  }
  
  let added = 0;
  let updated = 0;
  
  filteredEvents.forEach(ev => {
    const existing = state.events.get(ev.id);
    
    if (!existing) {
      // Nuovo evento
      state.events.set(ev.id, {
        ...ev,
        createdAt: new Date().toISOString(),
        matchLog: []
      });
      
      // Salva quote separatamente
      if (ev.odds && Object.keys(ev.odds).length > 0) {
        state.odds.set(ev.id, ev.odds);
      }
      
      added++;
    } else {
      // Aggiorna stato
      existing.status = ev.status;
      existing.score = ev.score;
      if (ev.score) {
        state.liveScores.set(ev.id, ev.score);
      }
      updated++;
    }
  });
  
  // Ottieni anche eventi live (già filtrati)
  const liveEvents = await getLiveEvents();
  liveEvents.forEach(ev => {
    if (!state.events.has(ev.id)) {
      state.events.set(ev.id, {
        ...ev,
        createdAt: new Date().toISOString(),
        matchLog: []
      });
      if (ev.odds) state.odds.set(ev.id, ev.odds);
      if (ev.score) state.liveScores.set(ev.id, ev.score);
      added++;
    }
  });
  
  console.log(`✅ Sync complete: ${added} added, ${updated} updated`);
  console.log(`   • Football: ${getEventsBySportCount(state).football || 0}`);
  console.log(`   • Basketball: ${getEventsBySportCount(state).basketball || 0}`);
  console.log(`   • Tennis: ${getEventsBySportCount(state).tennis || 0}`);
  
  return {
    total: state.events.size,
    added,
    updated,
    bySport: getEventsBySportCount(state)
  };
}

/**
 * Conta eventi per sport
 */
function getEventsBySportCount(state) {
  const counts = {};
  state.events.forEach(ev => {
    counts[ev.sport] = (counts[ev.sport] || 0) + 1;
  });
  return counts;
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    const response = await axios.get(`${SPORTS_API_URL}/api/health`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

module.exports = {
  getAllSports,
  getLeaguesBySport,
  getMarketsBySport,
  getEventsByLeague,
  getAllEvents,
  getLiveEvents,
  searchEvents,
  getOddsTemplate,
  syncAllSports,
  healthCheck,
  SPORTS_API_URL
};
