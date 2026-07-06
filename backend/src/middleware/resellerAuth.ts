import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';
import { getAuthenticatedUserId } from './auth';

// Extend Express Request to include resellerId
declare global {
  namespace Express {
    interface Request {
      resellerId?: string;
    }
  }
}

export async function resellerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    res.status(401).json({ error: 'Autenticazione richiesta' });
    return;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !user) {
    res.status(401).json({ error: 'Autenticazione richiesta' });
    return;
  }

  if (user.role !== 'reseller') {
    res.status(403).json({ error: 'Accesso non autorizzato' });
    return;
  }

  req.resellerId = user.id;
  next();
}
