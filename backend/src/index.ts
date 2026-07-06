import "dotenv/config";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { passwordCheck } from "./middleware/passwordCheck";
import { requireRoles } from "./middleware/roleAuth";
import { globalRateLimit, betRateLimit } from "./middleware/rateLimit";
import { sanitizeInput } from "./middleware/sanitize";
import { refreshEvents } from "./jobs/eventRefresh";
import { settlePendingBets, settleOneBet } from './services/settleService';
import { refreshLiveEvents, getCachedLiveEvents } from './services/liveService';
import { startLiveOddsScheduler, onOddsUpdate, isMarketLocked, getLiveOdds, getLockCountdown, getSportMarkets } from './services/liveOddsScheduler';
import { startXcodetecLiveFeed, onXcodetecLiveUpdate } from './services/xcodetecLiveService';
import { setupOddsUpdatesWebSocket } from './websocket/oddsUpdatesWs';
import eventsRouter from "./routes/events";
import oddsRouter from "./routes/odds";
import betsRouter from "./routes/bets";
import profitLossRouter from "./routes/profitLoss";
import usersRouter from "./routes/users";
import liveBetsRouter from "./routes/liveBets";
import adminRouter from "./routes/admin";
import resellerRouter from "./routes/reseller";
import superadminRouter from "./routes/superadmin";
import sportBettingRouter from "./routes/sportBetting";
import advancedBettingRouter from "./routes/advancedBetting";
import bettingSlipRouter from "./routes/bettingSlip";
import analyticsRouter from "./routes/analytics";
import resellerStatsRouter from "./routes/resellerStats";
import xcodetecRouter from "./routes/xcodetec";
import superbetRouter from "./routes/superbet";

const app = express();
const PORT = process.env.PORT || 4000;
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

app.use(express.json());
app.use(globalRateLimit);

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-site-password,x-user-id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", async (_req, res) => {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || 'unknown',
  };

  // Check Redis
  try {
    const { getRedisClient } = await import('./services/cacheService');
    const redis = getRedisClient();
    const redisPing = await redis.ping();
    health.redis = { status: redisPing === 'PONG' ? 'ok' : 'error', ping: redisPing };
  } catch (err) {
    health.redis = { status: 'error', error: String(err) };
    health.status = 'degraded';
  }

  // Check live feed last update
  try {
    const live = getCachedLiveEvents();
    health.superbet = {
      liveEvents: live.length,
      lastUpdate: live.length > 0 ? 'recent' : 'none',
      status: live.length > 0 ? 'ok' : 'warning',
    };
  } catch (err) {
    health.superbet = { status: 'error', error: String(err) };
  }

  // WebSocket stats
  health.websocket = {
    connectedClients: liveClients.size,
    status: liveClients.size > 0 ? 'active' : 'idle'
  };

  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use(passwordCheck);

// ── Admin routes ──────────────────────────────────────────────────────────────

app.post('/admin/settle', requireAdminOrSuperadmin, async (_req, res) => {
  const result = await settlePendingBets();
  res.json(result);
});

app.post('/admin/settle/:codice', requireAdminOrSuperadmin, async (req, res) => {
  const { codice } = req.params;
  try {
    const result = await settleOneBet(codice.toUpperCase());
    res.json({ ok: true, ...result });
  } catch (err) {
    res.json({ ok: false, error: String(err) });
  }
});

app.post('/admin/result/:codice', requireAdminOrSuperadmin, async (req, res) => {
  const { codice } = req.params;
  const { result } = req.body as { result: 'win' | 'lose' | 'pending' };
  if (!['win', 'lose', 'pending'].includes(result)) {
    return res.status(400).json({ error: 'result must be win, lose, or pending' });
  }
  const { supabase } = await import('./db/supabase');
  const { data, error } = await supabase
    .from('bets')
    .update({ result, settled_at: result !== 'pending' ? new Date().toISOString() : null })
    .eq('codice_schedina', codice.toUpperCase())
    .select('codice_schedina, result')
    .single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true, ...data });
});

