'use strict';
require('dotenv').config();
const http    = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const compression = require('compression');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');

const { state }             = require('./db/state');
const { broadcast, addToRoom, removeFromAllRooms, setWss } = require('./ws/broadcaster');
const { compileAllOdds }    = require('./engine/oddsCompiler');
const { calcProbabilities, getTeamInfo, getAllRatings } = require('./engine/elo');
const { validateBet, validateMultiple, recordBet, releaseExposure, getExposureReport, getUserDaily } = require('./risk/riskManager');
const { startMatchSimulation } = require('./live/matchSimulator');
const { recalcLiveOdds }    = require('./live/liveOddsEngine');

const PORT       = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION_256bit';

// ─── SEED EVENTS ──────────────────────────────────────────────────────────────
function seedAllEvents() {
  const now = Date.now();

  const fixtures = [
    // LIVE (partite già in corso)
    { sport:'football',  home:'Real Madrid',      away:'Bayern Munich',     comp:'comp-ucl', offset:-35,  live:true },
    { sport:'football',  home:'Liverpool',         away:'Arsenal',           comp:'comp-pl',  offset:-22,  live:true },
    { sport:'football',  home:'Napoli',            away:'Inter Milan',       comp:'comp-sa',  offset:-58,  live:true },
    { sport:'football',  home:'Barcelona',         away:'Atletico Madrid',   comp:'comp-ll',  offset:-12,  live:true },
    { sport:'basketball',home:'Lakers',            away:'Celtics',           comp:'comp-nba', offset:-18,  live:true },
    { sport:'basketball',home:'Warriors',          away:'Bucks',             comp:'comp-nba', offset:-32,  live:true },
    { sport:'tennis',    home:'Djokovic, N.',      away:'Alcaraz, C.',       comp:'comp-atp', offset:-45,  live:true },
    { sport:'hockey',    home:'Avalanche',         away:'Lightning',         comp:'comp-nhl', offset:-28,  live:true },
    { sport:'esports',   home:'T1',                away:'Gen.G',             comp:'comp-lol', offset:-15,  live:true },
    // PREMATCH — oggi
    { sport:'football',  home:'Juventus',          away:'AC Milan',          comp:'comp-sa',  offset:90   },
    { sport:'football',  home:'Manchester City',   away:'Chelsea',           comp:'comp-pl',  offset:120  },
    { sport:'football',  home:'PSG',               away:'Marseille',         comp:'comp-l1',  offset:150  },
    { sport:'football',  home:'Ajax',              away:'PSV',               comp:'comp-el',  offset:200  },
    { sport:'basketball',home:'Nuggets',           away:'Suns',              comp:'comp-nba', offset:180  },
    { sport:'basketball',home:'Mavericks',         away:'Thunder',           comp:'comp-nba', offset:210  },
    { sport:'tennis',    home:'Sinner, J.',        away:'Medvedev, D.',      comp:'comp-atp', offset:130  },
    { sport:'tennis',    home:'Swiatek, I.',       away:'Gauff, C.',         comp:'comp-wta', offset:160  },
    { sport:'hockey',    home:'Rangers',           away:'Bruins',            comp:'comp-nhl', offset:240  },
    { sport:'mma',       home:'Jones, J.',         away:'Aspinall, T.',      comp:'comp-ufc', offset:300  },
    { sport:'esports',   home:'Fnatic',            away:'G2 Esports',        comp:'comp-lol', offset:90   },
    // PREMATCH — domani
    { sport:'football',  home:'Borussia Dortmund', away:'Leverkusen',        comp:'comp-bl',  offset:1440 },
    { sport:'football',  home:'Lazio',             away:'Roma',              comp:'comp-sa',  offset:1530 },
    { sport:'football',  home:'Villarreal',        away:'Sevilla',           comp:'comp-ll',  offset:1600 },
    { sport:'basketball',home:'Raptors',           away:'Heat',              comp:'comp-nba', offset:1440 },
    { sport:'tennis',    home:'Fritz, T.',         away:'Tsitsipas, S.',     comp:'comp-atp', offset:1440 },
    { sport:'hockey',    home:'Oilers',            away:'Penguins',          comp:'comp-nhl', offset:1500 },
    { sport:'mma',       home:'Poirier, D.',       away:'Gaethje, J.',       comp:'comp-ufc', offset:2880 },
    { sport:'esports',   home:'Natus Vincere',     away:'Astralis',          comp:'comp-lol', offset:1440 },
  ];

  fixtures.forEach(f => {
    const id = uuidv4();
    const startTime = now + (f.offset||0) * 60 * 1000;
    const probs = calcProbabilities(f.home, f.away, f.sport, ['tennis','mma','esports'].includes(f.sport));

    const event = {
      id, sport: f.sport, competition: f.comp,
      homeTeam: f.home, awayTeam: f.away,
      startTime,
      status: f.live ? 'live' : 'prematch',
      homeElo: Math.round(getTeamInfo(f.home, f.sport).rating),
      awayElo: Math.round(getTeamInfo(f.away, f.sport).rating),
      probabilities: { home: parseFloat(probs.home.toFixed(3)), draw: parseFloat(probs.draw.toFixed(3)), away: parseFloat(probs.away.toFixed(3)) },
      createdAt: new Date().toISOString(),
      matchLog: [],
    };
    state.events.set(id, event);

    // Genera quote
    const odds = compileAllOdds(event);
    state.odds.set(id, odds);

    // Avvia simulazione live
    if (f.live) {
      startMatchSimulation(event);
    }
  });

  const liveCount = [...state.events.values()].filter(e => e.status === 'live').length;
  const totalMarkets = [...state.odds.values()].reduce((s, m) => s + Object.keys(m).length, 0);
  console.log(`✅ Seeded ${state.events.size} events | ${liveCount} live | ${totalMarkets} market instances`);
}

