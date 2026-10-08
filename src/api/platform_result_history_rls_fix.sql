-- =====================================================================
-- RLS FIX: bluebell_result_history (archived student results) unreadable/unwritable
-- Symptom: The Result Archive page shows nothing, and archiving results on
-- student-delete / new-session rollover fails with:
--   42501 "new row violates row-level security policy for table bluebell_result_history"
-- RLS is enabled on this table but has NO policies, so the browser
-- (anon/authenticated) client can neither read nor write it.
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive/idempotent — safe to run more than once.
-- =====================================================================

ALTER TABLE bluebell_result_history ENABLE ROW LEVEL SECURITY;

-- Reads: the admin Result Archive page and the Result page's "archived result"
-- fallback both query this table with the anon/authenticated key.
DROP POLICY IF EXISTS "result_history_anon_read"   ON bluebell_result_history;
DROP POLICY IF EXISTS "result_history_authed_read" ON bluebell_result_history;
CREATE POLICY "result_history_anon_read"   ON bluebell_result_history FOR SELECT TO anon          USING (true);
CREATE POLICY "result_history_authed_read" ON bluebell_result_history FOR SELECT TO authenticated USING (true);

-- Writes: results are copied here by the admin dashboard (new-session rollover
-- in Settings, and the archive-on-delete step in Full Student Record).
DROP POLICY IF EXISTS "result_history_anon_write"   ON bluebell_result_history;
DROP POLICY IF EXISTS "result_history_authed_write" ON bluebell_result_history;
CREATE POLICY "result_history_anon_write"   ON bluebell_result_history FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "result_history_authed_write" ON bluebell_result_history FOR INSERT TO authenticated WITH CHECK (true);

-- Update/Delete: kept permissive for parity with the other jmis tables so the
-- archive can be managed from the dashboard if ever needed.
DROP POLICY IF EXISTS "result_history_anon_update"   ON bluebell_result_history;
DROP POLICY IF EXISTS "result_history_authed_update" ON bluebell_result_history;
DROP POLICY IF EXISTS "result_history_anon_delete"   ON bluebell_result_history;
DROP POLICY IF EXISTS "result_history_authed_delete" ON bluebell_result_history;
CREATE POLICY "result_history_anon_update"   ON bluebell_result_history FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "result_history_authed_update" ON bluebell_result_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "result_history_anon_delete"   ON bluebell_result_history FOR DELETE TO anon          USING (true);
CREATE POLICY "result_history_authed_delete" ON bluebell_result_history FOR DELETE TO authenticated USING (true);

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'bluebell_result_history'
ORDER BY cmd;
