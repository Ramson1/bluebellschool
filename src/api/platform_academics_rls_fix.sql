-- =============================================================================
-- Bluebell academics RLS fix — make item creation work in the staff portal
-- -----------------------------------------------------------------------------
-- SYMPTOM: on every academic page of the staff portal (E-Notes, Assignments,
-- Lesson Plans, Announcements, and the CBT completion/essay builders) the file
-- uploads fine, then saving the record fails with
--   "new row violates row-level security policy for table \"jmis_notes\""
-- and the list stays permanently empty.
--
-- ROOT CAUSE: platform_staff_portal_setup.sql creates seven tables
-- (jmis_assignments, jmis_notes, jmis_lesson_plans, jmis_scheme_of_work,
-- jmis_announcements, jmis_class_participation, jmis_student_reviews) and
-- feature_expansion_setup.sql creates jmis_auditlogs, WITHOUT any policy, while
-- cbt_completion_essay_schema.sql leaves jmis_cbt_completion / jmis_cbt_essay
-- the same way. RLS is enabled on all of them with the default-deny posture, so
-- every INSERT/UPDATE/DELETE is rejected and every SELECT silently returns zero
-- rows. These tables were never written to at all — a service-role count returns
-- 0 for each of them, which is why nothing is lost by opening them up.
--
-- LIVE PROBE (project BLUEBELL_SUPABASE_REF_PLACEHOLDER, anon + a real authenticated JWT):
--   blocked here   SELECT => 200 / 0 rows   INSERT => 403 SQLSTATE 42501
--   already open   jmis_cbtQuestions, jmis_attendance, jmis_staff_attendance,
--                  jmis_result, jmis_assignment_submissions, jmis_chat_*,
--                  jmis_staff, jmis_student        (INSERT => 201 in the probe)
--   storage: an authenticated upload to the 'cbt' bucket succeeds at the root
--            and under academics/<table>/, and to 'passport' under chat/ — so
--            the upload half of every page already works and needs no change.
--
-- POLICY SHAPE (matches jmis_chat_rls_fix.sql / platform_attendance_rls_fix.sql):
--   * SELECT is opened to BOTH roles, because the student portal and the public
--     website authenticate with a localStorage/token session and not Supabase
--     Auth — they present only the anon key (see src/utils/studentScope.js).
--     Learners must be able to read their notes, assignments and announcements.
--   * Writes for the academic content tables go to `authenticated` only: those
--     are created by staff (Staff Portal) and admins (dashboard), both of which
--     hold a real session. anon can read but not forge.
--   * jmis_auditlogs accepts INSERT from both roles, because src/api/auditLog.js
--     is fire-and-forget and the learner portal logs profile actions as anon.
--     Reading the log (Audit Logs page) stays authenticated-only.
--   * jmis_cbt_completion / jmis_cbt_essay: sets are readable by learners (they
--     sit exams as anon, exactly like jmis_cbtQuestions) but writable only by
--     staff/admin.
--
-- ONLY THE TABLES THAT ARE ACTUALLY USED ARE TOUCHED. platform_staff_portal_setup.sql
-- also creates jmis_scheme_of_work, jmis_class_participation and
-- jmis_student_reviews, and they are in the same closed state, but no page in any
-- portal reads or writes them (grep across all five apps finds zero references).
-- They are deliberately left alone here — open them when a page needs them, rather
-- than widening access for nothing.
--
-- This does NOT change what the app enforces: the portal's own scope guard
-- (src/utils/scope.js) and record ownership (src/utils/ownership.js) still decide
-- which class/subject a teacher may write and whose rows they may edit.
--
-- Safe to re-run (every policy is dropped first). Run ONCE in the Supabase SQL
-- Editor. NOTE: run jmis_cbt_created_by.sql too if you have not — the three CBT
-- tables still lack the created_by column, so CBT sets stay unattributed and
-- fall back to class+subject filtering.
--
-- ROLLBACK (returns to today's broken-but-closed state):
--   see the DROP POLICY list at the bottom of this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Academic content: read for everyone, write for signed-in staff/admin
-- ---------------------------------------------------------------------------
-- jmis_notes         -> E-Notes page        (author column: uploaded_by)
-- jmis_assignments   -> Assignments page    (author column: created_by)
-- jmis_lesson_plans  -> Lesson Plans page   (author column: submitted_by)
-- jmis_announcements -> Announcements page  (author column: created_by)

ALTER TABLE public.jmis_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jmis_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jmis_lesson_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jmis_announcements   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_read"            ON public.jmis_notes;
DROP POLICY IF EXISTS "notes_write"           ON public.jmis_notes;
DROP POLICY IF EXISTS "assignments_read"      ON public.jmis_assignments;
DROP POLICY IF EXISTS "assignments_write"     ON public.jmis_assignments;
DROP POLICY IF EXISTS "lesson_plans_read"     ON public.jmis_lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_write"    ON public.jmis_lesson_plans;
DROP POLICY IF EXISTS "announcements_read"    ON public.jmis_announcements;
DROP POLICY IF EXISTS "announcements_write"   ON public.jmis_announcements;

-- SELECT for anon + authenticated (learners read with the anon key)
CREATE POLICY "notes_read"         ON public.jmis_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "assignments_read"   ON public.jmis_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lesson_plans_read"  ON public.jmis_lesson_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "announcements_read" ON public.jmis_announcements FOR SELECT TO anon, authenticated USING (true);

-- INSERT / UPDATE / DELETE for authenticated only (staff portal + dashboard)
CREATE POLICY "notes_write"        ON public.jmis_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assignments_write"  ON public.jmis_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lesson_plans_write" ON public.jmis_lesson_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "announcements_write" ON public.jmis_announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) CBT completion / essay sets — same posture as jmis_cbtQuestions
-- ---------------------------------------------------------------------------
ALTER TABLE public.jmis_cbt_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jmis_cbt_essay      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbt_completion_read"  ON public.jmis_cbt_completion;
DROP POLICY IF EXISTS "cbt_completion_write" ON public.jmis_cbt_completion;
DROP POLICY IF EXISTS "cbt_essay_read"       ON public.jmis_cbt_essay;
DROP POLICY IF EXISTS "cbt_essay_write"      ON public.jmis_cbt_essay;