// ─── EXPRESS APP ──────────────────────────────────────────────────────────────
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const limit = (max, win=60000) => rateLimit({ windowMs: win, max, standardHeaders: true, legacyHeaders: false });

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────
const sign = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
const verify = (token) => jwt.verify(token, JWT_SECRET);
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error:'Auth required', code:'AUTH_REQUIRED' });
  try { req.userId = verify(h.slice(7)).userId; next(); }
  catch { res.status(401).json({ error:'Invalid token', code:'INVALID_TOKEN' }); }
}
function optAuth(req, res, next) {
  try { const h = req.headers.authorization; if (h?.startsWith('Bearer ')) req.userId = verify(h.slice(7)).userId; } catch {}
  next();
}
const sanitizeUser = ({ passwordHash, ...u }) => u;

// ─── ROUTES ────────────────────────────────────────────────────────────────────

// AUTH
app.post('/api/auth/register', limit(10), async (req,res) => {
  const { username, email, password, currency='EUR' } = req.body;
  if (!username||!email||!password) return res.status(400).json({ error:'username, email, password required' });
  const exists = [...state.users.values()].some(u => u.email===email||u.username===username);
  if (exists) return res.status(409).json({ error:'User already exists', code:'USER_EXISTS' });
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id, username, email, passwordHash, balance:1000, currency, status:'active', kycStatus:'pending', createdAt:new Date().toISOString(), limits:{ maxBet:5000, maxPayout:50000, dailyLimit:20000 } };
  state.users.set(id, user);
  const token = sign({ userId:id });
  res.status(201).json({ token, user:sanitizeUser(user), expiresIn:'24h' });
});

