-- =====================================================================
-- PLATFORM EXPANSION 5/5: Class attendance status column
-- The staff portal's class-attendance screen records Present / Absent /
-- Late per pupil (separate from the gate sign-in/out flow which uses
-- check_in_time / check_out_time).
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Safe to re-run.
-- =====================================================================

ALTER TABLE bluebell_attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'present'; -- 'present' | 'absent' | 'late'
ALTER TABLE bluebell_attendance ADD COLUMN IF NOT EXISTS recorded_by TEXT;              -- staff email for class-attendance entries

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bluebell_attendance'
  AND column_name IN ('status', 'recorded_by')
ORDER BY column_name;
