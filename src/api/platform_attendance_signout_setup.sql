-- =====================================================================
-- PLATFORM EXPANSION 4/5: Attendance sign-in / sign-out upgrade
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Adds check-out tracking to BOTH student and staff attendance so the
-- admin dashboard and the (future) mobile app can record sign-in AND
-- sign-out per person per day. Existing tables hold live data — ALTER only.
-- NOTE: jmis_staff_attendance already has staff_id (feature_expansion_setup).
-- =====================================================================

ALTER TABLE jmis_attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
ALTER TABLE jmis_attendance ADD COLUMN IF NOT EXISTS sign_out_method TEXT;   -- 'qr' | 'manual'

ALTER TABLE jmis_staff_attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
ALTER TABLE jmis_staff_attendance ADD COLUMN IF NOT EXISTS sign_out_method TEXT;

-- Index to speed up "who is still in today" queries
CREATE INDEX IF NOT EXISTS idx_jmis_attendance_signout ON jmis_attendance(date, check_out_time);
CREATE INDEX IF NOT EXISTS idx_jmis_staff_att_signout ON jmis_staff_attendance(date, check_out_time);

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('jmis_attendance','jmis_staff_attendance')
  AND column_name IN ('check_out_time','sign_out_method','staff_id')
ORDER BY table_name, column_name;