app.post('/api/auth/login', limit(20), async (req,res) => {
  const { email, password } = req.body;
  // Demo shortcut
  if (email==='demo@bet.com' && password==='demo123') {
    let demo = state.users.get('user-demo');
    if (!demo) {
      demo = { id:'user-demo', username:'Demo User', email:'demo@bet.com', passwordHash:'', balance:5000, currency:'EUR', status:'active', kycStatus:'verified', createdAt:new Date().toISOString(), limits:{ maxBet:5000, maxPayout:50000, dailyLimit:20000 } };
      state.users.set('user-demo', demo);
    }
    return res.json({ token:sign({ userId:'user-demo' }), user:sanitizeUser(demo), expiresIn:'24h' });
  }
  const user = [...state.users.values()].find(u => u.email===email);
  if (!user) return res.status(401).json({ error:'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error:'Invalid credentials' });
  if (user.status!=='active') return res.status(403).json({ error:'Account suspended' });
  res.json({ token:sign({ userId:user.id }), user:sanitizeUser(user), expiresIn:'24h' });
});

// SPORTS
app.get('/api/sports', limit(200), (req,res) => {
  const sports = ['football','basketball','tennis','hockey','baseball','mma','esports','formula1','rugby','volleyball','americanfootball','cricket','handball','boxing','golf'];
  const counts = {};
  state.events.forEach(e => {
    if (!counts[e.sport]) counts[e.sport] = { live:0, prematch:0 };
    counts[e.sport][e.status === 'live' ? 'live' : 'prematch']++;
  });
  res.json({ data: sports.map(s => ({ id:s, name:s, live:counts[s]?.live||0, prematch:counts[s]?.prematch||0 })) });
});

// EVENTS
app.get('/api/events', limit(300), (req,res) => {
  const { sport, status, competition, search, limit:lim=50, offset=0 } = req.query;
  let events = [...state.events.values()];
  if (sport)       events = events.filter(e => e.sport===sport);
  if (status)      events = events.filter(e => e.status===status);
  if (competition) events = events.filter(e => e.competition===competition);
  if (search) { const q=search.toLowerCase(); events = events.filter(e => e.homeTeam.toLowerCase().includes(q)||e.awayTeam.toLowerCase().includes(q)); }
  events.sort((a,b) => (a.status==='live'?0:1) - (b.status==='live'?0:1) || a.startTime - b.startTime);
  const total = events.length;
  const data = events.slice(+offset, +offset + +lim).map(e => ({ ...sanitizeEv(e), score: state.liveScores.get(e.id)||null, marketCount: Object.keys(state.odds.get(e.id)||{}).length }));
  res.json({ data, total, limit:+lim, offset:+offset, hasMore: +offset + +lim < total });
});

app.get('/api/events/live', limit(500), (req,res) => {
  const { sport } = req.query;
  let events = [...state.events.values()].filter(e => e.status==='live');
  if (sport) events = events.filter(e => e.sport===sport);
  res.json({ data: events.map(e => ({ event:sanitizeEv(e), score:state.liveScores.get(e.id), marketCount:Object.keys(state.odds.get(e.id)||{}).length })), total:events.length, timestamp:new Date().toISOString() });
});

app.get('/api/events/:id', limit(300), (req,res) => {
  const ev = state.events.get(req.params.id);
  if (!ev) return res.status(404).json({ error:'Event not found' });
  res.json({ data:sanitizeEv(ev), score:state.liveScores.get(ev.id)||null, marketCount:Object.keys(state.odds.get(ev.id)||{}).length, timeline:(ev.matchLog||[]).slice(-20) });
});

// MARKETS
app.get('/api/markets/:eventId', limit(500), (req,res) => {
  const ev = state.events.get(req.params.eventId);
  if (!ev) return res.status(404).json({ error:'Event not found' });
  const { category, search } = req.query;
  let mktOdds = state.odds.get(req.params.eventId) || {};
  let markets = Object.entries(mktOdds).map(([id, odds]) => {
    const meta = odds.__meta || {};
    return { id, odds: Object.fromEntries(Object.entries(odds).filter(([k])=>k!=='__meta')), status:meta.status||'active', overround:meta.overround, stakeLimit:meta.stakeLimit };
  });
  if (category) markets = markets.filter(m => m.id.startsWith(category));
  if (search) { const q=search.toLowerCase(); markets = markets.filter(m => m.id.includes(q)); }
  res.json({ data:markets, total:markets.length, eventId:req.params.eventId, event:{ homeTeam:ev.homeTeam, awayTeam:ev.awayTeam, sport:ev.sport, status:ev.status } });
});

app.get('/api/markets/:eventId/:marketId', limit(500), (req,res) => {
  const { eventId, marketId } = req.params;
  const odds = state.odds.get(eventId)?.[marketId];
  if (!odds) return res.status(404).json({ error:'Market not found' });
  const { __meta, ...cleanOdds } = odds;
  res.json({ id:marketId, odds:cleanOdds, meta:__meta, timestamp:new Date().toISOString() });
});

// LIVE
app.get('/api/live', limit(500), (req,res) => {
  const { sport } = req.query;
  let events = [...state.events.values()].filter(e => e.status==='live');
  if (sport) events = events.filter(e => e.sport===sport);
  res.json({ data: events.map(e => ({ event:sanitizeEv(e), score:state.liveScores.get(e.id), activeMarkets:Object.keys(state.odds.get(e.id)||{}).length })), total:events.length, timestamp:new Date().toISOString() });
});

app.get('/api/live/:id/score', limit(500), (req,res) => {
  const score = state.liveScores.get(req.params.id);
  if (!score) return res.status(404).json({ error:'Score not found' });
  res.json({ data:score, timestamp:new Date().toISOString() });
});

app.get('/api/live/:id/tracker', limit(300), (req,res) => {
  const ev = state.events.get(req.params.id);
  if (!ev) return res.status(404).json({ error:'Event not found' });
  res.json({ eventId:ev.id, homeTeam:ev.homeTeam, awayTeam:ev.awayTeam, score:state.liveScores.get(ev.id), events:(ev.matchLog||[]).slice(-30), timestamp:new Date().toISOString() });
});

// BETS
app.post('/api/bets', limit(30), auth, (req,res) => {
  const { eventId, marketId, outcome, stake, acceptAny=false } = req.body;
  if (!eventId||!marketId||!outcome||!stake) return res.status(400).json({ error:'eventId, marketId, outcome, stake required' });
  const ev = state.events.get(eventId);
  if (!ev) return res.status(404).json({ error:'Event not found' });
  if (ev.status==='finished') return res.status(400).json({ error:'Event finished', code:'EVENT_FINISHED' });
  const mktOdds = state.odds.get(eventId)?.[marketId];
  if (!mktOdds) return res.status(404).json({ error:'Market not found' });
  const outcomeData = mktOdds[outcome];
  if (!outcomeData) return res.status(404).json({ error:'Outcome not found' });
  if (outcomeData.status==='suspended') return res.status(400).json({ error:'Market suspended', code:'MARKET_SUSPENDED' });
  if (mktOdds.__meta?.status==='locked') return res.status(400).json({ error:'Market locked', code:'MARKET_LOCKED' });

  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error:'User not found' });

  const validation = validateBet(req.userId, { eventId, marketId, outcome, stake:+stake, odd:outcomeData.odd }, user);
  if (!validation.accepted) return res.status(400).json({ error:validation.reason, code:validation.code });

  const finalStake = validation.stake;
  if (user.balance < finalStake) return res.status(400).json({ error:'Insufficient balance', code:'INSUFFICIENT_BALANCE' });

  user.balance = parseFloat((user.balance - finalStake).toFixed(2));
  const bet = {
    id: uuidv4(), userId:req.userId, eventId, marketId, outcome,
    odd: outcomeData.odd, stake:finalStake,
    potentialWin: parseFloat((finalStake * outcomeData.odd).toFixed(2)),
    currency: user.currency, type: ev.status==='live' ? 'live' : 'prematch',
    status: 'open', placedAt: new Date().toISOString(), settledAt:null, payout:null,
    event: { homeTeam:ev.homeTeam, awayTeam:ev.awayTeam, sport:ev.sport, competition:ev.competition },
    ...(validation.adjusted && { originalStake:+stake, reducedReason:validation.reason }),
  };
  state.bets.set(bet.id, bet);
  recordBet(req.userId, { eventId, marketId, outcome, odd:outcomeData.odd }, finalStake);
  broadcast({ type:'BET_PLACED', bet, balance:user.balance, timestamp:new Date().toISOString() }, `user:${req.userId}`);
  res.status(201).json({ data:bet, balance:user.balance, adjusted:validation.adjusted, message: validation.adjusted ? validation.reason : 'Bet placed successfully' });
});

