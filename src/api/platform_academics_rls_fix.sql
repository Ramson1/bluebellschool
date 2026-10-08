-- =============================================================================
-- Bluebell academics RLS fix — make item creation work in the staff portal
-- -----------------------------------------------------------------------------
-- SYMPTOM: on every academic page of the staff portal (E-Notes, Assignments,
-- Lesson Plans, Announcements, and the CBT completion/essay builders) the file
-- uploads fine, then saving the record fails with
--   "new row violates row-level security policy for table \"bluebell_notes\""
-- and the list stays permanently empty.
--
-- ROOT CAUSE: platform_staff_portal_setup.sql creates seven tables
-- (bluebell_assignments, bluebell_notes, bluebell_lesson_plans, bluebell_scheme_of_work,
-- bluebell_announcements, bluebell_class_participation, bluebell_student_reviews) and
-- feature_expansion_setup.sql creates bluebell_auditlogs, WITHOUT any policy, while
-- cbt_completion_essay_schema.sql leaves bluebell_cbt_completion / bluebell_cbt_essay
-- the same way. RLS is enabled on all of them with the default-deny posture, so
-- every INSERT/UPDATE/DELETE is rejected and every SELECT silently returns zero
-- rows. These tables were never written to at all — a service-role count returns
-- 0 for each of them, which is why nothing is lost by opening them up.
--
-- LIVE PROBE (project BLUEBELL_SUPABASE_REF_PLACEHOLDER, anon + a real authenticated JWT):
--   blocked here   SELECT => 200 / 0 rows   INSERT => 403 SQLSTATE 42501
--   already open   bluebell_cbtQuestions, bluebell_attendance, bluebell_staff_attendance,
--                  bluebell_result, bluebell_assignment_submissions, bluebell_chat_*,
--                  bluebell_staff, bluebell_student        (INSERT => 201 in the probe)
--   storage: an authenticated upload to the 'cbt' bucket succeeds at the root
--            and under academics/<table>/, and to 'passport' under chat/ — so
--            the upload half of every page already works and needs no change.
--
-- POLICY SHAPE (matches bluebell_chat_rls_fix.sql / platform_attendance_rls_fix.sql):
--   * SELECT is opened to BOTH roles, because the student portal and the public
--     website authenticate with a localStorage/token session and not Supabase
--     Auth — they present only the anon key (see src/utils/studentScope.js).
--     Learners must be able to read their notes, assignments and announcements.
--   * Writes for the academic content tables go to `authenticated` only: those
--     are created by staff (Staff Portal) and admins (dashboard), both of which
--     hold a real session. anon can read but not forge.
--   * bluebell_auditlogs accepts INSERT from both roles, because src/api/auditLog.js
--     is fire-and-forget and the learner portal logs profile actions as anon.
--     Reading the log (Audit Logs page) stays authenticated-only.
--   * bluebell_cbt_completion / bluebell_cbt_essay: sets are readable by learners (they
--     sit exams as anon, exactly like bluebell_cbtQuestions) but writable only by
--     staff/admin.
--
-- ONLY THE TABLES THAT ARE ACTUALLY USED ARE TOUCHED. platform_staff_portal_setup.sql
-- also creates bluebell_scheme_of_work, bluebell_class_participation and
-- bluebell_student_reviews, and they are in the same closed state, but no page in any
-- portal reads or writes them (grep across all five apps finds zero references).
-- They are deliberately left alone here — open them when a page needs them, rather
-- than widening access for nothing.
--
-- This does NOT change what the app enforces: the portal's own scope guard
-- (src/utils/scope.js) and record ownership (src/utils/ownership.js) still decide
-- which class/subject a teacher may write and whose rows they may edit.
--
-- Safe to re-run (every policy is dropped first). Run ONCE in the Supabase SQL
-- Editor. NOTE: run bluebell_cbt_created_by.sql too if you have not — the three CBT
-- tables still lack the created_by column, so CBT sets stay unattributed and
-- fall back to class+subject filtering.
--
-- ROLLBACK (returns to today's broken-but-closed state):
--   see the DROP POLICY list at the bottom of this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Academic content: read for everyone, write for signed-in staff/admin
-- ---------------------------------------------------------------------------
-- bluebell_notes         -> E-Notes page        (author column: uploaded_by)
-- bluebell_assignments   -> Assignments page    (author column: created_by)
-- bluebell_lesson_plans  -> Lesson Plans page   (author column: submitted_by)
-- bluebell_announcements -> Announcements page  (author column: created_by)

ALTER TABLE public.bluebell_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluebell_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluebell_lesson_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluebell_announcements   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_read"            ON public.bluebell_notes;
DROP POLICY IF EXISTS "notes_write"           ON public.bluebell_notes;
DROP POLICY IF EXISTS "assignments_read"      ON public.bluebell_assignments;
DROP POLICY IF EXISTS "assignments_write"     ON public.bluebell_assignments;
DROP POLICY IF EXISTS "lesson_plans_read"     ON public.bluebell_lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_write"    ON public.bluebell_lesson_plans;
DROP POLICY IF EXISTS "announcements_read"    ON public.bluebell_announcements;
DROP POLICY IF EXISTS "announcements_write"   ON public.bluebell_announcements;

-- SELECT for anon + authenticated (learners read with the anon key)
CREATE POLICY "notes_read"         ON public.bluebell_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "assignments_read"   ON public.bluebell_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lesson_plans_read"  ON public.bluebell_lesson_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "announcements_read" ON public.bluebell_announcements FOR SELECT TO anon, authenticated USING (true);

-- INSERT / UPDATE / DELETE for authenticated only (staff portal + dashboard)
CREATE POLICY "notes_write"        ON public.bluebell_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assignments_write"  ON public.bluebell_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lesson_plans_write" ON public.bluebell_lesson_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "announcements_write" ON public.bluebell_announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) CBT completion / essay sets — same posture as bluebell_cbtQuestions
-- ---------------------------------------------------------------------------
ALTER TABLE public.bluebell_cbt_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluebell_cbt_essay      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbt_completion_read"  ON public.bluebell_cbt_completion;
DROP POLICY IF EXISTS "cbt_completion_write" ON public.bluebell_cbt_completion;
DROP POLICY IF EXISTS "cbt_essay_read"       ON public.bluebell_cbt_essay;
DROP POLICY IF EXISTS "cbt_essay_write"      ON public.bluebell_cbt_essay;

