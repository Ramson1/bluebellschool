-- =====================================================================
-- bluebell_staff — allow the administrator to grant CBT score editing
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Idempotent: the column is only added when it does not exist yet, and
-- every existing staff member defaults to false (locked) until granted.
--
-- What it controls:
--   When false (default) a staff member CANNOT change a score that a student
--   CBT exam auto-filled (the Examination cell for a general exam, or the Test
--   cell for a midterm sitting) in the staff portal Results editor. Their own
--   CA entries (Test / Project) are always editable, and the admin portal is
--   never affected.
--   The staff scope (bluebell/bluebellschool-staff/src/utils/scope.js) reads this column and
--   exposes it as scope.canEditCbtScores; the staff Result page locks the CBT
--   cell and preserves the stored score on save whenever it is not true.
--
-- Where it is set:
--   Admin Dashboard -> Staff Accounts -> the "CBT Exam Scores" checkbox in the
--   create / edit form, plus the inline "Can edit / Locked" toggle column.
-- =====================================================================

ALTER TABLE bluebell_staff
  ADD COLUMN IF NOT EXISTS can_edit_cbt_scores BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN bluebell_staff.can_edit_cbt_scores IS
  'When true, this staff member may edit CBT-auto-filled exam scores in the staff portal; default false locks them.';

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bluebell_staff' AND column_name = 'can_edit_cbt_scores';
