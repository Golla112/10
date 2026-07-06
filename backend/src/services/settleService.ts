import { supabase } from '../db/supabase';
import { combinations, settleSystemBet } from './betService';

/**
 * Updates the reseller's balance when one of their users' bets is settled.
 */
export async function updateResellerBalanceOnSettle(
  userId: string,
  result: 'win' | 'lose',
  stake: number,
  potentialWin: number
): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('reseller_id')
    .eq('id', userId)
    .single();

  if (!user?.reseller_id) return;

  const resellerId = user.reseller_id;
  const amount = result === 'win' ? -potentialWin : stake;

  const { error } = await supabase.rpc('credit_balance', {
    p_user_id: resellerId,
    p_amount: amount,
  });

  if (error) {
    console.error(`[settle] Reseller balance update error for reseller ${resellerId}:`, error);
  } else {
    console.log(`[settle] \uD83D\uDCBC Reseller ${resellerId} balance ${result === 'win' ? '-' : '+'}€${Math.abs(amount).toFixed(2)} (user bet ${result})`);
  }
}

// All sport keys we track for fallback sources
const SPORT_KEYS = [
  'soccer_italy_serie_a', 'soccer_italy_serie_b',
  'soccer_epl', 'soccer_efl_champ',
  'soccer_spain_la_liga', 'soccer_spain_segunda_division',
  'soccer_germany_bundesliga', 'soccer_germany_bundesliga2',
  'soccer_france_ligue_one', 'soccer_france_ligue_two',
  'soccer_netherlands_eredivisie', 'soccer_portugal_primeira_liga',
  'soccer_uefa_champs_league', 'soccer_uefa_europa_league',
  'soccer_uefa_europa_conference_league',
  'soccer_turkey_super_league', 'soccer_belgium_first_div',
  'soccer_spl', 'soccer_austria_bundesliga', 'soccer_greece_super_league',
  'soccer_sweden_allsvenskan', 'soccer_norway_eliteserien',
  'soccer_denmark_superliga', 'soccer_switzerland_superleague',
  'soccer_poland_ekstraklasa', 'soccer_brazil_campeonato',
  'soccer_argentina_primera_division', 'soccer_mexico_ligamx', 'soccer_usa_mls',
];

interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  homeTeam: string;
  awayTeam: string;
  source: string;
}

interface Selection {
  event_id: string;
  nome_evento: string;
  quota: number;
  market: string;
  outcome: string;
  point?: number;
  result?: 'win' | 'lose' | 'pending';
}

function normName(s: string): string {
  return s.toLowerCase()
    .replace(/\bfc\b|\bac\b|\bsc\b|\bss\b|\bas\b|\bssd\b|\bssc\b|\bspa\b|\bcf\b|\bfk\b|\bsk\b|\bif\b|\bik\b|\bafc\b|\bfbc\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na === nb) return true;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  return false;
}

async function findMatchResult(
  homeTeam: string,
  awayTeam: string,
  betCreatedAt: string,
  _eventId?: string
): Promise<MatchResult | null> {
  // Sofascore disabilitato su richiesta esplicita.
  // Qui può essere integrato un provider alternativo per il settlement.
  void homeTeam;
  void awayTeam;
  void betCreatedAt;
  return null;
}

function evaluateSelection(sel: Selection, match: MatchResult): boolean | null {
  const hg = match.homeGoals;
  const ag = match.awayGoals;
  const market = (sel.market ?? '').toLowerCase().trim();
  const outcome = (sel.outcome ?? '').toLowerCase().trim();

  // 1X2 / H2H
  if (market === '1x2' || market === 'h2h' || market === 'testa a testa') {
    if (outcome === '1' || outcome === 'home' || outcome.includes('casa')) return hg > ag;
    if (outcome === 'x' || outcome === 'draw' || outcome.includes('pareggio')) return hg === ag;
    if (outcome === '2' || outcome === 'away' || outcome.includes('ospite')) return ag > hg;
  }

  // Over/Under
  if (market === 'o/u' || market === 'over/under' || market === 'totals') {
    const total = hg + ag;
    const line = sel.point ?? 2.5;
    if (outcome.includes('over')) return total > line;
    if (outcome.includes('under')) return total < line;
  }

  // GG/NG
  if (market === 'gg/ng' || market === 'btts') {
    if (outcome === 'gg' || outcome === 'yes') return hg > 0 && ag > 0;
    if (outcome === 'ng' || outcome === 'no') return hg === 0 || ag === 0;
  }

  return null;
}

async function processSelections(
  selections: Selection[],
  betCreatedAt: string
): Promise<{ updated: Selection[]; anyLost: boolean; anyPending: boolean }> {
  let anyLost = false;
  let anyPending = false;
  const updated: Selection[] = [];

  for (const sel of selections) {
    if (sel.result === 'win' || sel.result === 'lose') {
      updated.push(sel);
      if (sel.result === 'lose') anyLost = true;
      continue;
    }

    const parts = sel.nome_evento.split(/\s+vs\.?\s+/i);
    if (parts.length < 2) {
      anyPending = true;
      updated.push({ ...sel, result: 'pending' });
      continue;
    }

    const [homeTeam, awayTeam] = parts;
    const match = await findMatchResult(homeTeam.trim(), awayTeam.trim(), betCreatedAt, sel.event_id);

    if (!match) {
      anyPending = true;
      updated.push({ ...sel, result: 'pending' });
      continue;
    }

    const evalResult = evaluateSelection(sel, match);
    if (evalResult === null) {
      anyPending = true;
      updated.push({ ...sel, result: 'pending' });
    } else if (!evalResult) {
      anyLost = true;
      updated.push({ ...sel, result: 'lose' });
    } else {
      updated.push({ ...sel, result: 'win' });
    }
  }

  return { updated, anyLost, anyPending };
}

