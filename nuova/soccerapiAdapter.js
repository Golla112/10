const axios = require('axios');

// Configurazione microservizio soccerapi
const SOCCERAPI_URL = process.env.SOCCERAPI_URL || 'http://localhost:5001';

/**
 * Recupera quote reali da bookmakers tramite soccerapi
 * @param {string} country - es: 'italy', 'england', 'spain'
 * @param {string} league - es: 'serie_a', 'premier_league'
 * @param {string} bookmaker - 'bet365', 'bwin', 'all'
 */
async function getRealOdds(country, league, bookmaker = 'bet365') {
  try {
    const endpoint = bookmaker === 'all' 
      ? `/api/odds/all/${country}/${league}`
      : `/api/odds/${bookmaker}/${country}/${league}`;
    
    const response = await axios.get(`${SOCCERAPI_URL}${endpoint}`, {
      timeout: 15000
    });
    
    if (response.data.success) {
      return transformSoccerapiOdds(response.data.data, bookmaker);
    }
    return null;
  } catch (error) {
    console.error('SoccerAPI error:', error.message);
    return null;
  }
}

/**
 * Trasforma dati soccerapi nel formato della tua API
 */
function transformSoccerapiOdds(apiData, source) {
  const events = [];
  
  // Gestisci formato diverso se 'all' o singolo bookmaker
  const dataArray = Array.isArray(apiData) ? apiData : 
    (apiData.bet365 || apiData[Object.keys(apiData)[0]]);
  
  if (!Array.isArray(dataArray)) return events;
  
  dataArray.forEach(match => {
    const eventId = `sa-${match.id || Math.random().toString(36).substr(2, 9)}`;
    
    // Estrai squadre
    const homeTeam = match.home_team || match.home || 'Home';
    const awayTeam = match.away_team || match.away || 'Away';
    
    // Estrai quote 1X2
    const odds1X2 = match.odds_1x2 || match.full_time_result || {};
    const homeOdd = parseFloat(odds1X2.home || odds1X2['1'] || 0);
    const drawOdd = parseFloat(odds1X2.draw || odds1X2['X'] || 0);
    const awayOdd = parseFloat(odds1X2.away || odds1X2['2'] || 0);
    
    if (homeOdd && awayOdd) {
      const event = {
        id: eventId,
        sport: 'football',
        competition: match.league || 'Unknown',
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        startTime: new Date(match.date || match.kick_off || Date.now()).getTime(),
        status: 'prematch',
        source: `soccerapi-${source}`,
        odds: {
          '1X2': {
            '1': { odd: homeOdd, status: 'active' },
            'X': { odd: drawOdd || 0, status: drawOdd ? 'active' : 'suspended' },
            '2': { odd: awayOdd, status: 'active' },
            __meta: { status: 'active', source: source }
          }
        }
      };
      
      // Aggiungi altri mercati se disponibili
      if (match.odds_over_under || match.over_under) {
        const ou = match.odds_over_under || match.over_under;
        event.odds['over_under_2_5'] = {
          'Over': { odd: parseFloat(ou.over || ou.over_2_5 || 2.0), status: 'active' },
          'Under': { odd: parseFloat(ou.under || ou.under_2_5 || 1.9), status: 'active' },
          __meta: { status: 'active' }
        };
      }
      
      events.push(event);
    }
  });
  
  return events;
}

/**
 * Fallback se soccerapi non disponibile
 */
async function getOddsWithFallback(country, league) {
  // Prova soccerapi
  const soccerapiOdds = await getRealOdds(country, league, 'bet365');
  if (soccerapiOdds && soccerapiOdds.length > 0) {
    return soccerapiOdds;
  }
  
  // Fallback a API esterne gratuite
  console.log('SoccerAPI non disponibile, uso fallback...');
  return null;
}

module.exports = {
  getRealOdds,
  getOddsWithFallback,
  SOCCERAPI_URL
};
