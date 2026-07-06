import { Request, Response, NextFunction } from 'express';

type PublicRouteRule = {
  methods: Array<'GET' | 'POST'>;
  pattern: RegExp;
};

// Routes that are publicly accessible without password
const PUBLIC_ROUTES: PublicRouteRule[] = [
  { methods: ['GET'], pattern: /^\/events$/ },
  { methods: ['GET'], pattern: /^\/events\/live$/ },
  { methods: ['GET'], pattern: /^\/events\/championships$/ },
  { methods: ['GET'], pattern: /^\/events\/league\/[^/]+$/ },
  { methods: ['GET'], pattern: /^\/events\/[^/]+$/ },
  { methods: ['GET'], pattern: /^\/odds\/[^/]+$/ },
  { methods: ['GET'], pattern: /^\/live\/scores$/ },
  { methods: ['GET'], pattern: /^\/live\/odds\/[^/]+$/ },
  { methods: ['GET'], pattern: /^\/api\/sport-betting\/events\/prematch\/[^/]+$/ },
  { methods: ['GET'], pattern: /^\/api\/sport-betting\/events\/live(?:\/[^/]+)?$/ },
  { methods: ['GET'], pattern: /^\/bets\/[^/]+$/ },
  { methods: ['POST'], pattern: /^\/bets\/[^/]+\/settle$/ },
];

export function passwordCheck(req: Request, res: Response, next: NextFunction): void {
  const method = req.method as 'GET' | 'POST';

  // Allow public routes through without auth
  const isPublicRoute = PUBLIC_ROUTES.some(
    (rule) => rule.methods.includes(method) && rule.pattern.test(req.path)
  );
  if (isPublicRoute) {
    return next();
  }

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    res.status(500).json({ error: 'Server misconfigured: SITE_PASSWORD not set' });
    return;
  }

  const provided = req.headers['x-site-password'];
  if (provided !== sitePassword) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
