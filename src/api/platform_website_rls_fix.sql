-- =====================================================================
-- RLS FIX: website enquiry / admissions forms cannot submit
-- Symptom: on bluebellschool-website, "Apply Online" fails with
--   "Could not submit the application right now. Please try again or
--    visit the school office." and the contact form's "Could not send
--    your message..." equivalent.
-- Root cause: jmis_enquiries and jmis_admissions_applications were created
--   by platform_website_enquiries_setup.sql WITHOUT RLS policies, but RLS is
--   now enabled on them with the platform default-deny. Verified live: an
--   anon-key INSERT returns 401 / SQLSTATE 42501
--   "new row violates row-level security policy" on BOTH tables.
--   The public site talks to PostgREST as the `anon` role (no login), so it
--   needs an anon INSERT policy. The signed-in admin dashboard talks as
--   `authenticated` and only reads/upserts these — it does NOT need to give
--   the public a way to read/modify/delete other people's enquiries.
-- Fix: least-privilege split — anon may only INSERT (submit), authenticated
--   may SELECT/INSERT/UPDATE/DELETE (admin follow-up). Public visitors can
--   submit but can no longer enumerate or edit the enquiries/application
--   table.
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- =====================================================================

ALTER TABLE jmis_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE jmis_admissions_applications ENABLE ROW LEVEL SECURITY;

-- ---------- jmis_enquiries ----------
-- Public website (contact form + the admissions flow's linked enquiry row):
-- INSERT only. The form never reads back, so no anon SELECT is granted.
DROP POLICY IF EXISTS "enquiries_anon_insert" ON jmis_enquiries;
CREATE POLICY "enquiries_anon_insert" ON jmis_enquiries FOR INSERT TO anon WITH CHECK (true);

-- Admin follow-up pipeline (Enquiries.jsx list/triage + Home.jsx widget counts):
-- full CRUD as an authenticated (signed-in) staff member. Manual entries are
-- also inserted here, hence INSERT is granted to authenticated as well.
DROP POLICY IF EXISTS "enquiries_authed_read"   ON jmis_enquiries;
DROP POLICY IF EXISTS "enquiries_authed_insert" ON jmis_enquiries;
DROP POLICY IF EXISTS "enquiries_authed_update" ON jmis_enquiries;
DROP POLICY IF EXISTS "enquiries_authed_delete" ON jmis_enquiries;
CREATE POLICY "enquiries_authed_read"   ON jmis_enquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "enquiries_authed_insert" ON jmis_enquiries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "enquiries_authed_update" ON jmis_enquiries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "enquiries_authed_delete" ON jmis_enquiries FOR DELETE TO authenticated USING (true);

-- ---------- jmis_admissions_applications ----------
-- Public "Apply Online" form: INSERT only.
DROP POLICY IF EXISTS "admissions_anon_insert" ON jmis_admissions_applications;
CREATE POLICY "admissions_anon_insert" ON jmis_admissions_applications FOR INSERT TO anon WITH CHECK (true);

-- Reserve read/triage for signed-in admins (there is no anon read/write). When
-- an admin admissions review UI is wired to this table it works as `authenticated`.
DROP POLICY IF EXISTS "admissions_authed_read"   ON jmis_admissions_applications;
DROP POLICY IF EXISTS "admissions_authed_insert" ON jmis_admissions_applications;
DROP POLICY IF EXISTS "admissions_authed_update" ON jmis_admissions_applications;
DROP POLICY IF EXISTS "admissions_authed_delete" ON jmis_admissions_applications;
CREATE POLICY "admissions_authed_read"   ON jmis_admissions_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissions_authed_insert" ON jmis_admissions_applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admissions_authed_update" ON jmis_admissions_applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admissions_authed_delete" ON jmis_admissions_applications FOR DELETE TO authenticated USING (true);

-- ---------- Verify (should list the 10 policies above) ----------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('jmis_enquiries', 'jmis_admissions_applications')
ORDER BY tablename, policyname;
