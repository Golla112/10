-- STEP 1: Drop and recreate the trigger function with full error suppression
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
  v_role TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

  IF v_role NOT IN ('user', 'reseller', 'admin') THEN
    v_role := 'user';
  END IF;

  INSERT INTO users (id, username, balance, role)
  VALUES (
    NEW.id,
    v_username,
    CASE WHEN v_role = 'user' THEN 100.00 ELSE 0.00 END,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
