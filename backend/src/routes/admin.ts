import { Router } from 'express';
import { getAdminStats } from '../services/adminStatsService';
import { supabase, supabaseAdmin } from '../db/supabase';
import { requireRoles } from '../middleware/roleAuth';
import crypto from 'crypto';

function generateAffiliateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F2B1C9"
}

const router = Router();
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

router.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/affiliate/')) {
    return next();
  }
  return requireAdminOrSuperadmin(req, res, next);
});

router.get('/stats', async (_req, res) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /admin/resellers — create a new reseller account
router.post('/resellers', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim()) return res.status(400).json({ error: 'Username obbligatorio' });
  if (!password?.trim() || password.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });

  const cleanUsername = username.trim();

  // Check username uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', cleanUsername)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'Username già in uso' });

  const email = `${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@bb365.app`;

  // Create auth user with service role key
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { username: cleanUsername, role: 'reseller' },
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    console.error('[admin/resellers] auth.admin.createUser error:', authError);
    if (authError?.message?.includes('already registered')) {
      return res.status(409).json({ error: 'Username già in uso' });
    }
    return res.status(500).json({ error: authError?.message ?? 'Errore nella creazione account' });
  }

  const userId = authData.user.id;

  // Generate unique affiliate code
  let affiliateCode = generateAffiliateCode();
  // Ensure uniqueness (retry once if collision)
  const { data: codeCheck } = await supabase.from('users').select('id').eq('affiliate_code', affiliateCode).maybeSingle();
  if (codeCheck) affiliateCode = generateAffiliateCode();

  // Upsert users row — don't rely on trigger alone (use service role key)
  const { error: upsertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: userId,
      username: cleanUsername,
      role: 'reseller',
      balance: 0,
      is_blocked: false,
      affiliate_code: affiliateCode,
    }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[admin/resellers] upsert users error:', upsertError);
  }

  return res.status(201).json({
    id: userId,
    username: cleanUsername,
    balance: 0,
    role: 'reseller',
    affiliate_code: affiliateCode,
    created_at: authData.user.created_at,
  });
});

// GET /admin/affiliate/:code — resolve affiliate code to reseller id (public, used during registration)
router.get('/affiliate/:code', async (req, res) => {
  const { code } = req.params;
  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .eq('affiliate_code', code.toUpperCase())
    .eq('role', 'reseller')
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Codice affiliato non valido' });
  return res.json({ reseller_id: data.id, reseller_username: data.username });
});

export default router;
