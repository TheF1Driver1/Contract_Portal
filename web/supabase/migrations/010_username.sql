-- =============================================
-- Migration 010: Username (required, unique)
-- =============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Enforce uniqueness (case-insensitive via lowercased index)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON profiles (lower(username))
  WHERE username IS NOT NULL;

-- Safe search by username OR email (replaces search_profiles_by_email)
CREATE OR REPLACE FUNCTION search_profiles(query text)
RETURNS TABLE(id uuid, full_name text, username text, email text) AS $$
  SELECT p.id, p.full_name, p.username, p.email
  FROM profiles p
  WHERE p.id != auth.uid()
    AND (
      p.username ILIKE '%' || query || '%'
      OR p.email  ILIKE '%' || query || '%'
    )
  ORDER BY p.username NULLS LAST, p.full_name
  LIMIT 10;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RPC for uniqueness check during signup/settings
CREATE OR REPLACE FUNCTION is_username_taken(uname text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(username) = lower(uname)
      AND id != auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update trigger to capture username from signup metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username'
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        username  = COALESCE(EXCLUDED.username,  profiles.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