app.post('/api/bets/multiple', limit(20), auth, (req,res) => {
  const { selections, stake } = req.body;
  if (!selections?.length||selections.length<2) return res.status(400).json({ error:'Min 2 selections' });
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error:'User not found' });
  const validated = [];
  let combinedOdd = 1;
  for (const s of selections) {
    const ev = state.events.get(s.eventId);
    if (!ev||ev.status==='finished') return res.status(400).json({ error:`Invalid event: ${s.eventId}` });
    const oData = state.odds.get(s.eventId)?.[s.marketId]?.[s.outcome];
    if (!oData||oData.status!=='active') return res.status(400).json({ error:`Market unavailable: ${s.marketId}` });
    combinedOdd *= oData.odd;
    validated.push({ ...s, odd:oData.odd, event:{ homeTeam:ev.homeTeam, awayTeam:ev.awayTeam, sport:ev.sport } });
  }
  combinedOdd = parseFloat(combinedOdd.toFixed(4));
  const val = validateMultiple(req.userId, validated.map(s => ({...s})), +stake, user);
  if (!val.accepted) return res.status(400).json({ error:val.reason, code:val.code });
  const finalStake = val.stake;
  if (user.balance < finalStake) return res.status(400).json({ error:'Insufficient balance' });
  user.balance = parseFloat((user.balance - finalStake).toFixed(2));
  const bet = {
    id:uuidv4(), userId:req.userId, type:'accumulator',
    selections:validated, combinedOdd, stake:finalStake,
    potentialWin:parseFloat((finalStake*combinedOdd).toFixed(2)),
    currency:user.currency, status:'open', placedAt:new Date().toISOString(), payout:null,
    ...(val.adjusted && { originalStake:+stake, reducedReason:val.reason }),
  };
  state.bets.set(bet.id, bet);
  broadcast({ type:'BET_PLACED', bet, balance:user.balance, timestamp:new Date().toISOString() }, `user:${req.userId}`);
  res.status(201).json({ data:bet, balance:user.balance, adjusted:val.adjusted });
});

