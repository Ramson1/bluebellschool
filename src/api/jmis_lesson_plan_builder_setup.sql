-- =============================================================================
-- BluebellSchool · Lesson Plan builder — structured template columns
-- -----------------------------------------------------------------------------
-- The school's paper LESSON PLAN has far more fields than the original
-- jmis_lesson_plans outline (class/subject/week/objectives/content/
-- activities/resources). This migration ADDS the missing structured columns
-- so teachers can author a full, professional lesson plan and print it in the
-- exact paper format.
--
-- It is NON-DESTRUCTIVE on purpose: we use ALTER ... ADD COLUMN IF NOT EXISTS
-- (never DROP) so every existing lesson-plan record is preserved and simply
-- gains NULL for the new fields. This is the "migrate old records, lose
-- nothing" behaviour requested. Run this ONCE in the Supabase SQL Editor.
--
-- The `steps` column stores the "Lesson Structure" table as a JSON array:
--   [ { "step": "Lead in / Motivation", "time": "5 mins",
--       "teacher": "...", "student": "..." }, ... ]
-- =============================================================================

-- Core template meta -----------------------------------------------------------
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS topic              TEXT;
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS sub_topic          TEXT;
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS lesson_no          TEXT;   -- "Lesson: 3"
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS duration           TEXT;   -- "Time: 35 minutes"
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS age                TEXT;   -- "Age: 5 years"
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS lesson_date        TEXT;   -- Sign/Date on the paper form

-- Pedagogic fields -------------------------------------------------------------
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS prior_knowledge    TEXT;
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS possible_problems  TEXT;   -- Possible problems & solutions
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS evaluation         TEXT;   -- Evaluation (teacher)
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS homework           TEXT;

-- Lesson Structure table (Step/Activity · Time · Teacher · Student) ------------
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS steps              JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Sign-off ---------------------------------------------------------------------
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS teacher_name       TEXT;
ALTER TABLE jmis_lesson_plans ADD COLUMN IF NOT EXISTS head_teacher       TEXT;

-- Keep the review list snappy when the admin filters by status/date.
CREATE INDEX IF NOT EXISTS idx_jmis_lesson_plans_updated ON jmis_lesson_plans(updated_at DESC);
