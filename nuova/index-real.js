'use strict';
require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const { state } = require('./db/state');
const { broadcast, addToRoom, removeFromAllRooms, setWss } = require('./ws/broadcaster');
const { validateBet, validateMultiple, recordBet } = require('./risk/riskManager');
const { getRealOdds } = require('./soccerapiAdapter');
const { syncAllSports, getAllSports, getLeaguesBySport, getMarketsBySport } = require('./completeSportsAdapter');
const { syncRealOdds } = require('./realOddsAdapter');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION_256bit';

// Configurazione API Sportive (GRATUITE)
const SPORT_APIS = {
  football: {
    url: 'https://api.football-data.org/v4',
    key: process.env.FOOTBALL_DATA_API_KEY,
    backup: 'https://www.thesportsdb.com/api/v1/json/3'
  },
  apiFootball: {
    url: 'https://v3.football.api-sports.io',
    key: process.env.API_FOOTBALL_KEY
  }
};

// Fetch dati reali da API esterne
async function fetchRealFixtures() {
  const events = [];

  try {
    // 1. Football-Data.org (gratuito, 10 chiamate/minuto)
    if (SPORT_APIS.football.key) {
      const footballRes = await axios.get(
        `${SPORT_APIS.football.url}/matches`,
        { headers: { 'X-Auth-Token': SPORT_APIS.football.key }, timeout: 10000 }
      );

      if (footballRes.data?.matches) {
        footballRes.data.matches.forEach(m => {
          events.push({
            id: `fd-${m.id}`,
            sport: 'football',
            competition: m.competition?.code || 'UNKNOWN',
            homeTeam: m.homeTeam?.name || 'TBD',
            awayTeam: m.awayTeam?.name || 'TBD',
            startTime: new Date(m.utcDate).getTime(),
            status: mapStatus(m.status),
            score: m.score?.fullTime ? {
              home: m.score.fullTime.home,
              away: m.score.fullTime.away
            } : null,
            source: 'football-data.org'
          });
        });
      }
    }

    // 2. TheSportsDB (completamente gratuito, no API key)
    try {
      const sportsDbRes = await axios.get(
        `${SPORT_APIS.football.backup}/eventsnextleague.php?id=4328`,
        { timeout: 10000 }
      );

      if (sportsDbRes.data?.events) {
        sportsDbRes.data.events.forEach(e => {
          events.push({
            id: `tsdb-${e.idEvent}`,
            sport: mapSportFromTSDB(e.strSport),
            competition: e.strLeague,
            homeTeam: e.strHomeTeam,
            awayTeam: e.strAwayTeam,
            startTime: new Date(e.strTimestamp || e.dateEvent).getTime(),
            status: e.strStatus === 'LIVE' ? 'live' : 'prematch',
            score: e.intHomeScore && e.intAwayScore ? {
              home: parseInt(e.intHomeScore),
              away: parseInt(e.intAwayScore)
            } : null,
            source: 'thesportsdb.com'
          });
        });
      }
    } catch (e) {
      console.log('TheSportsDB fetch failed:', e.message);
    }

    // 3. API-FOOTBALL (freemium, 100 chiamate/giorno gratis)
    if (SPORT_APIS.apiFootball.key) {
      const today = new Date().toISOString().split('T')[0];
      const apiFootRes = await axios.get(
        `${SPORT_APIS.apiFootball.url}/fixtures?date=${today}`,
        { headers: { 'x-apisports-key': SPORT_APIS.apiFootball.key }, timeout: 10000 }
      );

      if (apiFootRes.data?.response) {
        apiFootRes.data.response.forEach(f => {
          events.push({
            id: `af-${f.fixture.id}`,
            sport: 'football',
            competition: f.league?.name || 'UNKNOWN',
            homeTeam: f.teams?.home?.name || 'TBD',
            awayTeam: f.teams?.away?.name || 'TBD',
            startTime: new Date(f.fixture.date).getTime(),
            status: mapStatus(f.fixture.status?.short),
            score: f.goals?.home !== null ? {
              home: f.goals.home,
              away: f.goals.away
            } : null,
            source: 'api-football.com'
          });
        });
      }
    }

  } catch (error) {
    console.error('Error fetching real fixtures:', error.message);
  }

  return events;
}