app.get('/api/bets', limit(100), auth, (req,res) => {
  const { status, type, limit:lim=20, offset=0 } = req.query;
  let bets = [...state.bets.values()].filter(b => b.userId===req.userId);
  if (status) bets = bets.filter(b => b.status===status);
  if (type)   bets = bets.filter(b => b.type===type);
  bets.sort((a,b) => new Date(b.placedAt) - new Date(a.placedAt));
  const total = bets.length;
  const summary = {
    open: bets.filter(b=>b.status==='open').length,
    won:  bets.filter(b=>b.status==='won').length,
    lost: bets.filter(b=>b.status==='lost').length,
    totalStaked: bets.reduce((s,b)=>s+(b.stake||0),0).toFixed(2),
    totalWon:    bets.filter(b=>b.status==='won').reduce((s,b)=>s+(b.payout||0),0).toFixed(2),
  };
  res.json({ data:bets.slice(+offset,+offset+ +lim), total, summary });
});

app.get('/api/bets/:id', limit(100), auth, (req,res) => {
  const bet = state.bets.get(req.params.id);
  if (!bet) return res.status(404).json({ error:'Bet not found' });
  if (bet.userId!==req.userId) return res.status(403).json({ error:'Forbidden' });
  res.json({ data:bet });
});

app.delete('/api/bets/:id', limit(20), auth, (req,res) => {
  const bet = state.bets.get(req.params.id);
  if (!bet) return res.status(404).json({ error:'Bet not found' });
  if (bet.userId!==req.userId) return res.status(403).json({ error:'Forbidden' });
  if (bet.status!=='open') return res.status(400).json({ error:'Can only cancel open bets' });
  if (Date.now() - new Date(bet.placedAt).getTime() > 30000) return res.status(400).json({ error:'Cancellation window expired (30s)', code:'CANCEL_EXPIRED' });
  bet.status = 'cancelled'; bet.cancelledAt = new Date().toISOString();
  const user = state.users.get(req.userId);
  if (user) user.balance = parseFloat((user.balance + bet.stake).toFixed(2));
  broadcast({ type:'BET_CANCELLED', betId:bet.id, balance:user?.balance }, `user:${req.userId}`);
  res.json({ data:bet, balance:user?.balance, message:'Bet cancelled, stake refunded' });
});

// CASHOUT
app.get('/api/cashout/:betId', limit(100), auth, (req,res) => {
  const bet = state.bets.get(req.params.betId);
  if (!bet||bet.userId!==req.userId) return res.status(404).json({ error:'Bet not found' });
  if (bet.status!=='open') return res.status(400).json({ error:'Bet not open' });
  const ev = state.events.get(bet.eventId);
  if (!ev) return res.status(400).json({ error:'Event not found' });
  const currentOdd = state.odds.get(bet.eventId)?.[bet.marketId]?.[bet.outcome]?.odd;
  if (!currentOdd) return res.status(400).json({ error:'Cashout not available' });
  const potentialWin = bet.stake * bet.odd;
  const cashoutValue = parseFloat((potentialWin * (bet.odd / (currentOdd * 1.05))).toFixed(2));
  res.json({ betId:bet.id, cashout:{ value:Math.max(0.01, cashoutValue), originalOdd:bet.odd, currentOdd, potentialWin, cashoutMargin:5 }, available:true, expiresIn:10, timestamp:new Date().toISOString() });
});

