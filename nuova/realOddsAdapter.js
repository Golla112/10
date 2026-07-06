const axios = require('axios');

// Configurazione Real Odds API
const REAL_ODDS_API_URL = process.env.REAL_ODDS_API_URL || 'http://localhost:5001';

// Mappatura sport
const SPORT_MAP = {
  'football': 'football',
  'basketball': 'basketball', 
  'tennis': 'tennis',
  'calcio': 'football',
  'basket': 'basketball'
};

/**
 * Recupera quote reali da Bet365 per calcio
 * @param {string} country - italy, england, spain, germany, france
 * @param {string} league - serie_a, premier_league, la_liga, bundesliga, ligue_1
 * @param {string} bookmaker - bet365, bwin, unibet (default: bet365)
 */
async function getFootballOdds(country = 'italy', league = 'serie_a', bookmaker = 'bet365') {
  try {
    const url = `${REAL_ODDS_API_URL}/api/odds/football/${bookmaker}/${country}/${league}`;
    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.data.success) {
      return {
        success: true,
        source: response.data.bookmaker || bookmaker,
        isReal: response.data.data.some(e => e.is_real),
        events: response.data.data,
        count: response.data.count
      };
    }
    
    return { success: false, error: 'Failed to fetch odds', events: [] };
  } catch (error) {
    console.error(`❌ Error fetching football odds:`, error.message);
    return { success: false, error: error.message, events: [] };
  }
}

/**
 * Recupera quote per basket
 * @param {string} league - nba, euroleague, ncaa
 */
async function getBasketballOdds(league = 'nba') {
  try {
    const url = `${REAL_ODDS_API_URL}/api/odds/basketball/${league}`;
    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.data.success) {
      return {
        success: true,
        source: response.data.source,
        isReal: response.data.is_real,
        events: response.data.data,
        count: response.data.count
      };
    }
    
    return { success: false, error: 'Failed to fetch odds', events: [] };
  } catch (error) {
    console.error(`❌ Error fetching basketball odds:`, error.message);
    return { success: false, error: error.message, events: [] };
  }
}

/**
 * Recupera quote per tennis
 * @param {string} tour - atp, wta, grand_slam
 */
async function getTennisOdds(tour = 'atp') {
  try {
    const url = `${REAL_ODDS_API_URL}/api/odds/tennis/${tour}`;
    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.data.success) {
      return {
        success: true,
        source: response.data.source,
        isReal: response.data.is_real,
        events: response.data.data,
        count: response.data.count
      };
    }
    
    return { success: false, error: 'Failed to fetch odds', events: [] };
  } catch (error) {
    console.error(`❌ Error fetching tennis odds:`, error.message);
    return { success: false, error: error.message, events: [] };
  }
}

/**
 * Recupera quote per tutti gli sport
 */
async function getAllOdds() {
  try {
    const url = `${REAL_ODDS_API_URL}/api/odds/all`;
    const response = await axios.get(url, { timeout: 20000 });
    
    if (response.data.success) {
      return {
        success: true,
        timestamp: response.data.timestamp,
        totalEvents: response.data.total_events,
        sportsBreakdown: response.data.sports_breakdown,
        events: response.data.data
      };
    }
    
    return { success: false, error: 'Failed to fetch all odds', events: [] };
  } catch (error) {
    console.error(`❌ Error fetching all odds:`, error.message);
    return { success: false, error: error.message, events: [] };
  }
}

/**
 * Recupera quote live
 */
async function getLiveOdds() {
  try {
    const url = `${REAL_ODDS_API_URL}/api/odds/live`;
    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.data.success) {
      return {
        success: true,
        liveCount: response.data.live_count,
        events: response.data.data
      };
    }
    
    return { success: false, error: 'Failed to fetch live odds', events: [] };
  } catch (error) {
    console.error(`❌ Error fetching live odds:`, error.message);
    return { success: false, error: error.message, events: [] };
  }
}

/**
 * Trasforma eventi nel formato interno dell'app
 */
