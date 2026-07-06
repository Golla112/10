import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';
import { getAuthenticatedUserId } from './auth';

export function requireRoles(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      res.status(401).json({ error: 'Non autorizzato' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      res.status(401).json({ error: 'Non autorizzato' });
      return;
    }

    if (!allowedRoles.includes(data.role)) {
      res.status(403).json({ error: 'Accesso non autorizzato' });
      return;
    }

    next();
  };
}