app.post('/api/cashout/:betId', limit(20), auth, (req,res) => {
  const bet = state.bets.get(req.params.betId);
  if (!bet||bet.userId!==req.userId) return res.status(404).json({ error:'Bet not found' });
  if (bet.status!=='open') return res.status(400).json({ error:'Bet not open' });
  const currentOdd = state.odds.get(bet.eventId)?.[bet.marketId]?.[bet.outcome]?.odd;
  if (!currentOdd) return res.status(400).json({ error:'Cashout unavailable' });
  const cashoutValue = parseFloat(((bet.stake * bet.odd) / (currentOdd * 1.05)).toFixed(2));
  const { acceptedValue } = req.body;
  if (acceptedValue && Math.abs(acceptedValue - cashoutValue) / cashoutValue > 0.02) {
    return res.status(400).json({ error:'Cashout value changed', code:'VALUE_CHANGED', newValue:cashoutValue });
  }
  bet.status = 'cashout'; bet.cashoutValue = cashoutValue; bet.settledAt = new Date().toISOString(); bet.payout = cashoutValue;
  const user = state.users.get(req.userId);
  if (user) user.balance = parseFloat((user.balance + cashoutValue).toFixed(2));
  broadcast({ type:'BET_CASHOUT', betId:bet.id, cashoutValue, balance:user?.balance }, `user:${req.userId}`);
  res.json({ data:bet, cashoutValue, balance:user?.balance });
});

// USER
app.get('/api/users/me', limit(100), auth, (req,res) => {
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error:'Not found' });
  res.json({ data:sanitizeUser(user) });
});

app.get('/api/users/me/balance', limit(200), auth, (req,res) => {
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error:'Not found' });
  const daily = getUserDaily(req.userId);
  res.json({ balance:user.balance, currency:user.currency, limits:user.limits, daily, timestamp:new Date().toISOString() });
});

app.post('/api/users/me/deposit', limit(10), auth, (req,res) => {
  const { amount } = req.body;
  if (!amount||amount<1) return res.status(400).json({ error:'Invalid amount' });
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error:'Not found' });
  user.balance = parseFloat((user.balance + +amount).toFixed(2));
  broadcast({ type:'BALANCE_UPDATE', balance:user.balance }, `user:${req.userId}`);
  res.json({ balance:user.balance, deposited:+amount });
});

app.post('/api/users/me/withdraw', limit(10), auth, (req,res) => {
  const { amount } = req.body;
  const user = state.users.get(req.userId);
  if (!user) return res.status(404).json({ error:'Not found' });
  if (!amount||user.balance < +amount) return res.status(400).json({ error:'Insufficient balance' });
  user.balance = parseFloat((user.balance - +amount).toFixed(2));
  broadcast({ type:'BALANCE_UPDATE', balance:user.balance }, `user:${req.userId}`);
  res.json({ balance:user.balance, withdrawn:+amount, status:'pending', estimatedArrival:'1-3 business days' });
});

app.get('/api/users/me/stats', limit(50), auth, (req,res) => {
  const bets = [...state.bets.values()].filter(b => b.userId===req.userId);
  const won = bets.filter(b=>b.status==='won'), lost = bets.filter(b=>b.status==='lost');
  const totalStaked = bets.reduce((s,b)=>s+(b.stake||0),0);
  const totalWon = won.reduce((s,b)=>s+(b.payout||0),0);
  res.json({ data:{ totalBets:bets.length, open:bets.filter(b=>b.status==='open').length, won:won.length, lost:lost.length, winRate:bets.length?(won.length/(won.length+lost.length||1)*100).toFixed(1):0, totalStaked:totalStaked.toFixed(2), totalWon:totalWon.toFixed(2), profit:(totalWon-totalStaked).toFixed(2), roi:totalStaked?((totalWon-totalStaked)/totalStaked*100).toFixed(1):0 } });
});

