-- BigBet365 PostgreSQL Schema — Final Version
-- Run this in your Supabase SQL editor to initialize the database.

-- ── Users table (balance + block status) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  balance NUMERIC(10,2) NOT NULL DEFAULT 100.00 CHECK (balance >= 0),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Auto-create user row on Supabase auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO users (id, username, balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    100.00
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Bets table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_schedina VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nome_proprietario TEXT NOT NULL,
  stake NUMERIC(10,2) NOT NULL CHECK (stake > 0),
  selections JSONB NOT NULL,
  total_odds NUMERIC(14,4) NOT NULL,
  potential_win NUMERIC(14,2) NOT NULL,
  result VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','win','lose','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

-- Migrations (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='paid_at') THEN
    ALTER TABLE bets ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='user_id') THEN
    ALTER TABLE bets ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Migrations (safe to run multiple times) — users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'reseller', 'admin', 'superadmin'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at);
CREATE INDEX IF NOT EXISTS idx_bets_codice_schedina ON bets(codice_schedina);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);

-- ── RPC: credit_balance — atomically add amount to user balance ───────────────
CREATE OR REPLACE FUNCTION credit_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE users
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = p_user_id
  RETURNING balance INTO new_balance;
  RETURN new_balance;
END;
$$;

CREATE TABLE IF NOT EXISTS events_cache (
  event_id VARCHAR(64) PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS odds_cache (
  event_id VARCHAR(64) PRIMARY KEY,
  odds_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reseller Panel ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_reseller_id ON users(reseller_id);

-- RPC atomica: trasferimento saldo bidirezionale reseller ↔ utente
CREATE OR REPLACE FUNCTION transfer_balance(
  p_reseller_id UUID,
  p_user_id UUID,
  p_amount NUMERIC  -- positivo = ricarica utente, negativo = prelievo da utente
)
RETURNS TABLE(reseller_balance NUMERIC, user_balance NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reseller_balance NUMERIC;
  v_user_balance NUMERIC;
BEGIN
  SELECT balance INTO v_reseller_balance FROM users WHERE id = p_reseller_id FOR UPDATE;
  SELECT balance INTO v_user_balance FROM users WHERE id = p_user_id FOR UPDATE;

  IF p_amount > 0 AND v_reseller_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_RESELLER_BALANCE';
  END IF;
  IF p_amount < 0 AND v_user_balance < ABS(p_amount) THEN
    RAISE EXCEPTION 'INSUFFICIENT_USER_BALANCE';
  END IF;

  UPDATE users SET balance = balance - p_amount, updated_at = NOW() WHERE id = p_reseller_id
    RETURNING balance INTO v_reseller_balance;
  UPDATE users SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_user_id
    RETURNING balance INTO v_user_balance;

  RETURN QUERY SELECT v_reseller_balance, v_user_balance;
END;
$$;