function mapStatus(apiStatus) {
  const statusMap = {
    'SCHEDULED': 'prematch',
    'LIVE': 'live',
    'IN_PLAY': 'live',
    'PAUSED': 'live',
    'FINISHED': 'finished',
    'FT': 'finished',
    'NS': 'prematch',
    '1H': 'live',
    'HT': 'live',
    '2H': 'live',
    'ET': 'live',
    'P': 'live',
  };
  return statusMap[apiStatus] || 'prematch';
}

function mapSportFromTSDB(sport) {
  const map = {
    'Soccer': 'football',
    'Basketball': 'basketball',
    'Tennis': 'tennis',
    'Ice Hockey': 'hockey',
    'Baseball': 'baseball',
    'American Football': 'americanfootball',
    'Rugby': 'rugby',
    'Cricket': 'cricket',
    'Volleyball': 'volleyball',
    'MMA': 'mma',
    'ESports': 'esports'
  };
  return map[sport] || sport.toLowerCase();
}

function calcProbabilitiesFromData(homeTeam, awayTeam, sport) {
  const hash = str => str.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const homeStrength = (hash(homeTeam) % 40) + 30;
  const awayStrength = (hash(awayTeam) % 40) + 30;

  let homeProb = homeStrength / (homeStrength + awayStrength);
  let awayProb = awayStrength / (homeStrength + awayStrength);

  homeProb *= 1.15;
  awayProb *= 0.95;

  const total = homeProb + awayProb;
  homeProb /= total;
  awayProb /= total;

  const drawProb = sport === 'football' || sport === 'hockey'
    ? parseFloat((0.25 + (Math.random() * 0.1)).toFixed(3))
    : 0;

  const remaining = 1 - drawProb;

  return {
    home: parseFloat((homeProb * remaining).toFixed(3)),
    draw: drawProb,
    away: parseFloat((awayProb * remaining).toFixed(3))
  };
}

function compileOddsFromProb(probs, sport) {
  const odds = {};
  const margin = 0.05;

  if (sport === 'football' || sport === 'hockey') {
    odds['1X2'] = {
      '1': { odd: parseFloat((1 / (probs.home * (1 - margin))).toFixed(2)), status: 'active' },
      'X': { odd: parseFloat((1 / (probs.draw * (1 - margin))).toFixed(2)), status: 'active' },
      '2': { odd: parseFloat((1 / (probs.away * (1 - margin))).toFixed(2)), status: 'active' },
      __meta: { status: 'active', overround: margin * 100 }
    };
  } else {
    odds['moneyline'] = {
      '1': { odd: parseFloat((1 / (probs.home * (1 - margin))).toFixed(2)), status: 'active' },
      '2': { odd: parseFloat((1 / (probs.away * (1 - margin))).toFixed(2)), status: 'active' },
      __meta: { status: 'active', overround: margin * 100 }
    };
  }

  if (sport === 'football') {
    odds['over_under_2_5'] = {
      'Over': { odd: parseFloat((1.75 + Math.random() * 0.5).toFixed(2)), status: 'active' },
      'Under': { odd: parseFloat((1.9 + Math.random() * 0.4).toFixed(2)), status: 'active' },
      __meta: { status: 'active' }
    };

    odds['btts'] = {
      'Yes': { odd: parseFloat((1.7 + Math.random() * 0.4).toFixed(2)), status: 'active' },
      'No': { odd: parseFloat((1.8 + Math.random() * 0.4).toFixed(2)), status: 'active' },
      __meta: { status: 'active' }
    };
  }

  if (sport === 'basketball' || sport === 'americanfootball') {
    odds['spread'] = {
      'Home -4.5': { odd: 1.91, status: 'active' },
      'Away +4.5': { odd: 1.91, status: 'active' },
      __meta: { status: 'active', spread: 4.5 }
    };
  }

  return odds;
}

