import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import {
  generateCodiceSchedina,
  computeTotalOdds,
  computePotentialWin,
  computeDebounceKey,
  computeSystemPotentialWin,
  combinations,
  Selection,
} from '../services/betService';
import { checkDebounce, setDebounce } from '../services/cacheService';
import { settleOneBet } from '../services/settleService';
import { isEventLive, getEventH2HOdds, getDynamicLiveOdds, LIVE_MARGIN } from '../services/liveService';
import { LIVE_MAX_STAKE } from '../constants/betting';
import { getAuthenticatedUserId, hasBearerToken } from '../middleware/auth';
import { requireRoles } from '../middleware/roleAuth';

const router = Router();
const DEBOUNCE_TTL = 5; // seconds
const MAX_POTENTIAL_WIN = 50000; // â‚¬50.000,00
const LIVE_ODDS_TOLERANCE = 0.03; // 3% tolerance before rejecting
const SETTLE_DEBOUNCE_TTL = 300; // 5 minutes cooldown per schedina
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');
const MAX_REQUEST_BODY_CHARS = 50000;
const MAX_TEXT_FIELD_LEN = 120;

type RequesterContext = {
  id: string;
  role: string;
};

async function getRequesterContext(req: Request): Promise<RequesterContext | null> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return null;

  const { data: requester, error: requesterErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (requesterErr || !requester) return null;
  return { id: userId, role: requester.role };
}

function rejectIfPayloadTooLarge(req: Request, res: Response): boolean {
  try {
    const size = JSON.stringify(req.body ?? {}).length;
    if (size > MAX_REQUEST_BODY_CHARS) {
      res.status(413).json({ error: `Payload troppo grande (max ${MAX_REQUEST_BODY_CHARS} caratteri).` });
      return true;
    }
    return false;
  } catch {
    res.status(400).json({ error: 'Payload non valido.' });
    return true;
  }
}

function isValidSelection(selection: Selection): boolean {
  if (!selection || typeof selection !== 'object') return false;

  const strFields = [selection.event_id, selection.nome_evento, selection.market, selection.outcome];
  if (strFields.some((v) => typeof v !== 'string' || v.trim().length === 0 || v.length > MAX_TEXT_FIELD_LEN)) {
    return false;
  }

  if (typeof selection.quota !== 'number' || !Number.isFinite(selection.quota)) return false;
  if (selection.quota < 1.01 || selection.quota > 1000) return false;

  return true;
}

function isValidAcceptedOdds(accepted_odds: Record<string, number> | undefined): boolean {
  if (accepted_odds === undefined) return true;
  if (!accepted_odds || typeof accepted_odds !== 'object' || Array.isArray(accepted_odds)) return false;
  const entries = Object.entries(accepted_odds);
  if (entries.length > 20) return false;
  return entries.every(([eventId, odd]) =>
    typeof eventId === 'string' &&
    eventId.trim().length > 0 &&
    eventId.length <= MAX_TEXT_FIELD_LEN &&
    typeof odd === 'number' &&
    Number.isFinite(odd) &&
    odd >= 1.01 &&
    odd <= 1000
  );
}

// Apply live margin to a decimal odd
function applyLiveMargin(decimalOdd: number): number {
  if (!decimalOdd || decimalOdd <= 1) return 0;
  const impliedProb = 1 / decimalOdd;
  const adjusted = Math.min(0.97, impliedProb * (1 + LIVE_MARGIN));
  return parseFloat((1 / adjusted).toFixed(2));
}

// Map outcome label to team name for h2h lookup
function resolveOutcomeOdd(
  outcome: string,
  currentOdds: { home: number; draw: number; away: number }
): number {
  if (outcome === '1') return applyLiveMargin(currentOdds.home);
  if (outcome === 'X') return currentOdds.draw > 1 ? applyLiveMargin(currentOdds.draw) : 0;
  if (outcome === '2') return applyLiveMargin(currentOdds.away);
  return 0;
}

//resolveOutcomeOdd... existing code ...

