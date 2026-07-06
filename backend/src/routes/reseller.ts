import { Router, Request, Response } from 'express';
import { resellerAuth } from '../middleware/resellerAuth';
import {
  getResellerInfo,
  getResellerUsers,
  createResellerUser,
  transferBalance,
  setUserBlocked,
  getResellerBets,
  getResellerStats,
} from '../services/resellerService';

const router = Router();

// Apply resellerAuth to all routes
router.use(resellerAuth);

// GET /reseller/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const info = await getResellerInfo(req.resellerId!);
    res.json(info);
  } catch {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /reseller/users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await getResellerUsers(req.resellerId!);
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /reseller/users
router.post('/users', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }

  try {
    const user = await createResellerUser(req.resellerId!, username.trim(), password);
    return res.status(201).json(user);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error('[reseller/users POST] error:', e);
    if (e.code === 'DUPLICATE_USERNAME') {
      return res.status(409).json({ error: 'Username già in uso' });
    }
    return res.status(500).json({ error: e.message ?? 'Errore interno del server' });
  }
});

// PATCH /reseller/users/:id/balance
router.patch('/users/:id/balance', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body as { amount?: unknown };

  if (amount === undefined || amount === null || amount === '' || isNaN(Number(amount)) || Number(amount) === 0) {
    return res.status(400).json({ error: 'Importo non valido' });
  }

  try {
    const result = await transferBalance(req.resellerId!, id, Number(amount));
    return res.json(result);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: 'Accesso non autorizzato' });
    if (e.code === 'INSUFFICIENT_RESELLER_BALANCE') return res.status(402).json({ error: 'Saldo reseller insufficiente' });
    if (e.code === 'INSUFFICIENT_USER_BALANCE') return res.status(402).json({ error: 'Saldo utente insufficiente' });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PATCH /reseller/users/:id/block
router.patch('/users/:id/block', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { blocked } = req.body as { blocked?: unknown };

  if (typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'Il campo blocked deve essere un booleano' });
  }

  try {
    await setUserBlocked(req.resellerId!, id, blocked);
    return res.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: 'Accesso non autorizzato' });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /reseller/bets
router.get('/bets', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  try {
    const bets = await getResellerBets(req.resellerId!, status);
    res.json(bets);
  } catch {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /reseller/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getResellerStats(req.resellerId!);
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
