import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { requireRoles } from '../middleware/roleAuth';
import { requireAuth } from '../middleware/auth';

const router = Router();
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

// GET /users/me/balance — get balance for authenticated user
router.get('/me/balance', requireAuth, async (req: Request, res: Response) => {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ error: 'Non autenticato.' });

  const { data, error } = await supabase
    .from('users')
    .select('balance, is_blocked, username')
    .eq('id', userId)
    .single();

  if (error || !data) {
    // User row may not exist yet — return default
    return res.json({ balance: 0, is_blocked: false });
  }

  return res.json({ balance: Number(data.balance), is_blocked: data.is_blocked, username: data.username });
});

// POST /users/me/credit — credit balance (admin only, or settle service)
router.post('/me/credit', requireAdminOrSuperadmin, async (req: Request, res: Response) => {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ error: 'Non autenticato.' });

  const { amount } = req.body as { amount: number };
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }

  const { data, error } = await supabase.rpc('credit_balance', { p_user_id: userId, p_amount: amount });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, new_balance: data });
});

// Admin: GET /users — list all users
router.get('/', requireAdminOrSuperadmin, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, balance, is_blocked, role, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// Admin: PATCH /users/:id/balance — set balance directly
router.patch('/:id/balance', requireAdminOrSuperadmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { balance } = req.body as { balance: number };
  if (typeof balance !== 'number' || balance < 0) {
    return res.status(400).json({ error: 'balance must be >= 0.' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ balance, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, username, balance')
    .single();

  if (error || !data) return res.status(404).json({ error: 'Utente non trovato.' });
  return res.json({ ok: true, ...data });
});

// Admin: PATCH /users/:id/block — block/unblock user
router.patch('/:id/block', requireAdminOrSuperadmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { blocked } = req.body as { blocked: boolean };

  const { data, error } = await supabase
    .from('users')
    .update({ is_blocked: blocked, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, username, is_blocked')
    .single();

  if (error || !data) return res.status(404).json({ error: 'Utente non trovato.' });
  return res.json({ ok: true, ...data });
});

// PATCH /users/:id/reseller — set reseller_id after registration via affiliate code
router.patch('/:id/reseller', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reseller_id } = req.body as { reseller_id: string };
  const requesterId = req.authUserId;
  if (!reseller_id) return res.status(400).json({ error: 'reseller_id obbligatorio' });
  if (!requesterId) return res.status(401).json({ error: 'Non autorizzato' });

  if (requesterId !== id) {
    const { data: requester, error: requesterErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', requesterId)
      .single();

    if (requesterErr || !requester) return res.status(401).json({ error: 'Non autorizzato' });
    if (requester.role !== 'admin' && requester.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ reseller_id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('role', 'user'); // only update regular users

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
