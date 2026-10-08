-- ---------------------------------------------------------------------------
-- CBT question sets: record which teacher created each set
-- ---------------------------------------------------------------------------
-- PURPOSE
--   The staff portal now enforces record-level ownership: a teacher may only
--   see, edit and delete the question sets THEY uploaded for a class+subject
--   they are assigned to. Notes (bluebell_notes.uploaded_by), assignments
--   (bluebell_assignments.created_by) and lesson plans
--   (bluebell_lesson_plans.submitted_by) already carry an author column; the three
--   CBT tables did not, so this adds one.
--
-- IDENTIFIER CASING
--   The questions table was created as a quoted mixed-case name
--   "bluebell_cbtQuestions", so every reference to it MUST stay double-quoted or
--   Postgres lowercases it to public.bluebell_cbtquestions and fails with 42P01
--   relation does not exist. The other two tables are plain snake_case and need
--   no quoting.
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL Editor (project
--   BLUEBELL_SUPABASE_REF_PLACEHOLDER) and press Run. The application cannot execute DDL.
--   Every statement is idempotent, so it is safe to run more than once.
--
-- EFFECT ON EXISTING DATA
--   Rows with no author (created_by IS NULL) are treated as "not created by
--   this teacher" and are therefore hidden from every staff account — they
--   stay fully visible in the admin portal. All three tables are currently
--   empty, so nothing is hidden today. Anything created from now on through
--   the staff portal is stamped with the uploading teacher's email.
--
-- BEFORE RUNNING (optional sanity check — expect 0 rows today)
--   SELECT 'bluebell_cbtQuestions' AS tbl, count(*) AS untagged FROM public."bluebell_cbtQuestions" WHERE created_by IS NULL;
--   (skip the lines for any table that does not have the column yet)
--
-- ROLLBACK (ownership filtering then falls back to class+subject scope)
--   ALTER TABLE public."bluebell_cbtQuestions" DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE public.bluebell_cbt_completion  DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE public.bluebell_cbt_essay       DROP COLUMN IF EXISTS created_by;
-- ---------------------------------------------------------------------------

ALTER TABLE public."bluebell_cbtQuestions"
  ADD COLUMN IF NOT EXISTS created_by text;

ALTER TABLE public.bluebell_cbt_completion
  ADD COLUMN IF NOT EXISTS created_by text;

ALTER TABLE public.bluebell_cbt_essay
  ADD COLUMN IF NOT EXISTS created_by text;

-- The staff question bank filters by author, then by class and subject.
CREATE INDEX IF NOT EXISTS idx_cbtquestions_created_by
  ON public."bluebell_cbtQuestions" (created_by, class, subject);
CREATE INDEX IF NOT EXISTS idx_cbtcompletion_created_by
  ON public.bluebell_cbt_completion (created_by, class, subject);
CREATE INDEX IF NOT EXISTS idx_cbtessay_created_by
  ON public.bluebell_cbt_essay (created_by, class, subject);

-- Back-fill anything an administrator already uploaded so it stays attributed
-- instead of owner-less. Uses the audit log where a matching action exists;
-- rows it cannot attribute are left NULL (and stay admin-only).
--
-- NOTE: the audit log records cbt_question_add with targetTable; there is no
-- per-row record id on every entry, so this back-fill is deliberately not
-- automated. To attribute a known set by hand after running the ALTERs:
--   UPDATE public."bluebell_cbtQuestions" SET created_by = 'teacher@email.com' WHERE id = <id>;