CREATE POLICY "cbt_completion_read"  ON public.bluebell_cbt_completion FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cbt_essay_read"       ON public.bluebell_cbt_essay FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cbt_completion_write" ON public.bluebell_cbt_completion FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cbt_essay_write"      ON public.bluebell_cbt_essay FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) bluebell_auditlogs — every portal writes here, only staff/admin read it
-- ---------------------------------------------------------------------------
ALTER TABLE public.bluebell_auditlogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditlogs_read"  ON public.bluebell_auditlogs;
DROP POLICY IF EXISTS "auditlogs_write" ON public.bluebell_auditlogs;

CREATE POLICY "auditlogs_read"  ON public.bluebell_auditlogs FOR SELECT TO authenticated USING (true);
-- anon INSERT is required: the learner portal has no Supabase session, and
-- logAction() is fire-and-forget, so a rejected audit row must never be
-- mistaken for a failed user action.
CREATE POLICY "auditlogs_write" ON public.bluebell_auditlogs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Verify — expect 14 policies across the 7 tables (4+4 academic, 2+2 CBT, 2 audit).
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bluebell_notes', 'bluebell_assignments', 'bluebell_lesson_plans',
    'bluebell_announcements', 'bluebell_cbt_completion', 'bluebell_cbt_essay', 'bluebell_auditlogs')
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- ROLLBACK — paste this block only to undo everything above.
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "notes_read"            ON public.bluebell_notes;
-- DROP POLICY IF EXISTS "notes_write"           ON public.bluebell_notes;
-- DROP POLICY IF EXISTS "assignments_read"      ON public.bluebell_assignments;
-- DROP POLICY IF EXISTS "assignments_write"     ON public.bluebell_assignments;
-- DROP POLICY IF EXISTS "lesson_plans_read"     ON public.bluebell_lesson_plans;
-- DROP POLICY IF EXISTS "lesson_plans_write"    ON public.bluebell_lesson_plans;
-- DROP POLICY IF EXISTS "announcements_read"    ON public.bluebell_announcements;
-- DROP POLICY IF EXISTS "announcements_write"   ON public.bluebell_announcements;
-- DROP POLICY IF EXISTS "cbt_completion_read"   ON public.bluebell_cbt_completion;
-- DROP POLICY IF EXISTS "cbt_completion_write"  ON public.bluebell_cbt_completion;
-- DROP POLICY IF EXISTS "cbt_essay_read"        ON public.bluebell_cbt_essay;
-- DROP POLICY IF EXISTS "cbt_essay_write"       ON public.bluebell_cbt_essay;
-- DROP POLICY IF EXISTS "auditlogs_read"        ON public.bluebell_auditlogs;
-- DROP POLICY IF EXISTS "auditlogs_write"       ON public.bluebell_auditlogs;
