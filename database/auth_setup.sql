-- Trigger to handle new User signup and populate public.users
-- Uses COALESCE to fall back to email username if name is not in metadata
-- Uses EXCEPTION block so trigger never blocks user creation even if something goes wrong
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, is_active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    CAST(COALESCE(new.raw_user_meta_data->>'role', 'DESIGNER') AS user_role),
    TRUE
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    RETURN new; -- Never block user creation even if public.users insert fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- INSTRUCTIONS TO CREATE FIRST ADMIN
-- ============================================================
-- 1. Go to Authentication -> Users -> Add User -> Create new user
--    Set email and password, check "Auto Confirm User?"
--
-- 2. Run the following SQL in the SQL Editor to confirm email and promote to ADMIN:
--
-- UPDATE auth.users
-- SET
--   email_confirmed_at = NOW(),
--   raw_user_meta_data = '{"name": "Vedara Admin", "role": "ADMIN"}'::jsonb
-- WHERE email = 'your-admin@email.com';
--
-- INSERT INTO public.users (id, name, email, role, is_active)
-- SELECT id, 'Vedara Admin', email, 'ADMIN'::user_role, TRUE
-- FROM auth.users WHERE email = 'your-admin@email.com'
-- ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', name = 'Vedara Admin';
