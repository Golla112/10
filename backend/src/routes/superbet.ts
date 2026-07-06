import { Router } from 'express';
import { fetchSuperbetPrematch } from '../services/superbetService';
import { fetchSibet90Live, fetchSibet90LiveRaw } from '../services/sibet90LiveService';
import { superbetAjax, invalidateSuperbetSession } from '../services/superbetClient';

const router = Router();

router.get('/live', async (_req, res) => {
  try {
    const events = await fetchSibet90Live();
    res.setHeader('Cache-Control', 'no-store');
    return res.json(events);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/live/raw', async (_req, res) => {
  try {
    const data = await fetchSibet90LiveRaw();
    res.setHeader('Cache-Control', 'no-store');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/prematch', async (_req, res) => {
  try {
    const events = await fetchSuperbetPrematch();
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json(events);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.post('/ajax', async (req, res) => {
  try {
    const params = (req.body ?? {}) as Record<string, string>;
    const data = await superbetAjax(params);
    if (!data) return res.status(502).json({ error: 'superbet ajax failed' });
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.post('/session/refresh', (_req, res) => {
  invalidateSuperbetSession();
  return res.json({ ok: true });
});

export default router;
