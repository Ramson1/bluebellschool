-- =====================================================================
-- RLS FIX: bluebell_staff / bluebell_staff_assignments invisible in admin dashboard
-- Symptom: Staff Accounts page shows "No staff match the current filters"
-- even though bluebell_staff has rows. The dashboard queries these tables with
-- the browser (anon/authenticated) key; RLS is enabled but has no policies,
-- so PostgREST silently returns 0 rows (no error).
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- =====================================================================

ALTER TABLE bluebell_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluebell_staff_assignments ENABLE ROW LEVEL SECURITY;

-- ---------- bluebell_staff ----------
-- Reads: the admin dashboard (Staff Accounts, ID cards scope, lesson plans,
-- staff attendance picker, website...) all query with the anon key.
DROP POLICY IF EXISTS "staff_anon_read"     ON bluebell_staff;
DROP POLICY IF EXISTS "staff_authed_read"   ON bluebell_staff;
CREATE POLICY "staff_anon_read"   ON bluebell_staff FOR SELECT TO anon          USING (true);
CREATE POLICY "staff_authed_read" ON bluebell_staff FOR SELECT TO authenticated USING (true);

-- Writes: provisioning (create/update/reset/block) goes through the
-- service-role API routes which bypass RLS entirely, but the StaffAccounts
-- page inserts/deletes assignments directly — keep parity with the previous
-- pre-RLS behaviour so nothing else that writes staff breaks.
DROP POLICY IF EXISTS "staff_anon_write"     ON bluebell_staff;
DROP POLICY IF EXISTS "staff_authed_write"   ON bluebell_staff;
DROP POLICY IF EXISTS "staff_anon_update"    ON bluebell_staff;
DROP POLICY IF EXISTS "staff_authed_update"  ON bluebell_staff;
DROP POLICY IF EXISTS "staff_anon_delete"    ON bluebell_staff;
DROP POLICY IF EXISTS "staff_authed_delete"  ON bluebell_staff;
CREATE POLICY "staff_anon_write"   ON bluebell_staff FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "staff_authed_write" ON bluebell_staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff_anon_update"  ON bluebell_staff FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "staff_authed_update" ON bluebell_staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_anon_delete"  ON bluebell_staff FOR DELETE TO anon          USING (true);
CREATE POLICY "staff_authed_delete" ON bluebell_staff FOR DELETE TO authenticated USING (true);

-- ---------- bluebell_staff_assignments ----------
DROP POLICY IF EXISTS "staff_assignments_anon_read"     ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_authed_read"   ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_anon_write"    ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_authed_write"  ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_anon_update"   ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_authed_update" ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_anon_delete"   ON bluebell_staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_authed_delete" ON bluebell_staff_assignments;
CREATE POLICY "staff_assignments_anon_read"     ON bluebell_staff_assignments FOR SELECT TO anon          USING (true);
CREATE POLICY "staff_assignments_authed_read"   ON bluebell_staff_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_assignments_anon_write"    ON bluebell_staff_assignments FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "staff_assignments_authed_write"  ON bluebell_staff_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff_assignments_anon_update"   ON bluebell_staff_assignments FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "staff_assignments_authed_update" ON bluebell_staff_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_assignments_anon_delete"   ON bluebell_staff_assignments FOR DELETE TO anon          USING (true);
CREATE POLICY "staff_assignments_authed_delete" ON bluebell_staff_assignments FOR DELETE TO authenticated USING (true);

-- ---------- Verify (should list the 14 policies above) ----------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bluebell_staff', 'bluebell_staff_assignments')
ORDER BY tablename, policyname;