CREATE POLICY "cbt_completion_read"  ON public.jmis_cbt_completion FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cbt_essay_read"       ON public.jmis_cbt_essay FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cbt_completion_write" ON public.jmis_cbt_completion FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cbt_essay_write"      ON public.jmis_cbt_essay FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) jmis_auditlogs — every portal writes here, only staff/admin read it
-- ---------------------------------------------------------------------------
ALTER TABLE public.jmis_auditlogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditlogs_read"  ON public.jmis_auditlogs;
DROP POLICY IF EXISTS "auditlogs_write" ON public.jmis_auditlogs;

CREATE POLICY "auditlogs_read"  ON public.jmis_auditlogs FOR SELECT TO authenticated USING (true);
-- anon INSERT is required: the learner portal has no Supabase session, and
-- logAction() is fire-and-forget, so a rejected audit row must never be
-- mistaken for a failed user action.
CREATE POLICY "auditlogs_write" ON public.jmis_auditlogs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Verify — expect 14 policies across the 7 tables (4+4 academic, 2+2 CBT, 2 audit).
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('jmis_notes', 'jmis_assignments', 'jmis_lesson_plans',
    'jmis_announcements', 'jmis_cbt_completion', 'jmis_cbt_essay', 'jmis_auditlogs')
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- ROLLBACK — paste this block only to undo everything above.
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "notes_read"            ON public.jmis_notes;
-- DROP POLICY IF EXISTS "notes_write"           ON public.jmis_notes;
-- DROP POLICY IF EXISTS "assignments_read"      ON public.jmis_assignments;
-- DROP POLICY IF EXISTS "assignments_write"     ON public.jmis_assignments;
-- DROP POLICY IF EXISTS "lesson_plans_read"     ON public.jmis_lesson_plans;
-- DROP POLICY IF EXISTS "lesson_plans_write"    ON public.jmis_lesson_plans;
-- DROP POLICY IF EXISTS "announcements_read"    ON public.jmis_announcements;
-- DROP POLICY IF EXISTS "announcements_write"   ON public.jmis_announcements;
-- DROP POLICY IF EXISTS "cbt_completion_read"   ON public.jmis_cbt_completion;
-- DROP POLICY IF EXISTS "cbt_completion_write"  ON public.jmis_cbt_completion;
-- DROP POLICY IF EXISTS "cbt_essay_read"        ON public.jmis_cbt_essay;
-- DROP POLICY IF EXISTS "cbt_essay_write"       ON public.jmis_cbt_essay;
-- DROP POLICY IF EXISTS "auditlogs_read"        ON public.jmis_auditlogs;
-- DROP POLICY IF EXISTS "auditlogs_write"       ON public.jmis_auditlogs;