// POST /bet/book â€” generate a booking code (no money taken)
router.post('/book', async (req: Request, res: Response) => {
  if (rejectIfPayloadTooLarge(req, res)) return;

  const { selections, stake, is_live, sistema_k } = req.body as {
    selections: Selection[];
    stake: number;
    is_live?: boolean;
    sistema_k?: number;
  };

  if (!selections || selections.length === 0) {
    return res.status(400).json({ error: 'Nessuna selezione fornita.' });
  }
  if (!Array.isArray(selections) || selections.length > 20 || selections.some((s) => !isValidSelection(s))) {
    return res.status(400).json({ error: 'Formato selezioni non valido.' });
  }
  if (typeof stake !== 'number' || !Number.isFinite(stake) || stake <= 0) {
    return res.status(400).json({ error: 'stake must be a positive number.' });
  }
  if (is_live !== undefined && typeof is_live !== 'boolean') {
    return res.status(400).json({ error: 'is_live non valido.' });
  }
  if (sistema_k !== undefined && (!Number.isInteger(sistema_k) || sistema_k < 2 || sistema_k > selections.length)) {
    return res.status(400).json({ error: 'sistema_k non valido.' });
  }

  const bookingCode = 'PR' + Math.random().toString(36).substring(2, 7).toUpperCase();
  
  const { error } = await supabase.from('bookings').insert({
    code: bookingCode,
    selections,
    stake,
    is_live,
    sistema_k,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Errore durante la prenotazione.' });
  }

  return res.json({ booking_code: bookingCode });
});

// GET /bet/book/:code â€” retrieve a booked bet
router.get('/book/:code', async (req: Request, res: Response) => {
  const requester = await getRequesterContext(req);
  if (!requester) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  if (!['admin', 'superadmin', 'reseller'].includes(requester.role)) {
    return res.status(403).json({ error: 'Accesso non autorizzato' });
  }

  const { code } = req.params;
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Codice non trovato o scaduto.' });
  }

  return res.json(data);
});

