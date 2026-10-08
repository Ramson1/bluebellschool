-- =====================================================================
-- CBT maximum score + idempotent submission key
--
-- Two gaps this closes:
--
-- 1. A CBT paper's maximum mark was only ever IMPLIED by how many questions
--    it happens to contain. Teachers could not state "this paper is worth 60",
--    so the app could not scale a student's correct-answer count onto the
--    marks the paper is actually worth. Adds a teacher-declared "maxScore"
--    to every CBT question table.
--
-- 2. A result submitted over a slow/shared connection used to be retried with
--    plain INSERT/UPDATE calls, so a retry could record the same attempt twice
--    and add the marks again. Adds a stable "submissionKey" to the audit table
--    plus a unique index, so a duplicate submission is rejected by the
--    database instead of by luck.
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive/idempotent — safe to run more than once. Existing rows and
-- existing values are NOT modified.
--
-- "bluebell_cbtQuestions" is stored with a mixed-case name and its columns are
-- camelCase, so every identifier below is double-quoted exactly as Postgres
-- requires. bluebell_cbt_completion / bluebell_cbt_essay are lower-case tables but
-- still carry camelCase columns, so those columns are quoted too.
-- =====================================================================

-- 1. Teacher-declared maximum mark per paper --------------------------------
ALTER TABLE "bluebell_cbtQuestions"    ADD COLUMN IF NOT EXISTS "maxScore" numeric;
ALTER TABLE "bluebell_cbt_completion"  ADD COLUMN IF NOT EXISTS "maxScore" numeric;
ALTER TABLE "bluebell_cbt_essay"       ADD COLUMN IF NOT EXISTS "maxScore" numeric;

-- 2. Marks the paper is worth, recorded on every audited submission ---------
ALTER TABLE "bluebell_cbt_results"     ADD COLUMN IF NOT EXISTS "maxScore" numeric;

-- 3. Stable identity of one student's one attempt at one paper --------------
--    Built from student id + exam row id + subject + term + purpose, so a
--    reload, an offline retry or a second tab recognises the SAME submission.
ALTER TABLE "bluebell_cbt_results"     ADD COLUMN IF NOT EXISTS "submissionKey" text;

CREATE UNIQUE INDEX IF NOT EXISTS cbt_results_submission_key
  ON "bluebell_cbt_results" ("submissionKey")
  WHERE "submissionKey" IS NOT NULL;

-- Rows recorded before this change have no key; they are left exactly as they
-- are, so the partial index above does not collide with them.

-- 4. Read access for the submissions the CBT client now checks before writing
--    (bluebell_cbt_results already has anon SELECT from bluebell_cbt_results_setup.sql;
--    restated here so this script also works on a project where that file has
--    not been run yet.)
ALTER TABLE "bluebell_cbt_results" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbt_results_anon_read" ON "bluebell_cbt_results";
CREATE POLICY "cbt_results_anon_read" ON "bluebell_cbt_results"
  FOR SELECT TO anon USING (true);

-- Verify
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('bluebell_cbtQuestions', 'bluebell_cbt_completion', 'bluebell_cbt_essay', 'bluebell_cbt_results')
  AND column_name IN ('maxScore', 'submissionKey')
ORDER BY table_name, column_name;