async function syncRealData() {
  console.log('🔄 Syncing ALL sports data...');

  // 1. Usa Complete Sports API per tutti gli sport
  try {
    const result = await syncAllSports(state);
    console.log(`✅ Complete Sports API: ${result.added} added, ${result.updated} updated`);
    
    if (result.bySport) {
      Object.entries(result.bySport).forEach(([sport, count]) => {
        console.log(`   • ${sport}: ${count} events`);
      });
    }
  } catch (e) {
    console.log('⚠️ Complete Sports API failed:', e.message);
  }

  // 2. AGGIORNA con quote REALI da bookmaker (Calcio, Basket, Tennis)
  try {
    console.log('🎯 Fetching REAL odds from bookmakers...');
    const oddsResult = await syncRealOdds(state);
    
    if (oddsResult.success) {
      console.log(`✅ Real odds synced:`);
      console.log(`   ⚽ Football: ${oddsResult.results.football.updated} updated`);
      console.log(`   🏀 Basketball: ${oddsResult.results.basketball.updated} updated`);
      console.log(`   🎾 Tennis: ${oddsResult.results.tennis.updated} updated`);
      
      // Log eventi con quote reali
      const realOddsCount = [...state.events.values()].filter(e => e.isReal).length;
      console.log(`   📊 Total events with real odds: ${realOddsCount}`);
    }
  } catch (e) {
    console.log('⚠️ Real odds sync failed:', e.message);
  }

  // 3. Fallback: soccerapi per calcio se necessario
  if (state.events.size === 0 || ![...state.events.values()].some(e => e.sport === 'football')) {
    try {
      console.log('📊 Fallback: Fetching football from soccerapi...');
      const soccerapiEvents = await getRealOdds('italy', 'serie_a', 'bet365');
      if (soccerapiEvents) {
        soccerapiEvents.forEach(ev => {
          if (!state.events.has(ev.id)) {
            state.events.set(ev.id, { ...ev, createdAt: new Date().toISOString(), matchLog: [] });
            state.odds.set(ev.id, ev.odds);
          }
        });
      }
    } catch (e) {
      console.log('⚠️ Soccerapi fallback failed');
    }
  }

  // Pulisci eventi vecchi
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  for (const [id, ev] of state.events) {
    if (ev.status === 'finished' && ev.startTime < cutoff) {
      state.events.delete(id);
      state.odds.delete(id);
      state.liveScores.delete(id);
    }
  }

  const liveCount = [...state.events.values()].filter(e => e.status === 'live').length;
  const prematchCount = [...state.events.values()].filter(e => e.status === 'prematch').length;
  const realOddsCount = [...state.events.values()].filter(e => e.isReal).length;
  
  console.log(`✅ Total: ${state.events.size} events | ${liveCount} live | ${prematchCount} prematch | ${realOddsCount} with real odds`);

  broadcast({
    type: 'DATA_SYNC',
    stats: { total: state.events.size, live: liveCount, prematch: prematchCount, realOdds: realOddsCount },
    timestamp: new Date().toISOString()
  }, 'live');
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const limit = (max, win = 60000) => rateLimit({ windowMs: win, max, standardHeaders: true, legacyHeaders: false });

const sign = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
const verify = (token) => jwt.verify(token, JWT_SECRET);

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required', code: 'AUTH_REQUIRED' });
  try { req.userId = verify(h.slice(7)).userId; next(); }
  catch { res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' }); }
}

const sanitizeUser = ({ passwordHash, ...u }) => u;
const sanitizeEv = (e) => { const { matchLog, ...c } = e; return c; };

// AUTH
app.post('/api/auth/register', limit(10), async (req, res) => {
  const { username, email, password, currency = 'EUR' } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });

  const exists = [...state.users.values()].some(u => u.email === email || u.username === username);
  if (exists) return res.status(409).json({ error: 'User already exists', code: 'USER_EXISTS' });

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id, username, email, passwordHash,
    balance: 0,
    currency,
    status: 'active',
    kycStatus: 'pending',
    createdAt: new Date().toISOString(),
    limits: { maxBet: 500, maxPayout: 5000, dailyLimit: 2000 }
  };

  state.users.set(id, user);
  const token = sign({ userId: id });

  res.status(201).json({ token, user: sanitizeUser(user), expiresIn: '24h' });
});

