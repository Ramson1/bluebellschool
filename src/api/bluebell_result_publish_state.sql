-- =====================================================================
-- bluebell_result — per-term / per-type result publishing state
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Idempotent: the column is only added when it does not exist yet, and
-- every existing result row defaults to {} (no explicit keys) so the
-- legacy uploadResult flag keeps governing visibility until the new
-- "All Results Review" grid publishes a specific term and type.
--
-- What it controls:
--   publish_state is a JSONB object with up to six keys:
--     term1_midterm, term1_general, term2_midterm, term2_general,
--     term3_midterm, term3_general
--   true  = that term+type result is published (student can view it)
--   false = explicitly unpublished (student is blocked even if the
--           legacy uploadResult flag is true)
--   absent key = no per-term decision yet; the student portal falls
--           back to the legacy row-level uploadResult flag, so nothing
--           changes for rows published before this migration.
--
-- Where it is set:
--   Admin Dashboard -> Result page -> "All Results Review" grid
--   (Publish Ready Results / per-card Publish / Unpublish). The
--   student portal gate (isResultPublished in src/utils/resultPublish.js)
--   reads it when a pupil checks a result.
-- =====================================================================

ALTER TABLE bluebell_result
  ADD COLUMN IF NOT EXISTS publish_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bluebell_result.publish_state IS
  'Per-term publish flags: term1_midterm, term1_general, term2_midterm, term2_general, term3_midterm, term3_general. true=published, false=explicitly unpublished; absent key falls back to legacy uploadResult.';

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bluebell_result' AND column_name = 'publish_state';
