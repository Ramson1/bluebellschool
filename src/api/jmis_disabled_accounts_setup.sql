-- =====================================================================
-- ACCESS CONTROL: disabled accounts registry
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
--
-- Purpose: the ultimate super_admin (blackboxinfo01@gmail.com) can suspend
-- any OTHER admin or super_admin account. Disabling is reversible: the
-- account's login (Supabase auth user) and data are left intact; we only
-- (a) remove the email from its role table so all presence checks fail and
-- (b) record a snapshot here so re-enable can restore the exact role.
--
-- Follows the proven DROP-if-exists + CREATE convention (lowercase names).
-- =====================================================================

DROP TABLE IF EXISTS jmis_disabled_accounts CASCADE;
CREATE TABLE jmis_disabled_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',        -- 'admin' | 'super_admin' (which table to restore into)
  name TEXT,                                -- display name snapshot (optional)
  reason TEXT,                              -- why the account was suspended (optional)
  disabled_by TEXT,                         -- owner email that performed the action
  disabled_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jmis_disabled_email ON jmis_disabled_accounts(lower(email));

-- ---------------------------------------------------------------------
-- RLS: default-deny writes; SELECT is readable by anon/authenticated so the
-- browser login gate (src/utils/authTools fetchAuthRoles + Login.jsx) can
-- honour the disabled set. All writes go through the service-role API route
-- (app/api/access-control/route.ts) which bypasses RLS entirely.
-- ---------------------------------------------------------------------
ALTER TABLE jmis_disabled_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jmis_disabled_accounts_select" ON jmis_disabled_accounts;
CREATE POLICY "jmis_disabled_accounts_select"
  ON jmis_disabled_accounts FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated on purpose: those
-- operations are rejected by RLS and must use the service-role key server-side.

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jmis_disabled_accounts'
ORDER BY column_name;
