import { NextFunction, Request, Response } from 'express';
import { supabase } from '../db/supabase';

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

export function hasBearerToken(req: Request): boolean {
  const header = req.headers.authorization;
  return typeof header === 'string' && header.toLowerCase().startsWith('bearer ');
}

export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  if (req.authUserId) return req.authUserId;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  req.authUserId = data.user.id;
  return data.user.id;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Non autorizzato' });
    return;
  }
  next();
}