function transformOddsToInternalFormat(events) {
  if (!Array.isArray(events)) return [];
  
  return events.map(ev => {
    const sport = SPORT_MAP[ev.sport] || ev.sport;
    
    // Estrai quote principali
    let mainOdds = {};
    if (ev.odds) {
      if (sport === 'football' && ev.odds['1X2']) {
        mainOdds = {
          home: ev.odds['1X2']['1'],
          draw: ev.odds['1X2']['X'],
          away: ev.odds['1X2']['2']
        };
      } else if (sport === 'basketball' && ev.odds.moneyline) {
        mainOdds = {
          home: ev.odds.moneyline['1'],
          away: ev.odds.moneyline['2']
        };
      } else if (sport === 'tennis' && ev.odds.match_winner) {
        mainOdds = {
          home: ev.odds.match_winner['1'],
          away: ev.odds.match_winner['2']
        };
      }
    }
    
    return {
      id: ev.id,
      sport: sport,
      competition: ev.league || ev.tour || 'Unknown',
      homeTeam: ev.homeTeam,
      awayTeam: ev.awayTeam,
      startTime: new Date(ev.startTime).getTime(),
      status: ev.status || 'prematch',
      score: ev.score || null,
      odds: ev.odds || {},
      mainOdds: mainOdds,
      isReal: ev.is_real || false,
      source: ev.source || 'unknown'
    };
  });
}

/**
 * Sincronizza quote reali nello stato dell'app
 */
async function syncRealOdds(state, options = {}) {
  console.log('🔄 Syncing REAL odds from bookmakers...');
  
  const results = {
    football: { added: 0, updated: 0 },
    basketball: { added: 0, updated: 0 },
    tennis: { added: 0, updated: 0 }
  };
  
  try {
    // 1. Calcio - Serie A da Bet365
    if (!options.sports || options.sports.includes('football')) {
      console.log('⚽ Fetching football odds...');
      const footballOdds = await getFootballOdds('italy', 'serie_a', 'bet365');
      
      if (footballOdds.success) {
        const events = transformOddsToInternalFormat(footballOdds.events);
        for (const ev of events) {
          updateEventOdds(state, ev, 'football', results);
        }
        console.log(`   ✅ Football: ${results.football.added} added, ${results.football.updated} updated`);
      }
    }
    
    // 2. Basket - NBA
    if (!options.sports || options.sports.includes('basketball')) {
      console.log('🏀 Fetching basketball odds...');
      const basketballOdds = await getBasketballOdds('nba');
      
      if (basketballOdds.success) {
        const events = transformOddsToInternalFormat(basketballOdds.events);
        for (const ev of events) {
          updateEventOdds(state, ev, 'basketball', results);
        }
        console.log(`   ✅ Basketball: ${results.basketball.added} added, ${results.basketball.updated} updated`);
      }
    }
    
    // 3. Tennis - ATP
    if (!options.sports || options.sports.includes('tennis')) {
      console.log('🎾 Fetching tennis odds...');
      const tennisOdds = await getTennisOdds('atp');
      
      if (tennisOdds.success) {
        const events = transformOddsToInternalFormat(tennisOdds.events);
        for (const ev of events) {
          updateEventOdds(state, ev, 'tennis', results);
        }
        console.log(`   ✅ Tennis: ${results.tennis.added} added, ${results.tennis.updated} updated`);
      }
    }
    
    console.log(`✅ Real odds sync complete`);
    
    return {
      success: true,
      results,
      totalAdded: results.football.added + results.basketball.added + results.tennis.added,
      totalUpdated: results.football.updated + results.basketball.updated + results.tennis.updated
    };
    
  } catch (error) {
    console.error('❌ Error syncing real odds:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna quote di un evento nello stato
 */
function updateEventOdds(state, ev, sport, results) {
  // Cerca evento esistente per nome squadre
  let existingKey = null;
  for (const [key, existing] of state.events) {
    if (existing.homeTeam === ev.homeTeam && existing.awayTeam === ev.awayTeam) {
      existingKey = key;
      break;
    }
  }
  
  if (existingKey) {
    // Aggiorna quote
    const existing = state.events.get(existingKey);
    existing.odds = ev.odds;
    existing.mainOdds = ev.mainOdds;
    existing.isReal = ev.isReal;
    existing.source = ev.source;
    
    // Salva nello stato odds
    state.odds.set(existingKey, ev.odds);
    
    results[sport].updated++;
  } else {
    // Nuovo evento
    state.events.set(ev.id, {
      ...ev,
      createdAt: new Date().toISOString(),
      matchLog: []
    });
    state.odds.set(ev.id, ev.odds);
    
    results[sport].added++;
  }
}

/**
 * Health check del servizio
 */
async function healthCheck() {
  try {
    const response = await axios.get(`${REAL_ODDS_API_URL}/health`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

module.exports = {
  getFootballOdds,
  getBasketballOdds,
  getTennisOdds,
  getAllOdds,
  getLiveOdds,
  syncRealOdds,
  transformOddsToInternalFormat,
  healthCheck,
  REAL_ODDS_API_URL
};
