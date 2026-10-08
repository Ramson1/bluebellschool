-- =============================================================================
-- BluebellSchool · Attendance row-level-security fix (mobile gate app)
-- -----------------------------------------------------------------------------
-- Symptom: the Expo attendance app signs the operator in with Supabase Auth
-- (role = "authenticated") and inserting a scan fails with:
--     new row violates row-level security policy for table "jmis_attendance"
--
-- Cause: RLS is enabled on the attendance tables, but the only role that has
-- ever been able to write is the ANON key (the web /attendance dashboard does
-- NOT hold a Supabase Auth session, so its inserts run as "anon"). There is no
-- matching policy for "authenticated", so the mobile app is blocked.
--
-- Fix: grant SELECT / INSERT / UPDATE to BOTH "anon" and "authenticated" on
-- jmis_attendance and jmis_staff_attendance. This is consistent with the rest
-- of the platform's trust model (the anon key already reads/writes most jmis_*
-- tables; the gate app still enforces WHO may operate via resolveOperator()).
--
-- Idempotent: safe to re-run. Run ONCE in the Supabase SQL Editor.
-- =============================================================================

ALTER TABLE jmis_attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jmis_staff_attendance  ENABLE ROW LEVEL SECURITY;

-- ---------- jmis_attendance ----------
DROP POLICY IF EXISTS "attendance_anon_read"     ON jmis_attendance;
DROP POLICY IF EXISTS "attendance_anon_write"    ON jmis_attendance;
DROP POLICY IF EXISTS "attendance_authed_read"   ON jmis_attendance;
DROP POLICY IF EXISTS "attendance_authed_write"  ON jmis_attendance;

CREATE POLICY "attendance_anon_read"    ON jmis_attendance FOR SELECT TO anon           USING (true);
CREATE POLICY "attendance_anon_write"   ON jmis_attendance FOR INSERT TO anon           WITH CHECK (true);
CREATE POLICY "attendance_authed_read"  ON jmis_attendance FOR SELECT TO authenticated  USING (true);
CREATE POLICY "attendance_authed_write" ON jmis_attendance FOR INSERT TO authenticated  WITH CHECK (true);

-- Sign-in/out toggle updates existing rows (check_out_time / re-check-in).
DROP POLICY IF EXISTS "attendance_anon_update"    ON jmis_attendance;
DROP POLICY IF EXISTS "attendance_authed_update"  ON jmis_attendance;
CREATE POLICY "attendance_anon_update"   ON jmis_attendance FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "attendance_authed_update" ON jmis_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------- jmis_staff_attendance ----------
DROP POLICY IF EXISTS "staff_attendance_anon_read"    ON jmis_staff_attendance;
DROP POLICY IF EXISTS "staff_attendance_anon_write"   ON jmis_staff_attendance;
DROP POLICY IF EXISTS "staff_attendance_authed_read"  ON jmis_staff_attendance;
DROP POLICY IF EXISTS "staff_attendance_authed_write" ON jmis_staff_attendance;

CREATE POLICY "staff_attendance_anon_read"    ON jmis_staff_attendance FOR SELECT TO anon          USING (true);
CREATE POLICY "staff_attendance_anon_write"   ON jmis_staff_attendance FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "staff_attendance_authed_read"  ON jmis_staff_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_attendance_authed_write" ON jmis_staff_attendance FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_attendance_anon_update"    ON jmis_staff_attendance;
DROP POLICY IF EXISTS "staff_attendance_authed_update"  ON jmis_staff_attendance;
CREATE POLICY "staff_attendance_anon_update"   ON jmis_staff_attendance FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "staff_attendance_authed_update" ON jmis_staff_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
