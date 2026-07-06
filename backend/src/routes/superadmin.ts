import { Router } from 'express';
import { supabase, supabaseAdmin } from '../db/supabase';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth';


const router = Router();

// Middleware: solo superadmin può accedere
// Il frontend passa x-superadmin-key (username del superadmin loggato)
// In produzione si userebbe un JWT — qui usiamo il controllo sul DB
router.use(requireAuth, async (req, res, next) => {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ error: 'Non autorizzato' });

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!data || data.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accesso riservato al superadmin' });
  }
  next();
});

// ── STATS GLOBALI ─────────────────────────────────────────────────────────────

router.get('/stats', async (_req, res) => {
  try {
    const [usersRes, betsRes] = await Promise.all([
      supabase.from('users').select('id, role, balance, is_blocked'),
      supabase.from('bets').select('stake, potential_win, result'),
    ]);

    const users = usersRes.data ?? [];
    const bets = betsRes.data ?? [];

    const totalUsers = users.filter(u => u.role === 'user').length;
    const totalResellers = users.filter(u => u.role === 'reseller').length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const totalBalance = users.reduce((s, u) => s + Number(u.balance ?? 0), 0);

    const activeBets = bets.filter(b => b.result === 'pending').length;
    const totalStake = bets.filter(b => b.result !== 'cancelled').reduce((s, b) => s + Number(b.stake ?? 0), 0);
    const totalPaidOut = bets.filter(b => b.result === 'win').reduce((s, b) => s + Number(b.potential_win ?? 0), 0);
    const profit = totalStake - totalPaidOut;

    res.json({ totalUsers, totalResellers, totalAdmins, totalBalance, activeBets, totalStake, totalPaidOut, profit });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GESTIONE ADMIN ────────────────────────────────────────────────────────────

// GET /superadmin/admins — lista admin
router.get('/admins', async (_req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, balance, is_blocked, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /superadmin/admins — crea admin
router.post('/admins', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim()) return res.status(400).json({ error: 'Username obbligatorio' });
  if (!password?.trim() || password.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });

  const cleanUsername = username.trim();
  const { data: existing } = await supabase.from('users').select('id').eq('username', cleanUsername).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Username già in uso' });

  const email = `${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@bb365.app`;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password,
    user_metadata: { username: cleanUsername, role: 'admin' },
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    return res.status(500).json({ error: authError?.message ?? 'Errore creazione account' });
  }

  const { error: upsertError } = await supabaseAdmin.from('users').upsert({
    id: authData.user.id, username: cleanUsername, role: 'admin', balance: 0, is_blocked: false,
  }, { onConflict: 'id' });

  if (upsertError) console.error('[superadmin/admins] upsert error:', upsertError);

  res.status(201).json({ id: authData.user.id, username: cleanUsername, role: 'admin', balance: 0 });
});

// DELETE /superadmin/admins/:id — elimina admin
router.delete('/admins/:id', async (req, res) => {
  const { id } = req.params;
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (authError) return res.status(500).json({ error: authError.message });
  await supabase.from('users').delete().eq('id', id);
  res.json({ ok: true });
});

// PATCH /superadmin/admins/:id/block — blocca/sblocca admin
router.patch('/admins/:id/block', async (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body as { blocked: boolean };
  const { error } = await supabase.from('users').update({ is_blocked: blocked }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── GESTIONE UTENTI ───────────────────────────────────────────────────────────

// GET /superadmin/users — tutti gli account (user, reseller, admin) tranne superadmin
router.get('/users', async (_req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, balance, is_blocked, role, reseller_id, created_at')
    .in('role', ['user', 'reseller', 'admin'])
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// PATCH /superadmin/users/:id/block — blocca/sblocca utente
router.patch('/users/:id/block', async (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body as { blocked: boolean };
  const { error } = await supabase.from('users').update({ is_blocked: blocked }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// PATCH /superadmin/users/:id/password — cambia password utente
router.patch('/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// PATCH /superadmin/users/:id/balance — modifica saldo
router.patch('/users/:id/balance', async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body as { amount: number };
  if (typeof amount !== 'number') return res.status(400).json({ error: 'amount deve essere un numero' });

  // Controlla che il saldo non vada sotto zero
  if (amount < 0) {
    const { data: user } = await supabase.from('users').select('balance').eq('id', id).single();
    if (user && Number(user.balance) + amount < 0) {
      return res.status(400).json({ error: `Saldo insufficiente. Saldo attuale: €${Number(user.balance).toFixed(2)}` });
    }
  }

  const { data, error } = await supabase.rpc('credit_balance', { p_user_id: id, p_amount: amount });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, new_balance: data });
});

// ── SCOMMESSE ─────────────────────────────────────────────────────────────────

// GET /superadmin/bets — tutte le scommesse
router.get('/bets', async (req, res) => {
  const { from, to, user_id } = req.query as { from?: string; to?: string; user_id?: string };

  let query = supabase
    .from('bets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (from) query = query.gte('created_at', new Date(from).toISOString());
  if (to) query = query.lte('created_at', new Date(to + 'T23:59:59.999Z').toISOString());
  if (user_id) query = query.eq('user_id', user_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── PROFITTI ──────────────────────────────────────────────────────────────────

// GET /superadmin/profits — profitti globali e per reseller
router.get('/profits', async (_req, res) => {
  try {
    const [betsRes, resellersRes] = await Promise.all([
      supabase.from('bets').select('stake, potential_win, result, user_id, created_at'),
      supabase.from('users').select('id, username, balance').eq('role', 'reseller'),
    ]);

    const bets = betsRes.data ?? [];
    const resellers = resellersRes.data ?? [];

    // Profitto globale (escludi cancelled)
    const settledBets = bets.filter(b => b.result !== 'cancelled');
    const totalStake = settledBets.reduce((s, b) => s + Number(b.stake), 0);
    const totalPaidOut = bets.filter(b => b.result === 'win').reduce((s, b) => s + Number(b.potential_win), 0);
    const globalProfit = totalStake - totalPaidOut;

    // Profitto oggi (escludi cancelled)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayBets = settledBets.filter(b => new Date(b.created_at ?? 0) >= today);
    const todayStake = todayBets.reduce((s, b) => s + Number(b.stake), 0);
    const todayPaidOut = bets.filter(b => b.result === 'win' && new Date(b.created_at ?? 0) >= today).reduce((s, b) => s + Number(b.potential_win), 0);
    const todayProfit = todayStake - todayPaidOut;

    res.json({
      globalProfit, totalStake, totalPaidOut,
      todayProfit, todayStake, todayPaidOut,
      resellers: resellers.map(r => ({ ...r, balance: Number(r.balance) })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

// ── DOCS ──────────────────────────────────────────────────────────────────────

const ALLOWED_DOCS = ['pannello-admin', 'pannello-reseller', 'pannello-superadmin'];

router.get('/docs/:file', (req, res) => {
  const { file } = req.params;
  if (!ALLOWED_DOCS.includes(file)) return res.status(404).json({ error: 'Documento non trovato' });

  const filePath = path.resolve(__dirname, '../../../docs', `${file}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File non trovato' });

  const content = fs.readFileSync(filePath, 'utf-8');
  res.json({ file, content });
});