app.post('/api/auth/login', limit(20), async (req, res) => {
  const { email, password } = req.body;

  const user = [...state.users.values()].find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.status !== 'active') return res.status(403).json({ error: 'Account suspended' });

  res.json({ token: sign({ userId: user.id }), user: sanitizeUser(user), expiresIn: '24h' });
});

// SPORTS - Lista completa con conteggi
app.get('/api/sports', limit(200), async (req, res) => {
  const counts = {};
  state.events.forEach(e => {
    if (!counts[e.sport]) counts[e.sport] = { live: 0, prematch: 0, total: 0 };
    counts[e.sport][e.status === 'live' ? 'live' : 'prematch']++;
    counts[e.sport].total++;
  });

  // Ottieni info sport dal Complete Sports API
  let sportsInfo = [];
  try {
    const apiSports = await getAllSports();
    sportsInfo = apiSports.map(s => ({
      id: s.id,
      name: s.name,
      live: counts[s.id]?.live || 0,
      prematch: counts[s.id]?.prematch || 0,
      total: counts[s.id]?.total || 0,
      countries: s.countries,
      totalLeagues: s.total_leagues,
      markets: s.markets,
      marketCount: s.market_count
    }));
  } catch (e) {
    // Fallback: usa lista statica
    const allSports = ['football', 'basketball', 'tennis', 'hockey', 'baseball', 'mma', 'esports', 'formula1', 'rugby', 'volleyball', 'americanfootball', 'cricket', 'handball', 'boxing', 'golf', 'cycling'];
    sportsInfo = allSports.map(s => ({
      id: s,
      name: s.charAt(0).toUpperCase() + s.slice(1),
      live: counts[s]?.live || 0,
      prematch: counts[s]?.prematch || 0,
      total: counts[s]?.total || 0
    }));
  }

  res.json({
    data: sportsInfo,
    totalSports: sportsInfo.length,
    totalEvents: state.events.size,
    totalLive: [...state.events.values()].filter(e => e.status === 'live').length
  });
});