function computeFinalResult(
  bet: { stake: number; potential_win: number; tipo_schedina?: string; sistema_info?: { k: number; n: number } },
  updatedSelections: Selection[]
): { overallResult: 'win' | 'lose' | 'pending'; actualWin: number } {
  const anyPending = updatedSelections.some(s => s.result === 'pending' || !s.result);
  const tipoSchedina = bet.tipo_schedina ?? '';
  const isSystem = tipoSchedina.startsWith('sistema_') || !!bet.sistema_info;

  if (isSystem) {
    let k = bet.sistema_info?.k;
    if (!k) {
      const m = tipoSchedina.match(/sistema_(\d+)\//);
      k = m ? parseInt(m[1], 10) : 2;
    }
    if (anyPending) return { overallResult: 'pending', actualWin: 0 };
    const selWithResult = updatedSelections.map(s => ({
      quota: s.quota,
      result: (s.result === 'win' ? 'win' : s.result === 'lose' ? 'lose' : 'void') as 'win' | 'lose' | 'void',
    }));
    const { result, actualWin } = settleSystemBet(bet.stake, selWithResult, k);
    return { overallResult: result, actualWin };
  }

  const anyLost = updatedSelections.some(s => s.result === 'lose');
  const allWon = updatedSelections.every(s => s.result === 'win');

  if (anyPending) return { overallResult: 'pending', actualWin: 0 };
  if (anyLost) return { overallResult: 'lose', actualWin: 0 };
  if (allWon) return { overallResult: 'win', actualWin: bet.potential_win };
  return { overallResult: 'pending', actualWin: 0 };
}

export async function settlePendingBets(): Promise<{ settled: number; skipped: number }> {
  // Solo scommesse più vecchie di 2 ore per dare tempo ai match di finire
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: bets, error } = await supabase
    .from('bets').select('*').eq('result', 'pending').lt('created_at', cutoff).limit(50);

  if (error || !bets || bets.length === 0) return { settled: 0, skipped: 0 };

  let settled = 0, skipped = 0;
  for (const bet of bets) {
    const selections: Selection[] = Array.isArray(bet.selections) ? bet.selections : [];
    if (!selections.length) continue;

    const { updated } = await processSelections(selections, bet.created_at);
    const { overallResult, actualWin } = computeFinalResult(bet, updated);

    const payload: Record<string, unknown> = { selections: updated };
    if (overallResult !== 'pending') {
      payload.result = overallResult;
      payload.settled_at = new Date().toISOString();
      if (bet.tipo_schedina?.startsWith('sistema_') && actualWin > 0) {
        payload.potential_win = actualWin;
      }
    }

    const { error: updateErr } = await supabase.from('bets').update(payload).eq('id', bet.id);
    if (updateErr) { skipped++; continue; }

    const winAmount = bet.tipo_schedina?.startsWith('sistema_') ? actualWin : bet.potential_win;

    if (overallResult === 'win' && bet.user_id) {
      await supabase.rpc('credit_balance', { p_user_id: bet.user_id, p_amount: winAmount });
      await updateResellerBalanceOnSettle(bet.user_id, 'win', bet.stake, winAmount);
    } else if (overallResult === 'lose' && bet.user_id) {
      await updateResellerBalanceOnSettle(bet.user_id, 'lose', bet.stake, winAmount);
    }

    if (overallResult !== 'pending') settled++;
    else skipped++;
  }

  return { settled, skipped };
}

export async function settleOneBet(codice: string): Promise<{ result: string; changed: boolean }> {
  const { data: bet, error } = await supabase.from('bets').select('*').eq('codice_schedina', codice).single();
  if (error || !bet || bet.result !== 'pending') return { result: bet?.result || 'not_found', changed: false };

  const selections: Selection[] = Array.isArray(bet.selections) ? bet.selections : [];
  if (!selections.length) return { result: 'pending', changed: false };

  const { updated } = await processSelections(selections, bet.created_at);
  const { overallResult, actualWin } = computeFinalResult(bet, updated);

  const payload: Record<string, unknown> = { selections: updated };
  if (overallResult !== 'pending') {
    payload.result = overallResult;
    payload.settled_at = new Date().toISOString();
    if (bet.tipo_schedina?.startsWith('sistema_') && actualWin > 0) {
      payload.potential_win = actualWin;
    }
  }

  await supabase.from('bets').update(payload).eq('id', bet.id);

  const winAmount = bet.tipo_schedina?.startsWith('sistema_') ? actualWin : bet.potential_win;

  if (overallResult === 'win' && bet.user_id) {
    await supabase.rpc('credit_balance', { p_user_id: bet.user_id, p_amount: winAmount });
    await updateResellerBalanceOnSettle(bet.user_id, 'win', bet.stake, winAmount);
  } else if (overallResult === 'lose' && bet.user_id) {
    await updateResellerBalanceOnSettle(bet.user_id, 'lose', bet.stake, winAmount);
  }

  return { result: overallResult, changed: JSON.stringify(selections) !== JSON.stringify(updated) };
}
