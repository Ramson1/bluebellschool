-- =====================================================================
-- FEATURE EXPANSION SETUP: Staff, Attendance, Audit Logs, Result History
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Convention: DROP before CREATE (reliable in Supabase query runner),
-- all table/column names lowercase_with_underscores.
-- NOTE: This script is additive for new tables. jmis_result_history is
-- created with LIKE jmis_result so it mirrors the live schema exactly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) jmis_staff — staff directory for staff attendance
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_staff CASCADE;
CREATE TABLE jmis_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',            -- 'Staff' | 'Teacher' | 'Admin'
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',         -- 'active' | 'inactive'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_staff_name ON jmis_staff(name);
CREATE INDEX idx_jmis_staff_status ON jmis_staff(status);

-- ---------------------------------------------------------------------
-- 2) jmis_attendance — daily student check-ins (QR or manual)
--    unique(student_name, class, date) blocks duplicates server-side
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_attendance CASCADE;
CREATE TABLE jmis_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT,
  student_name TEXT NOT NULL,
  class TEXT NOT NULL,
  date DATE NOT NULL,
  session TEXT,
  term TEXT,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'manual',         -- 'qr' | 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_attendance_student_day UNIQUE (student_name, class, date)
);
CREATE INDEX idx_jmis_attendance_date ON jmis_attendance(date);
CREATE INDEX idx_jmis_attendance_class ON jmis_attendance(class);
CREATE INDEX idx_jmis_attendance_term ON jmis_attendance(term);
CREATE INDEX idx_jmis_attendance_name ON jmis_attendance(student_name);

-- ---------------------------------------------------------------------
-- 3) jmis_staff_attendance — daily staff check-ins
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_staff_attendance CASCADE;
CREATE TABLE jmis_staff_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id UUID REFERENCES jmis_staff(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  role TEXT,
  date DATE NOT NULL,
  session TEXT,
  term TEXT,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_staff_attendance_day UNIQUE (staff_name, date)
);
CREATE INDEX idx_jmis_staff_att_date ON jmis_staff_attendance(date);
CREATE INDEX idx_jmis_staff_att_name ON jmis_staff_attendance(staff_name);

-- ---------------------------------------------------------------------
-- 4) jmis_auditlogs — every admin/teacher action (developer excluded
--    client-side in src/api/auditLog.js)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_auditlogs CASCADE;
CREATE TABLE jmis_auditlogs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT,
  action TEXT NOT NULL,                 -- e.g. 'student_add', 'result_update'
  target_table TEXT,
  record_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,    -- before/after snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_auditlogs_created ON jmis_auditlogs(created_at);
CREATE INDEX idx_jmis_auditlogs_email ON jmis_auditlogs(email);
CREATE INDEX idx_jmis_auditlogs_action ON jmis_auditlogs(action);

-- ---------------------------------------------------------------------
-- 5) jmis_result_history — archive of jmis_result rows per session.
--    LIKE INCLUDING ALL mirrors the live jmis_result schema exactly
--    (keeps raw JSONB untouched).
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_result_history CASCADE;
CREATE TABLE jmis_result_history (
  LIKE jmis_result INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_session TEXT
);
-- jmis_result may already own a primary key via LIKE; ensure index on lookups
CREATE INDEX IF NOT EXISTS idx_jmis_result_history_studentid ON jmis_result_history("studentId");
CREATE INDEX IF NOT EXISTS idx_jmis_result_history_class ON jmis_result_history("studentClass");

-- ---------------------------------------------------------------------
-- 6) jmis_settings — optional session history bookkeeping column
-- ---------------------------------------------------------------------
ALTER TABLE jmis_settings ADD COLUMN IF NOT EXISTS session_history JSONB DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 7) Passport placeholder backfill
--    IMPORTANT: manually upload a 'placeholder.png' image into the
--    Supabase Storage 'passport' bucket (Storage -> passport -> Upload),
--    then run the backfill below. Until then, students without a photo
--    keep showing as before.
-- ---------------------------------------------------------------------
-- UPDATE jmis_student SET passport = 'placeholder.png' WHERE passport IS NULL OR passport = '';

-- ---------------------------------------------------------------------
-- 8) Verify
-- ---------------------------------------------------------------------
SELECT tablename FROM pg_tables WHERE tablename IN
  ('jmis_staff','jmis_attendance','jmis_staff_attendance','jmis_auditlogs','jmis_result_history')
ORDER BY tablename;