// CAMPIONATI per sport
app.get('/api/sports/:sportId/leagues', limit(200), async (req, res) => {
  try {
    const leagues = await getLeaguesBySport(req.params.sportId);
    const events = [...state.events.values()].filter(e => e.sport === req.params.sportId);

    // Raggruppa per campionato
    const leagueCounts = {};
    events.forEach(e => {
      leagueCounts[e.competition] = (leagueCounts[e.competition] || 0) + 1;
    });

    const data = leagues.map(l => ({
      ...l,
      eventCount: leagueCounts[l.name] || 0
    }));

    res.json({
      success: true,
      sport: req.params.sportId,
      count: data.length,
      data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// MERCATI per sport
app.get('/api/sports/:sportId/markets', limit(200), async (req, res) => {
  try {
    const markets = await getMarketsBySport(req.params.sportId);

    res.json({
      success: true,
      sport: req.params.sportId,
      count: markets.length,
      markets
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// EVENTS
app.get('/api/events', limit(300), (req, res) => {
  const { sport, status, competition, search, limit: lim = 50, offset = 0 } = req.query;

  let events = [...state.events.values()];
  if (sport) events = events.filter(e => e.sport === sport);
  if (status) events = events.filter(e => e.status === status);
  if (competition) events = events.filter(e => e.competition === competition);
  if (search) {
    const q = search.toLowerCase();
    events = events.filter(e => e.homeTeam.toLowerCase().includes(q) || e.awayTeam.toLowerCase().includes(q));
  }

  events.sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || a.startTime - b.startTime);

  const total = events.length;
  const data = events.slice(+offset, +offset + +lim).map(e => ({
    ...sanitizeEv(e),
    score: state.liveScores.get(e.id) || e.score || null,
    marketCount: Object.keys(state.odds.get(e.id) || {}).length
  }));

  res.json({ data, total, limit: +lim, offset: +offset, hasMore: +offset + +lim < total });
});

app.get('/api/events/live', limit(500), (req, res) => {
  const { sport } = req.query;
  let events = [...state.events.values()].filter(e => e.status === 'live');
  if (sport) events = events.filter(e => e.sport === sport);

  res.json({
    data: events.map(e => ({ event: sanitizeEv(e), score: state.liveScores.get(e.id) || e.score, marketCount: Object.keys(state.odds.get(e.id) || {}).length })),
    total: events.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/events/:id', limit(300), (req, res) => {
  const ev = state.events.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  res.json({ data: sanitizeEv(ev), score: state.liveScores.get(ev.id) || ev.score || null, marketCount: Object.keys(state.odds.get(ev.id) || {}).length, timeline: (ev.matchLog || []).slice(-20) });
});

// MARKETS
app.get('/api/markets/:eventId', limit(500), (req, res) => {
  const ev = state.events.get(req.params.eventId);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  const { category, search } = req.query;
  let mktOdds = state.odds.get(req.params.eventId) || {};
  let markets = Object.entries(mktOdds).map(([id, odds]) => {
    const meta = odds.__meta || {};
    return { id, odds: Object.fromEntries(Object.entries(odds).filter(([k]) => k !== '__meta')), status: meta.status || 'active', overround: meta.overround, stakeLimit: meta.stakeLimit };
  });

  if (category) markets = markets.filter(m => m.id.startsWith(category));
  if (search) { const q = search.toLowerCase(); markets = markets.filter(m => m.id.includes(q)); }

  res.json({ data: markets, total: markets.length, eventId: req.params.eventId, event: { homeTeam: ev.homeTeam, awayTeam: ev.awayTeam, sport: ev.sport, status: ev.status } });
});

// LIVE
app.get('/api/live', limit(500), (req, res) => {
  const { sport } = req.query;
  let events = [...state.events.values()].filter(e => e.status === 'live');
  if (sport) events = events.filter(e => e.sport === sport);
  res.json({ data: events.map(e => ({ event: sanitizeEv(e), score: state.liveScores.get(e.id) || e.score, activeMarkets: Object.keys(state.odds.get(e.id) || {}).length })), total: events.length, timestamp: new Date().toISOString() });
});

app.get('/api/live/:id/score', limit(500), (req, res) => {
  const score = state.liveScores.get(req.params.id);
  if (!score) return res.status(404).json({ error: 'Score not found' });
  res.json({ data: score, timestamp: new Date().toISOString() });
});

// BETS
app.post('/api/bets', limit(30), auth, (req, res) => {
  const { eventId, marketId, outcome, stake } = req.body;
  if (!eventId || !marketId || !outcome || !stake) return res.status(400).json({ error: 'eventId, marketId, outcome, stake required' });

  const ev = state.events.get(eventId);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (ev.status === 'finished') return res.status(400).json({ error: 'Event finished', code: 'EVENT_FINISHED' });

  const mktOdds = state.odds.get(eventId)?.[marketId];
  if (!mktOdds) return res.status(404).json({ error: 'Market not found' });

  const outcomeData = mktOdds[outcome];
  if (!outcomeData) return res.status(404).json({ error: 'Outcome not found' });
  if (outcomeData.status === 'suspended') return res.status(400).json({ error: 'Market suspended', code: 'MARKET_SUSPENDED' });

  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const validation = validateBet(req.userId, { eventId, marketId, outcome, stake: +stake, odd: outcomeData.odd }, user);
  if (!validation.accepted) return res.status(400).json({ error: validation.reason, code: validation.code });

  const finalStake = validation.stake;
  if (user.balance < finalStake) return res.status(400).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });

  user.balance = parseFloat((user.balance - finalStake).toFixed(2));

  const bet = {
    id: uuidv4(), userId: req.userId, eventId, marketId, outcome,
    odd: outcomeData.odd, stake: finalStake,
    potentialWin: parseFloat((finalStake * outcomeData.odd).toFixed(2)),
    currency: user.currency, type: ev.status === 'live' ? 'live' : 'prematch',
    status: 'open', placedAt: new Date().toISOString(), settledAt: null, payout: null,
    event: { homeTeam: ev.homeTeam, awayTeam: ev.awayTeam, sport: ev.sport, competition: ev.competition },
    ...(validation.adjusted && { originalStake: +stake, reducedReason: validation.reason })
  };

  state.bets.set(bet.id, bet);
  recordBet(req.userId, { eventId, marketId, outcome, odd: outcomeData.odd }, finalStake);
  broadcast({ type: 'BET_PLACED', bet, balance: user.balance, timestamp: new Date().toISOString() }, `user:${req.userId}`);

  res.status(201).json({ data: bet, balance: user.balance, adjusted: validation.adjusted, message: validation.adjusted ? validation.reason : 'Bet placed successfully' });
});

app.post('/api/bets/multiple', limit(20), auth, (req, res) => {
  const { selections, stake } = req.body;
  if (!selections?.length || selections.length < 2) return res.status(400).json({ error: 'Min 2 selections' });

  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const validated = [];
  let combinedOdd = 1;

  for (const s of selections) {
    const ev = state.events.get(s.eventId);
    if (!ev || ev.status === 'finished') return res.status(400).json({ error: `Invalid event: ${s.eventId}` });
    const oData = state.odds.get(s.eventId)?.[s.marketId]?.[s.outcome];
    if (!oData || oData.status !== 'active') return res.status(400).json({ error: `Market unavailable: ${s.marketId}` });
    combinedOdd *= oData.odd;
    validated.push({ ...s, odd: oData.odd, event: { homeTeam: ev.homeTeam, awayTeam: ev.awayTeam, sport: ev.sport } });
  }

  combinedOdd = parseFloat(combinedOdd.toFixed(4));
  const val = validateMultiple(req.userId, validated.map(s => ({ ...s })), +stake, user);
  if (!val.accepted) return res.status(400).json({ error: val.reason, code: val.code });

  const finalStake = val.stake;
  if (user.balance < finalStake) return res.status(400).json({ error: 'Insufficient balance' });

  user.balance = parseFloat((user.balance - finalStake).toFixed(2));

  const bet = {
    id: uuidv4(), userId: req.userId, type: 'accumulator', selections: validated, combinedOdd, stake: finalStake,
    potentialWin: parseFloat((finalStake * combinedOdd).toFixed(2)), currency: user.currency, status: 'open',
    placedAt: new Date().toISOString(), payout: null,
    ...(val.adjusted && { originalStake: +stake, reducedReason: val.reason })
  };

  state.bets.set(bet.id, bet);
  broadcast({ type: 'BET_PLACED', bet, balance: user.balance, timestamp: new Date().toISOString() }, `user:${req.userId}`);

  res.status(201).json({ data: bet, balance: user.balance, adjusted: val.adjusted });
});

app.get('/api/bets', limit(100), auth, (req, res) => {
  const { status, type, limit: lim = 20, offset = 0 } = req.query;
  let bets = [...state.bets.values()].filter(b => b.userId === req.userId);
  if (status) bets = bets.filter(b => b.status === status);
  if (type) bets = bets.filter(b => b.type === type);
  bets.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

  const total = bets.length;
  const summary = {
    open: bets.filter(b => b.status === 'open').length,
    won: bets.filter(b => b.status === 'won').length,
    lost: bets.filter(b => b.status === 'lost').length,
    totalStaked: bets.reduce((s, b) => s + (b.stake || 0), 0).toFixed(2),
    totalWon: bets.filter(b => b.status === 'won').reduce((s, b) => s + (b.payout || 0), 0).toFixed(2)
  };

  res.json({ data: bets.slice(+offset, +offset + +lim), total, summary });
});

// CASHOUT
app.get('/api/cashout/:betId', limit(100), auth, (req, res) => {
  const bet = state.bets.get(req.params.betId);
  if (!bet || bet.userId !== req.userId) return res.status(404).json({ error: 'Bet not found' });
  if (bet.status !== 'open') return res.status(400).json({ error: 'Bet not open' });

  const currentOdd = state.odds.get(bet.eventId)?.[bet.marketId]?.[bet.outcome]?.odd;
  if (!currentOdd) return res.status(400).json({ error: 'Cashout not available' });

  const potentialWin = bet.stake * bet.odd;
  const cashoutValue = parseFloat((potentialWin * (bet.odd / (currentOdd * 1.05))).toFixed(2));

  res.json({ betId: bet.id, cashout: { value: Math.max(0.01, cashoutValue), originalOdd: bet.odd, currentOdd, potentialWin, cashoutMargin: 5 }, available: true, expiresIn: 10, timestamp: new Date().toISOString() });
});

app.post('/api/cashout/:betId', limit(20), auth, (req, res) => {
  const bet = state.bets.get(req.params.betId);
  if (!bet || bet.userId !== req.userId) return res.status(404).json({ error: 'Bet not found' });
  if (bet.status !== 'open') return res.status(400).json({ error: 'Bet not open' });

  const currentOdd = state.odds.get(bet.eventId)?.[bet.marketId]?.[bet.outcome]?.odd;
  if (!currentOdd) return res.status(400).json({ error: 'Cashout unavailable' });

  const cashoutValue = parseFloat(((bet.stake * bet.odd) / (currentOdd * 1.05)).toFixed(2));
  bet.status = 'cashout'; bet.cashoutValue = cashoutValue; bet.settledAt = new Date().toISOString(); bet.payout = cashoutValue;

  const user = state.users.get(req.userId);
  if (user) user.balance = parseFloat((user.balance + cashoutValue).toFixed(2));

  broadcast({ type: 'BET_CASHOUT', betId: bet.id, cashoutValue, balance: user?.balance }, `user:${req.userId}`);
  res.json({ data: bet, cashoutValue, balance: user?.balance });
});

// USER
app.get('/api/users/me', limit(100), auth, (req, res) => {
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ data: sanitizeUser(user) });
});

app.get('/api/users/me/balance', limit(200), auth, (req, res) => {
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ balance: user.balance, currency: user.currency, limits: user.limits, timestamp: new Date().toISOString() });
});

app.get('/api/users/me/stats', limit(50), auth, (req, res) => {
  const bets = [...state.bets.values()].filter(b => b.userId === req.userId);
  const won = bets.filter(b => b.status === 'won'), lost = bets.filter(b => b.status === 'lost');
  const totalStaked = bets.reduce((s, b) => s + (b.stake || 0), 0);
  const totalWon = won.reduce((s, b) => s + (b.payout || 0), 0);

  res.json({ data: { totalBets: bets.length, open: bets.filter(b => b.status === 'open').length, won: won.length, lost: lost.length, winRate: bets.length ? (won.length / (won.length + lost.length || 1) * 100).toFixed(1) : 0, totalStaked: totalStaked.toFixed(2), totalWon: totalWon.toFixed(2), profit: (totalWon - totalStaked).toFixed(2), roi: totalStaked ? ((totalWon - totalStaked) / totalStaked * 100).toFixed(1) : 0 } });
});

// Admin: Aggiorna score manualmente
app.post('/api/admin/update-score/:eventId', limit(10), auth, (req, res) => {
  const { home, away, status } = req.body;
  const ev = state.events.get(req.params.eventId);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  if (home !== undefined && away !== undefined) {
    const score = { home: +home, away: +away };
    state.liveScores.set(ev.id, score);
    ev.score = score;
  }
  if (status) ev.status = status;

  broadcast({ type: 'SCORE_UPDATE', eventId: ev.id, score: state.liveScores.get(ev.id), status: ev.status }, `event:${ev.id}`);
  res.json({ success: true, event: sanitizeEv(ev) });
});

// STATS
app.get('/api/stats', limit(50), (req, res) => {
  const events = [...state.events.values()], bets = [...state.bets.values()];
  res.json({ events: { total: events.length, live: events.filter(e => e.status === 'live').length, prematch: events.filter(e => e.status === 'prematch').length }, markets: { total: [...state.odds.values()].reduce((s, m) => s + Object.keys(m).length, 0) }, bets: { total: bets.length, open: bets.filter(b => b.status === 'open').length }, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), events: state.events.size, liveEvents: [...state.events.values()].filter(e => e.status === 'live').length, wsClients: state.clients.size }));

// ═══════════════════════════════════════════════════════════════════════════
// SERVER
// ═══════════════════════════════════════════════════════════════════════════

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
setWss(wss);

wss.on('connection', (ws, req) => {
  const clientId = `c_${Math.random().toString(36).substr(2, 8)}`;
  state.clients.set(ws, { clientId, userId: null, subs: new Set() });
  const send = (p) => { if (ws.readyState === 1) ws.send(JSON.stringify(p)); };

  send({ type: 'CONNECTED', clientId, serverTime: new Date().toISOString(), channels: ['live', 'event:{id}', 'sport:{name}', 'user:{id}', 'risk'] });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return send({ type: 'ERROR', code: 'INVALID_JSON' }); }
    const client = state.clients.get(ws);

    switch (msg.type) {
      case 'AUTH':
        try { const d = verify(msg.token); client.userId = d.userId; send({ type: 'AUTH_SUCCESS', userId: d.userId }); addToRoom(ws, `user:${d.userId}`); }
        catch { send({ type: 'AUTH_FAILED' }); }
        break;
      case 'SUBSCRIBE':
        (msg.channels || []).forEach(ch => {
          if (!/^(live|event:[a-z0-9-]+|sport:[a-z]+|user:[a-z0-9-]+|risk)$/.test(ch)) return;
          if (ch.startsWith('user:') && !client.userId) return;
          addToRoom(ws, ch); client.subs.add(ch);
          if (ch === 'live') {
            const liveEvs = [...state.events.values()].filter(e => e.status === 'live');
            send({ type: 'LIVE_SNAPSHOT', events: liveEvs.map(e => ({ event: sanitizeEv(e), score: state.liveScores.get(e.id) || e.score })), timestamp: new Date().toISOString() });
          }
          if (ch.startsWith('event:')) { const eid = ch.split(':')[1]; const ev = state.events.get(eid); if (ev) send({ type: 'EVENT_SNAPSHOT', event: sanitizeEv(ev), score: state.liveScores.get(eid) || ev.score, odds: state.odds.get(eid), timestamp: new Date().toISOString() }); }
        });
        send({ type: 'SUBSCRIBED', channels: msg.channels });
        break;
      case 'UNSUBSCRIBE':
        (msg.channels || []).forEach(ch => { client.subs.delete(ch); state.rooms.get(ch)?.delete(ws); });
        break;
      case 'PING':
        send({ type: 'PONG', timestamp: new Date().toISOString() });
        break;
      case 'GET_ODDS':
        if (msg.eventId) {
          const odds = state.odds.get(msg.eventId);
          send({ type: 'ODDS_SNAPSHOT', eventId: msg.eventId, odds: msg.marketId ? { [msg.marketId]: odds?.[msg.marketId] } : odds, timestamp: new Date().toISOString() });
        }
        break;
    }
  });

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { removeFromAllRooms(ws); state.clients.delete(ws); });
  ws.on('error', () => { removeFromAllRooms(ws); state.clients.delete(ws); });
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false; ws.ping();
  });
}, 30000);

// Avvio
server.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════════╗`);
  console.log(`║  ⚡ REAL SPORTS BETTING API v1.0                 ║`);
  console.log(`║  HTTP → http://localhost:${PORT}                     ║`);
  console.log(`║  WS   → ws://localhost:${PORT}/ws                   ║`);
  console.log(`║  Real Data - No Simulations                     ║`);
  console.log(`╚═══════════════════════════════════════════════════╝\n`);
  syncRealData();
});

// Sync periodico ogni 5 minuti
setInterval(syncRealData, 5 * 60 * 1000);

// Aggiorna live scores ogni 30 secondi
setInterval(async () => {
  if (state.events.size === 0) return;
  const liveEvents = [...state.events.values()].filter(e => e.status === 'live');
  if (liveEvents.length === 0) return;
  try { await syncRealData(); } catch (e) { console.log('Live sync error:', e.message); }
}, 30000);

module.exports = { app, server, syncRealData };