// STATS
app.get('/api/stats', limit(50), (req,res) => {
  const events = [...state.events.values()], bets = [...state.bets.values()];
  res.json({ events:{ total:events.length, live:events.filter(e=>e.status==='live').length, prematch:events.filter(e=>e.status==='prematch').length }, markets:{ total:[...state.odds.values()].reduce((s,m)=>s+Object.keys(m).length,0) }, bets:{ total:bets.length, open:bets.filter(b=>b.status==='open').length }, uptime:process.uptime(), timestamp:new Date().toISOString() });
});

// ELO ratings
app.get('/api/elo', limit(20), (req,res) => { res.json({ data:getAllRatings() }); });

// DOCS
app.get('/api/docs', (req,res) => { res.json(require('./docs')); });

// Health
app.get('/health', (req,res) => res.json({ status:'ok', uptime:process.uptime(), events:state.events.size, liveEvents:[...state.events.values()].filter(e=>e.status==='live').length, wsClients:state.clients.size }));

// ─── HTTP + WEBSOCKET SERVER ───────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path:'/ws' });
setWss(wss);

wss.on('connection', (ws, req) => {
  const clientId = `c_${Math.random().toString(36).substr(2,8)}`;
  state.clients.set(ws, { clientId, userId:null, subs:new Set() });
  const send = (p) => { if(ws.readyState===1) ws.send(JSON.stringify(p)); };

  send({ type:'CONNECTED', clientId, serverTime:new Date().toISOString(), channels:['live','event:{id}','sport:{name}','user:{id}','risk'] });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return send({ type:'ERROR', code:'INVALID_JSON' }); }
    const client = state.clients.get(ws);
    switch(msg.type) {
      case 'AUTH':
        try { const d = verify(msg.token); client.userId = d.userId; send({ type:'AUTH_SUCCESS', userId:d.userId }); addToRoom(ws, `user:${d.userId}`); }
        catch { send({ type:'AUTH_FAILED' }); }
        break;
      case 'SUBSCRIBE':
        (msg.channels||[]).forEach(ch => {
          if (!/^(live|event:[a-z0-9-]+|sport:[a-z]+|user:[a-z0-9-]+|risk)$/.test(ch)) return;
          if (ch.startsWith('user:') && !client.userId) return;
          addToRoom(ws, ch); client.subs.add(ch);
          // Snapshot immediato
          if (ch === 'live') { const liveEvs = [...state.events.values()].filter(e=>e.status==='live'); send({ type:'LIVE_SNAPSHOT', events:liveEvs.map(e=>({ event:sanitizeEv(e), score:state.liveScores.get(e.id) })), timestamp:new Date().toISOString() }); }
          if (ch.startsWith('event:')) { const eid=ch.split(':')[1]; const ev=state.events.get(eid); if(ev) send({ type:'EVENT_SNAPSHOT', event:sanitizeEv(ev), score:state.liveScores.get(eid), odds:state.odds.get(eid), timestamp:new Date().toISOString() }); }
        });
        send({ type:'SUBSCRIBED', channels:msg.channels });
        break;
      case 'UNSUBSCRIBE':
        (msg.channels||[]).forEach(ch => { client.subs.delete(ch); state.rooms.get(ch)?.delete(ws); });
        break;
      case 'PING': send({ type:'PONG', timestamp:new Date().toISOString() }); break;
      case 'GET_ODDS':
        if (msg.eventId) { const odds = state.odds.get(msg.eventId); send({ type:'ODDS_SNAPSHOT', eventId:msg.eventId, odds:msg.marketId ? { [msg.marketId]:odds?.[msg.marketId] } : odds, timestamp:new Date().toISOString() }); }
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

// Auto-start prematch events
setInterval(() => {
  const now = Date.now();
  [...state.events.values()].forEach(ev => {
    if (ev.status==='prematch' && ev.startTime <= now) startMatchSimulation(ev);
  });
}, 10000);

// ─── START ────────────────────────────────────────────────────────────────────
function sanitizeEv(e) { const { matchLog, matchParams, ...c } = e; return c; }

server.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  ⚡ ENTERPRISE BETTING ENGINE v3.0        ║`);
  console.log(`║  HTTP → http://localhost:${PORT}             ║`);
  console.log(`║  WS   → ws://localhost:${PORT}/ws           ║`);
  console.log(`║  Demo → demo@bet.com / demo123            ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  seedAllEvents();
});

module.exports = { app, server };
