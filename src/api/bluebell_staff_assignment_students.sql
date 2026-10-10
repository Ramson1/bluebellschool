-- bluebell_staff_assignments — per-subject student cohorts
--
-- Adds a nullable JSONB column that records WHICH students a specific
-- subject_teacher assignment covers. This powers the "select specific students
-- for a subject" picker on the admin Staff Accounts modal (e.g. Coding is only
-- offered by a handful of students school-wide).
--
-- Semantics:
--   []            -> open enrolment: every student in that class takes the subject
--   ["<uuid>",..] -> restricted cohort: only these students take the subject
--   class_teacher rows always keep [] (a form teacher owns the whole class).
--
-- The app (app/api/staff-assignments/route.ts) reads/writes this column and
-- gracefully falls back to ignoring it if the column is absent, so plain
-- class/subject editing keeps working even before you run this. Attaching a
-- cohort, however, REQUIRES this column.
--
-- Run this ONCE in the Supabase SQL Editor for the JMIS project. Repeat the
-- equivalent (bluebell_ / spring_ prefix) for the other two builds.

ALTER TABLE public.bluebell_staff_assignments
  ADD COLUMN IF NOT EXISTS student_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Optional: index to find cohorts fast (GIN over the JSONB array of ids).
CREATE INDEX IF NOT EXISTS idx_bluebell_staff_assign_students
  ON public.bluebell_staff_assignments USING GIN (student_ids);

-- Verify:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bluebell_staff_assignments' AND column_name = 'student_ids';