app.post('/admin/cache/clear', requireAdminOrSuperadmin, async (_req, res) => {
  try {
    const { getRedisClient } = await import('./services/cacheService');
    const client = getRedisClient();
    await client.del('events:all');
    await client.del('lock:events:refresh');
    res.json({ ok: true, message: 'Cache svuotata, refresh in corso...' });
    // Forza refresh in background
    refreshEvents().catch(console.error);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/admin/debug/xcodetec', requireAdminOrSuperadmin, async (_req, res) => {
  try {
    const XCODE_BASE = 'https://api.xcodetec.com/api';
    const ORIGIN = process.env.XCODETEC_ORIGIN ?? 'https://www.betsport.one';
    const headers = {
      'Origin': ORIGIN, 'Referer': ORIGIN + '/',
      'Accept': 'application/json', 'Skin-Language': 'it-IT', 'Skin-TZ': 'Europe/Rome',
      'Authorization': `Bearer ${process.env.XCODETEC_BEARER_TOKEN ?? 'null'}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    // Test navbar
    const navbarRes = await fetch(`${XCODE_BASE}/sport/navbar`, { headers, signal: AbortSignal.timeout(10000) });
    const navbarStatus = navbarRes.status;
    let navbarSports = 0;
    let navbarSample: unknown = null;
    if (navbarRes.ok) {
      const data = await navbarRes.json() as { data?: { sports?: unknown[] } };
      const sports = data?.data?.sports ?? [];
      navbarSports = (sports as unknown[]).length;
      navbarSample = (sports as unknown[]).slice(0, 2);
    } else {
      navbarSample = await navbarRes.text().catch(() => 'no body');
    }

    // Test live snapshot
    const liveRes = await fetch(`${XCODE_BASE}/live/snapshot`, { headers, signal: AbortSignal.timeout(10000) });
    const liveStatus = liveRes.status;
    let liveEvents = 0;
    if (liveRes.ok) {
      const data = await liveRes.json() as { data?: { events?: unknown[] } };
      liveEvents = (data?.data?.events ?? []).length;
    }

    return res.json({
      navbar: { status: navbarStatus, sports: navbarSports, sample: navbarSample },
      live: { status: liveStatus, events: liveEvents },
      token: process.env.XCODETEC_BEARER_TOKEN ? 'SET' : 'NOT SET',
      origin: ORIGIN,
    });
  } catch (err) {
    return res.json({ error: String(err) });
  }
});

app.get('/admin/debug/events', requireAdminOrSuperadmin, async (_req, res) => {
  try {
    const { getEvents } = await import('./services/cacheService');
    const events = (await getEvents() as Array<{
      id: string; sport_category?: string; league?: { name: string };
      home: { name: string }; away: { name: string };
      bookmakers?: Array<{ markets?: Array<{ key: string; outcomes?: Array<{ price: number }> }> }>;
    }> | null) ?? [];

    function hasOdds(e: typeof events[0]): boolean {
      for (const bk of e.bookmakers ?? []) {
        const h2h = bk.markets?.find(m => m.key === 'h2h');
        if (!h2h) continue;
        const prices = (h2h.outcomes ?? []).map(o => o.price).filter(p => p > 1 && p <= 50);
        if (prices.length >= 2) return true;
      }
      return false;
    }

    // Conta per sport_category
    const bySport: Record<string, { total: number; withOdds: number }> = {};
    for (const e of events) {
      const cat = e.sport_category ?? 'unknown';
      if (!bySport[cat]) bySport[cat] = { total: 0, withOdds: 0 };
      bySport[cat].total++;
      if (hasOdds(e)) bySport[cat].withOdds++;
    }

    // Campione senza quote
    const noOdds = events.filter(e => !hasOdds(e)).slice(0, 5).map(e => ({
      id: e.id, sport: e.sport_category, league: e.league?.name,
      home: e.home.name, away: e.away.name,
    }));

    return res.json({ total: events.length, bySport, noOddsSample: noOdds });
  } catch (err) {
    return res.json({ error: String(err) });
  }
});

app.get('/admin/debug/bet/:codice', requireAdminOrSuperadmin, async (req, res) => {
  const { supabase } = await import('./db/supabase');
  const { data: bet } = await supabase.from('bets').select('*').eq('codice_schedina', req.params.codice.toUpperCase()).single();
  if (!bet) return res.status(404).json({ error: 'Not found' });
  res.json({
    codice: bet.codice_schedina, created_at: bet.created_at, result: bet.result,
    selections: bet.selections.map((s: { nome_evento: string; market: string; outcome: string; result?: string }) => ({
      evento: s.nome_evento, market: s.market, outcome: s.outcome, result: s.result,
    })),
  });
});

app.post('/admin/cancel/:codice', requireAdminOrSuperadmin, async (req, res) => {
  const { codice } = req.params;
  const { supabase } = await import('./db/supabase');

  // Fetch first to check current result and get bet details for refund
  const { data: existing } = await supabase
    .from('bets')
    .select('result, nome_proprietario, stake, tipo_schedina')
    .eq('codice_schedina', codice.toUpperCase())
    .single();

  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.result === 'win' || existing.result === 'lose') {
    return res.status(400).json({ error: 'Non è possibile annullare una schedina già risolta.' });
  }

  const { data, error } = await supabase
    .from('bets')
    .update({ result: 'cancelled', settled_at: new Date().toISOString(), paid_at: null })
    .eq('codice_schedina', codice.toUpperCase())
    .select('codice_schedina, result')
    .single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });

  // Rimborsa la puntata solo se era una schedina "Scommetti" (saldo scalato)
  // Le schedine "Prenota" non scalano il saldo, quindi non vanno rimborsate
  if (existing.tipo_schedina !== 'prenotazione' && existing.nome_proprietario) {
    const { data: user } = await supabase
      .from('users')
      .select('id, balance')
      .eq('username', existing.nome_proprietario)
      .single();

    if (user) {
      const newBalance = Number(user.balance) + Number(existing.stake);
      await supabase
        .from('users')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }
  }

  return res.json({ ok: true, ...data });
});

app.post('/admin/paid/:codice', requireAdminOrSuperadmin, async (req, res) => {
  const { codice } = req.params;
  const { paid } = req.body as { paid: boolean };
  const { supabase } = await import('./db/supabase');

  // Fetch the bet first to get owner and potential_win
  const { data: bet, error: fetchErr } = await supabase
    .from('bets')
    .select('codice_schedina, paid_at, nome_proprietario, potential_win, result')
    .eq('codice_schedina', codice.toUpperCase())
    .single();

  if (fetchErr || !bet) return res.status(404).json({ error: 'Not found' });

  // Prevent double-payment
  if (paid && bet.paid_at) return res.status(409).json({ error: 'Già pagata' });

  // Only allow paying winning bets
  if (paid && bet.result !== 'win') return res.status(400).json({ error: 'Solo le schedine vincenti possono essere pagate' });

  const { data, error } = await supabase
    .from('bets')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('codice_schedina', codice.toUpperCase())
    .select('codice_schedina, paid_at')
    .single();

  if (error || !data) return res.status(500).json({ error: 'Aggiornamento fallito' });

  // Credit the winner's balance if paying
  if (paid) {
    const { data: user } = await supabase
      .from('users')
      .select('id, balance')
      .eq('username', bet.nome_proprietario)
      .single();

    if (user) {
      const newBalance = Number(user.balance) + Number(bet.potential_win);
      await supabase
        .from('users')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }
  }

  return res.json({ ok: true, ...data });
});

// Mount routes
app.use("/events", eventsRouter);
app.use("/odds", oddsRouter);
app.use("/bets", betRateLimit, sanitizeInput, betsRouter);
app.use("/profit-loss", profitLossRouter);
app.use("/users", usersRouter);
app.use("/reseller", resellerRouter);
app.use("/admin", adminRouter);
app.use("/superadmin", superadminRouter);
// Sport-Betting-API routes
app.use("/api/sport-betting", sportBettingRouter);
// Advanced Betting System - GoldBet level
app.use("/api/advanced-betting", advancedBettingRouter);
// Betting Slip System - Scontrino Avanzato
app.use("/api/betting-slip", bettingSlipRouter);
// Analytics routes
app.use("/api/analytics", analyticsRouter);
// Reseller Stats routes
app.use("/api/reseller", resellerStatsRouter);
// Live bet protection routes (path completi definiti nel router)
app.use("/", liveBetsRouter);

// Punteggi live correnti (xcodetec feed)
app.get('/live/scores', (_req, res) => {
  res.json(getCachedLiveEvents());
});

// Proxy superbet24 / sibet90
app.use('/superbet', superbetRouter);

// Legacy xcodetec proxy (disabilitato come sorgente dati principale)
app.use('/xcodetec', xcodetecRouter);

app.get('/live/odds/:eventId', (req, res) => {
  const odds = getLiveOdds(req.params.eventId);
  if (!odds) return res.status(404).json({ error: 'Evento non trovato o non live' });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    odds,
    sportMarkets: getSportMarkets(req.params.eventId),
    locked: isMarketLocked(req.params.eventId),
    countdown: getLockCountdown(req.params.eventId),
    _ts: Date.now(),
  });
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

const server = http.createServer(app);

// WebSocket server on path /ws/live
const wss = new WebSocketServer({ server, path: '/ws/live' });

// WebSocket server for odds updates on path /ws/odds
const oddsWss = new WebSocketServer({ server, path: '/ws/odds' });
setupOddsUpdatesWebSocket(oddsWss);

// Track connected clients
const liveClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  liveClients.add(ws);
  console.log(`[ws] client connected (total: ${liveClients.size})`);

  // Send current cached live data immediately on connect
  const cachedLive = getCachedLiveEvents();
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'live', data: cachedLive, ts: Date.now() }));
  }

  ws.on('close', () => {
    liveClients.delete(ws);
    console.log(`[ws] client disconnected (total: ${liveClients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[ws] client error:', err.message);
    liveClients.delete(ws);
  });
});

// Broadcast live data to all connected WS clients
function broadcastLive(data: unknown[]) {
  if (liveClients.size === 0) return;
  const msg = JSON.stringify({ type: 'live', data, ts: Date.now() });
  for (const client of liveClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

// Avvia il server subito, il refresh eventi gira in background
server.listen(PORT, () => {
  console.log(`BigBet365 backend running on port ${PORT} (HTTP + WS /ws/live + /ws/odds)`);

  // Refresh prematch in background (non blocca l'avvio)
  // Rilascia eventuale lock rimasto da run precedenti
  import('./services/cacheService').then(({ releaseLock }) => {
    releaseLock('lock:events:refresh').catch(() => {});
  });
  refreshEvents().catch(err => console.error('Initial cache warm failed:', err));

  // Refresh ogni 3 minuti
  setInterval(() => {
    refreshEvents().catch(console.error);
  }, 3 * 60 * 1000);

  // Auto-settle pending bets every 30 minutes
  setTimeout(() => {
    settlePendingBets().then(r => console.log(`Auto-settle: ${r.settled} settled, ${r.skipped} skipped`)).catch(console.error);
    setInterval(() => {
      settlePendingBets().then(r => console.log(`Auto-settle: ${r.settled} settled, ${r.skipped} skipped`)).catch(console.error);
    }, 30 * 60 * 1000);
  }, 5 * 60 * 1000);

  // Refresh live scores every 10 seconds and broadcast via WebSocket
  async function refreshLive() {
    try {
      const live = await refreshLiveEvents();
      broadcastLive(live);
      if (live.length > 0) console.log(`[live] ${live.length} live events → ${liveClients.size} ws clients`);
    } catch (err) {
      console.error('[live] refresh error:', err);
    }
  }

  refreshLive();
  setInterval(refreshLive, 10 * 1000);

  // Feed legacy xcodetec (solo se USE_XCODETEC=true)
  if (process.env.USE_XCODETEC === 'true') {
    startXcodetecLiveFeed();

    onXcodetecLiveUpdate(({ changedEventIds }) => {
      for (const eventId of changedEventIds) {
        const wsEventId = `xc_live_${eventId}`;
        const odds = getLiveOdds(wsEventId);
        if (!odds) continue;
        const msg = JSON.stringify({
          type: 'odds_update',
          eventId: wsEventId,
          odds,
          locked: isMarketLocked(wsEventId),
          countdown: getLockCountdown(wsEventId),
          ts: Date.now(),
        });
        for (const client of liveClients) {
          if (client.readyState === WebSocket.OPEN) client.send(msg);
        }
      }
    });
  }

  // ── Live odds scheduler (ogni 3s) ──────────────────────────────────────────
  startLiveOddsScheduler();

  // Broadcast quote live aggiornate a tutti i client WS
  onOddsUpdate((eventId, odds, locked) => {
    if (liveClients.size === 0) return;
    const msg = JSON.stringify({
      type: 'odds_update',
      eventId,
      odds,
      locked,
      countdown: getLockCountdown(eventId),
      ts: Date.now(),
    });
    for (const client of liveClients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  });
});

export default app;