router.post('/', async (req: Request, res: Response) => {
  if (rejectIfPayloadTooLarge(req, res)) return;
  const { nome_proprietario, stake, selections, accepted_odds, is_live, bonus_pct, sistema_k, stake_per_combo } = req.body as {
    nome_proprietario?: string;
    stake: number;
    selections: Selection[];
    accepted_odds?: Record<string, number>;
    is_live?: boolean;
    bonus_pct?: number;
    sistema_k?: number;
    stake_per_combo?: number; // puntata per singola combo (stile Goldbet)
  };

  // Optional authenticated user id (guest bets are still allowed)
  const userId = await getAuthenticatedUserId(req);
  if (hasBearerToken(req) && !userId) {
    return res.status(401).json({ error: 'Token non valido o scaduto.' });
  }

  // nome_proprietario is optional â€” default to empty string
  const ownerName = (nome_proprietario ?? '').trim();
  if (ownerName.length > MAX_TEXT_FIELD_LEN) {
    return res.status(400).json({ error: `nome_proprietario troppo lungo (max ${MAX_TEXT_FIELD_LEN}).` });
  }

  if (!stake || typeof stake !== 'number' || stake <= 0) {
    return res.status(400).json({ error: 'stake must be a positive number.' });
  }
  if (stake < 1) {
    return res.status(400).json({ error: 'Puntata minima: EUR 1.00' });
  }
  if (stake > 5000) {
    return res.status(400).json({ error: 'Puntata massima per schedina: EUR 5000.00' });
  }
  if (!Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ error: 'selections must be a non-empty array.' });
  }
  if (selections.length > 20) {
    return res.status(400).json({ error: 'Massimo 20 selezioni per schedina.' });
  }
  if (selections.some((s) => !isValidSelection(s))) {
    return res.status(400).json({ error: 'Formato selezioni non valido.' });
  }
  if (!isValidAcceptedOdds(accepted_odds)) {
    return res.status(400).json({ error: 'accepted_odds non valido.' });
  }
  if (is_live !== undefined && typeof is_live !== 'boolean') {
    return res.status(400).json({ error: 'is_live non valido.' });
  }
  if (bonus_pct !== undefined && (typeof bonus_pct !== 'number' || !Number.isFinite(bonus_pct) || bonus_pct < 0 || bonus_pct > 100)) {
    return res.status(400).json({ error: 'bonus_pct non valido.' });
  }
  if (sistema_k !== undefined && (!Number.isInteger(sistema_k) || sistema_k < 2 || sistema_k >= selections.length)) {
    return res.status(400).json({ error: 'sistema_k non valido.' });
  }
  if (stake_per_combo !== undefined && (typeof stake_per_combo !== 'number' || !Number.isFinite(stake_per_combo) || stake_per_combo <= 0)) {
    return res.status(400).json({ error: 'stake_per_combo non valido.' });
  }

  // â”€â”€ Live bet validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Check if any selection is a live event
  const liveSelections = selections.filter(s => isEventLive(s.event_id));
  const hasLiveBets = is_live === true || liveSelections.length > 0;

  if (hasLiveBets) {
    // Enforce live stake limit
    if (stake > LIVE_MAX_STAKE) {
      return res.status(400).json({ error: `Puntata massima per scommesse live: EUR ${LIVE_MAX_STAKE.toFixed(2)}` });
    }

    // Odds change protection â€” compare accepted_odds vs current cached odds
    if (accepted_odds && Object.keys(accepted_odds).length > 0) {
      const changedOdds: Record<string, { accepted: number; current: number }> = {};

      for (const sel of liveSelections) {
        const acceptedQuota = accepted_odds[sel.event_id];
        if (!acceptedQuota) continue;

        const currentH2H = getDynamicLiveOdds(sel.event_id) ?? getEventH2HOdds(sel.event_id);
        if (!currentH2H) continue;

        const currentQuota = resolveOutcomeOdd(sel.outcome ?? '', currentH2H);
        if (!currentQuota || currentQuota <= 1) continue;

        // Check if odds changed more than tolerance
        const diff = Math.abs(currentQuota - acceptedQuota) / acceptedQuota;
        if (diff > LIVE_ODDS_TOLERANCE) {
          changedOdds[sel.event_id] = { accepted: acceptedQuota, current: currentQuota };
        }
      }

      if (Object.keys(changedOdds).length > 0) {
        return res.status(409).json({
          error: 'Le quote sono cambiate. Conferma le nuove quote per procedere.',
          changed_odds: changedOdds,
        });
      }
    }
  }

  // â”€â”€ Balance check & deduction (only for logged-in users) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let balanceDeducted = false;
  if (userId) {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('balance, is_blocked, role')
      .eq('id', userId)
      .single();

    if (userErr || !userRow) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }
    if (userRow.is_blocked) {
      return res.status(403).json({ error: 'Account bloccato. Contatta il supporto.' });
    }

    // Admin e superadmin hanno saldo illimitato â€” skip balance check
    const isPrivileged = userRow.role === 'admin' || userRow.role === 'superadmin';
    if (!isPrivileged) {
      if (Number(userRow.balance) < stake) {
        return res.status(402).json({ error: `Saldo insufficiente. Saldo disponibile: EUR ${Number(userRow.balance).toFixed(2)}` });
      }

      // Deduct balance atomically
      const { error: deductErr } = await supabase
        .from('users')
        .update({
          balance: Number(userRow.balance) - stake,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('balance', userRow.balance); // optimistic lock

      if (deductErr) {
        return res.status(500).json({ error: 'Errore durante la deduzione del saldo. Riprova.' });
      }
      balanceDeducted = true;
    }
  }

  // Debounce check â€” reject duplicate submissions within 5 seconds
  const debounceKey = computeDebounceKey(ownerName, selections);
  const isDuplicate = await checkDebounce(debounceKey);
  if (isDuplicate) {
    // Refund only if we actually deducted
    if (balanceDeducted) await supabase.rpc('credit_balance', { p_user_id: userId, p_amount: stake });
    return res.status(429).json({ error: 'Scommessa duplicata. Attendi prima di riprovare.' });
  }

  // Compute server-side values
  const codice_schedina = generateCodiceSchedina();
  const validBonusPct = typeof bonus_pct === 'number' && bonus_pct >= 0 && bonus_pct <= 100 ? bonus_pct : 0;

  // Scommessa sistema: sistema_k deve essere >= 2 e < selections.length
  const isSystem = typeof sistema_k === 'number' && sistema_k >= 2 && sistema_k < selections.length;

  let total_odds: number;
  let potential_win: number;
  let tipo_schedina: string;
  let sistema_info: { k: number; n: number; num_combinations: number; stake_per_combo: number } | undefined;

  if (isSystem) {
    // stake_per_combo = puntata per singola combinazione (stile Goldbet)
    // stake = totale giÃ  calcolato dal frontend (stake_per_combo Ã— numCombinations)
    const perCombo = stake_per_combo ?? (stake / combinations(selections, sistema_k!).length);
    const { potentialWin, numCombinations, stakePerCombo } = computeSystemPotentialWin(perCombo, selections, sistema_k!);
    total_odds = 0;
    potential_win = potentialWin;
    tipo_schedina = `sistema_${sistema_k}/${selections.length}`;
    sistema_info = { k: sistema_k!, n: selections.length, num_combinations: numCombinations, stake_per_combo: stakePerCombo };
  } else {
    total_odds = computeTotalOdds(selections);
    potential_win = computePotentialWin(stake, total_odds, selections);
    tipo_schedina = selections.length === 1 ? 'singola' : 'multipla';
  }

  // Guard against numeric overflow â€” NUMERIC(10,4) max is 999999.9999
  if (total_odds > 999999 || potential_win > 99999999) {
    if (balanceDeducted) await supabase.rpc('credit_balance', { p_user_id: userId, p_amount: stake });
    return res.status(400).json({ error: 'Quota totale troppo alta. Riduci il numero di selezioni.' });
  }

  // Insert into Supabase
  const { data, error } = await supabase
    .from('bets')
    .insert({
      codice_schedina,
      user_id: userId ?? null,
      nome_proprietario: ownerName,
      stake,
      selections,
      total_odds,
      potential_win,
      result: 'pending',
      tipo_schedina: tipo_schedina ?? (selections.length === 1 ? 'singola' : 'multipla'),
      ...(sistema_info ? { sistema_info } : {}),
    })
    .select('codice_schedina, created_at')
    .single();

  if (error) {
    // Refund on DB error
    if (balanceDeducted) await supabase.rpc('credit_balance', { p_user_id: userId, p_amount: stake });
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Duplicate codice_schedina. Please retry.' });
    }
    console.error('POST /bet DB error:', JSON.stringify(error));
    return res.status(500).json({ error: 'Failed to store bet.', detail: error.message });
  }

  // Registra la Liability sui mercati (Risk Management / Market Maker)
  try {
    const { recordLiability } = await import('../services/liabilityEngine');
    const stakePerSel = stake / selections.length; // Approximate risk allocation
    for (const sel of selections) {
      if (sel.market && sel.outcome) {
        // Normalizza il nome del mercato per il liability tracker
        let m = sel.market.toLowerCase();
        let o = sel.outcome.toLowerCase();
        if (m === '1x2' || m === 'testa a testa' || m === 'h2h') m = 'h2h';
        if (m === 'o/u' || m === 'under/over' || m === 'totals') m = 'totals';
        if (m === 'h2h') {
          if (o.includes('1') || o.includes('casa')) o = 'home';
          if (o.includes('x') || o.includes('pareggio')) o = 'draw';
          if (o.includes('2') || o.includes('ospite')) o = 'away';
        }
        if (m === 'totals') {
          if (o.includes('over')) o = 'over';
          if (o.includes('under')) o = 'under';
        }
        
        await recordLiability(sel.event_id, m, o, stakePerSel).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[liability] Error recording bet:', err);
  }

  // Set debounce key only after successful insert
  await setDebounce(debounceKey, DEBOUNCE_TTL);

  return res.status(201).json(data);
});

