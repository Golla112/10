import { supabase } from './supabase';

const USER_KEY = 'bb365_user';
const PASSWORD_KEY = 'bb365_auth_password';

export interface UserSession {
  username: string;
  isAdmin: boolean;
  role: 'user' | 'reseller' | 'admin' | 'superadmin';
  email?: string;
  supabaseId?: string;
}

// Admin accounts — hardcoded, cannot be created via registration
const ADMIN_EMAILS = ['mirkoct@bigbet365.com'];
const ADMIN_USERNAMES = ['mirkoct'];

function isAdminUser(email?: string, username?: string): boolean {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  if (username && ADMIN_USERNAMES.includes(username.toLowerCase())) return true;
  return false;
}

// ── Supabase Auth ──────────────────────────────────────────────

export async function registerUser(
  username: string,
  password: string,
  email?: string,
  affiliateCode?: string
): Promise<{ ok: boolean; error?: string }> {
  // Block admin username registration
  if (ADMIN_USERNAMES.includes(username.toLowerCase())) {
    return { ok: false, error: 'Username non disponibile.' };
  }

  const emailToUse = email ?? `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@bb365.app`;

  // Resolve affiliate code to reseller_id if provided
  let resellerId: string | undefined;
  if (affiliateCode?.trim()) {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
      const r = await fetch(`${API_BASE}/admin/affiliate/${affiliateCode.trim().toUpperCase()}`, {
        headers: { 'x-site-password': process.env.NEXT_PUBLIC_SITE_PASSWORD ?? '' },
      });
      if (r.ok) {
        const data = await r.json() as { reseller_id: string };
        resellerId = data.reseller_id;
      } else {
        return { ok: false, error: 'Codice affiliato non valido.' };
      }
    } catch {
      return { ok: false, error: 'Errore verifica codice affiliato.' };
    }
  }

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: emailToUse,
    password,
    options: {
      data: { username, reseller_id: resellerId ?? null },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { ok: false, error: 'Email già registrata.' };
    }
    return { ok: false, error: error.message };
  }

  // If affiliate code provided, update reseller_id in users table after signup
  if (resellerId && signUpData.user) {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
      const accessToken = signUpData.session?.access_token ?? null;
      await fetch(`${API_BASE}/users/${signUpData.user.id}/reseller`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-site-password': process.env.NEXT_PUBLIC_SITE_PASSWORD ?? '',
          'x-user-id': signUpData.user.id,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ reseller_id: resellerId }),
      });
    } catch {
      // non-fatal
    }
  }

  return { ok: true };
}

export async function loginUser(
  usernameOrEmail: string,
  password: string
): Promise<{ ok: boolean; user?: UserSession; error?: string }> {
  // Determine if input is email or username
  const isEmail = usernameOrEmail.includes('@');
  const emailToUse = isEmail
    ? usernameOrEmail
    : `${usernameOrEmail.toLowerCase().replace(/[^a-z0-9]/g, '')}@bb365.app`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (error || !data.user) {
    return { ok: false, error: 'Username o password errati.' };
  }

  const username = (data.user.user_metadata?.username as string) ?? usernameOrEmail;
  const admin = isAdminUser(data.user.email, username);

  // Read role from users table
  let role: 'user' | 'reseller' | 'admin' | 'superadmin' = admin ? 'admin' : 'user';
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    if (userData?.role) role = userData.role as 'user' | 'reseller' | 'admin' | 'superadmin';
  } catch {
    // fallback to default role
  }

  const session: UserSession = {
    username,
    isAdmin: role === 'admin',
    role,
    email: data.user.email,
    supabaseId: data.user.id,
  };
  storeUser(session);
  return { ok: true, user: session };
}

export async function logoutUser(): Promise<void> {
  await supabase.auth.signOut();
  clearSession();
}

export async function getCurrentSupabaseUser(): Promise<UserSession | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const username = (data.user.user_metadata?.username as string) ?? data.user.email ?? '';
  const admin = isAdminUser(data.user.email, username);

  let role: 'user' | 'reseller' | 'admin' | 'superadmin' = admin ? 'admin' : 'user';
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    if (userData?.role) role = userData.role as 'user' | 'reseller' | 'admin' | 'superadmin';
  } catch {
    // fallback
  }

  return { username, isAdmin: role === 'admin', role, email: data.user.email, supabaseId: data.user.id };
}

// ── Local session helpers (kept for compatibility) ─────────────

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(USER_KEY);
}

export function setAuthenticated(): void {
  // no-op — Supabase manages auth state
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PASSWORD_KEY);
}

export function getStoredPassword(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_SITE_PASSWORD ?? '';
  return localStorage.getItem(PASSWORD_KEY) ?? process.env.NEXT_PUBLIC_SITE_PASSWORD ?? '';
}

export function storePassword(password: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PASSWORD_KEY, password);
}

export function storeUser(user: UserSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as UserSession; } catch { return null; }
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
