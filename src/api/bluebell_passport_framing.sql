-- =====================================================================
-- bluebell_student / bluebell_staff — add passport_frame
-- Requirement: each ID-card passport must be cropped to its own subject,
-- not by one global CSS value. Students differ in height, camera distance
-- and headroom, so a shared crop frames some well and others badly.
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive / idempotent — safe to run more than once, and safe on a
-- database that already has these tables provisioned.
--
-- The application (src/utils/passportFraming.js, used by
-- src/pages_components/IdCards.jsx) writes this column, so this migration
-- MUST be run before that code is deployed; otherwise PostgREST rejects the
-- update (undefined_column 42703) and the computed framing is silently never
-- saved — the cards still re-detect on every page load.
-- =====================================================================

-- Payload shape (jsonb):
--   { "v": 1, "src": "<stored image path>", "iw": 640, "ih": 853,
--     "z": 1.2, "fx": 0.5, "fy": 0.31, "by": "ml" | "heur" | "default" }
--
--   src  the photo the numbers were computed from; a re-uploaded passport
--        no longer matches, so the app re-frames it automatically
--   z    extra zoom on top of object-fit:cover, clamped 1.0 - 1.6
--   fx   face centre as a fraction of image width (0 - 1)
--   fy   face centre as a fraction of image height (0 - 1)
--   by   which tier produced it, so a better method can recompute "default"
--
-- NULL means "never analysed" — the app renders a sensible default crop, so
-- there is nothing to back-fill for existing rows.

ALTER TABLE bluebell_student
  ADD COLUMN IF NOT EXISTS passport_frame JSONB;

ALTER TABLE bluebell_staff
  ADD COLUMN IF NOT EXISTS passport_frame JSONB;

-- Display-only framing data: it is read with the row it belongs to and never
-- filtered or joined on, so no index is required.
-- CREATE INDEX IF NOT EXISTS idx_bluebell_student_passport_frame ON bluebell_student(passport_frame);

-- Verify both columns exist.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('bluebell_student', 'bluebell_staff')
  AND column_name = 'passport_frame'
ORDER BY table_name, ordinal_position;