// PATCH /bets/:codice/result â€” update bet result (win/lose/pending)
router.patch('/:codice/result', requireAdminOrSuperadmin, async (req: Request, res: Response) => {
  const { codice } = req.params;
  const { result } = req.body as { result: 'win' | 'lose' | 'pending' };

  if (!['win', 'lose', 'pending'].includes(result)) {
    return res.status(400).json({ error: 'result must be win, lose, or pending.' });
  }

  const { data, error } = await supabase
    .from('bets')
    .update({
      result,
      settled_at: result !== 'pending' ? new Date().toISOString() : null,
    })
    .eq('codice_schedina', codice.toUpperCase())
    .select('codice_schedina, result, settled_at')
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Schedina non trovata.' });
  }
  return res.json(data);
});

// POST /bets/:codice/settle â€” trigger settle for a specific bet (public, debounced)
router.post('/:codice/settle', requireAdminOrSuperadmin, async (req: Request, res: Response) => {
  const { codice } = req.params;
  const debounceKey = `settle:${codice.toUpperCase()}`;
  // Debounce: only settle once every 5 minutes per schedina
  const alreadyRunning = await checkDebounce(debounceKey);
  if (alreadyRunning) {
    return res.json({ ok: true, skipped: true, reason: 'debounced' });
  }
  await setDebounce(debounceKey, SETTLE_DEBOUNCE_TTL);
  try {
    const result = await settleOneBet(codice.toUpperCase());
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error(`settle /${codice} error:`, err);
    return res.json({ ok: false });
  }
});

// GET /bets/:codice â€” lookup a single bet by codice_schedina
router.get('/:codice', async (req: Request, res: Response) => {
  const requester = await getRequesterContext(req);
  if (!requester) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const { codice } = req.params;
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('codice_schedina', codice.toUpperCase())
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Schedina non trovata.' });
  }

  const isPrivileged = requester.role === 'admin' || requester.role === 'superadmin';
  if (!isPrivileged && data.user_id !== requester.id) {
    return res.status(403).json({ error: 'Accesso non autorizzato' });
  }
  return res.json(data);
});

// GET /bets â€” retrieve bet history with optional date filtering
router.get('/', async (req: Request, res: Response) => {
  const requester = await getRequesterContext(req);
  if (!requester) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const { date, from, to } = req.query as {
    date?: string;
    from?: string;
    to?: string;
  };

  let query = supabase.from('bets').select('*').order('created_at', { ascending: false });
  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    query = query.eq('user_id', requester.id);
  }

  if (from && to) {
    // Custom date range
    query = query.gte('created_at', new Date(from).toISOString())
                 .lte('created_at', new Date(to + 'T23:59:59.999Z').toISOString());
  } else if (date) {
    // Specific date
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
  } else {
    // Default: today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    query = query.gte('created_at', today.toISOString()).lte('created_at', endOfDay.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('GET /bets DB error:', error);
    return res.status(500).json({ error: 'Failed to retrieve bets.' });
  }

  return res.json(data ?? []);
});

export default router;



