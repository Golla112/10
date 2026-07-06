import { Router, Request, Response } from 'express';
import {
  xcodetecFetchRaw,
  xcodetecCacheControl,
} from '../services/xcodetecClient';
import {
  getLiveSnapshot,
  getSportConfig,
  getLiveEventMarkets,
  getNavbar,
  getLiveCalendar,
} from '../services/xcodetecProxyService';
import { mapXcEventToBookmakers, mergeXcBookmakers } from '../services/xcodetecService';

const router = Router();

const EVENT_MARKET_GROUPS = [4, 487, 488, 449, 454, 483, 448];

/** Proxy trasparente verso api.xcodetec.com (GET only) */
router.use('/proxy', async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET' });
  }

  const apiPath = req.path || '/';
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  try {
    const upstream = await xcodetecFetchRaw(`${apiPath}${query}`);
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    res.setHeader('Cache-Control', xcodetecCacheControl(apiPath));
    return res.send(body);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/live/snapshot', async (_req, res) => {
  try {
    const data = await getLiveSnapshot();
    if (!data) return res.status(503).json({ error: 'snapshot non disponibile' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/live/calendar', async (_req, res) => {
  try {
    const data = await getLiveCalendar();
    if (!data) return res.status(503).json({ error: 'calendario non disponibile' });
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/live/event/:id', async (req, res) => {
  try {
    const data = await getLiveEventMarkets(req.params.id);
    if (!data) return res.status(404).json({ error: 'evento non trovato' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/sport/config', async (_req, res) => {
  try {
    const data = await getSportConfig();
    if (!data) return res.status(503).json({ error: 'config non disponibile' });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/sport/navbar', async (_req, res) => {
  try {
    const data = await getNavbar();
    if (!data) return res.status(503).json({ error: 'navbar non disponibile' });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/tournament/:id/:market', async (req, res) => {
  try {
    const upstream = await xcodetecFetchRaw(
      `/sport/tournament/${req.params.id}/${req.params.market}`
    );
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `xcodetec ${upstream.status}` });
    }
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

router.get('/event/:id', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      EVENT_MARKET_GROUPS.map(async (mg) => {
        const r = await xcodetecFetchRaw(`/sport/event/${req.params.id}/${mg}`);
        return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
      })
    );

    let mergedBookmakers: ReturnType<typeof mapXcEventToBookmakers> = [];
    let baseRaw: Record<string, unknown> = {};

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const raw = result.value;
      if (!baseRaw.id) baseRaw = raw;
      const bks = mapXcEventToBookmakers(raw);
      mergedBookmakers = mergeXcBookmakers(mergedBookmakers, bks);
    }

    if (mergedBookmakers.length === 0) {
      const r = await xcodetecFetchRaw(`/sport/event/${req.params.id}`);
      if (r.ok) {
        baseRaw = (await r.json()) as Record<string, unknown>;
        mergedBookmakers = mapXcEventToBookmakers(baseRaw);
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.json({ ...baseRaw, bookmakers: mergedBookmakers });
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

export default router;
