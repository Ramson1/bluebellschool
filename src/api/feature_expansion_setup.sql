-- =====================================================================
-- FEATURE EXPANSION SETUP: Staff, Attendance, Audit Logs, Result History
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Convention: DROP before CREATE (reliable in Supabase query runner),
-- all table/column names lowercase_with_underscores.
-- NOTE: This script is additive for new tables. bluebell_result_history is
-- created with LIKE bluebell_result so it mirrors the live schema exactly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) bluebell_staff — staff directory for staff attendance
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_staff CASCADE;
CREATE TABLE bluebell_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',            -- 'Staff' | 'Teacher' | 'Admin'
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',         -- 'active' | 'inactive'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bluebell_staff_name ON bluebell_staff(name);
CREATE INDEX idx_bluebell_staff_status ON bluebell_staff(status);

-- ---------------------------------------------------------------------
-- 2) bluebell_attendance — daily student check-ins (QR or manual)
--    unique(student_name, class, date) blocks duplicates server-side
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_attendance CASCADE;
CREATE TABLE bluebell_attendance (
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
CREATE INDEX idx_bluebell_attendance_date ON bluebell_attendance(date);
CREATE INDEX idx_bluebell_attendance_class ON bluebell_attendance(class);
CREATE INDEX idx_bluebell_attendance_term ON bluebell_attendance(term);
CREATE INDEX idx_bluebell_attendance_name ON bluebell_attendance(student_name);

-- ---------------------------------------------------------------------
-- 3) bluebell_staff_attendance — daily staff check-ins
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_staff_attendance CASCADE;
CREATE TABLE bluebell_staff_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id UUID REFERENCES bluebell_staff(id) ON DELETE SET NULL,
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
CREATE INDEX idx_bluebell_staff_att_date ON bluebell_staff_attendance(date);
CREATE INDEX idx_bluebell_staff_att_name ON bluebell_staff_attendance(staff_name);

-- ---------------------------------------------------------------------
-- 4) bluebell_auditlogs — every admin/teacher action (developer excluded
--    client-side in src/api/auditLog.js)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_auditlogs CASCADE;
CREATE TABLE bluebell_auditlogs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT,
  action TEXT NOT NULL,                 -- e.g. 'student_add', 'result_update'
  target_table TEXT,
  record_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,    -- before/after snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bluebell_auditlogs_created ON bluebell_auditlogs(created_at);
CREATE INDEX idx_bluebell_auditlogs_email ON bluebell_auditlogs(email);
CREATE INDEX idx_bluebell_auditlogs_action ON bluebell_auditlogs(action);

-- ---------------------------------------------------------------------
-- 5) bluebell_result_history — archive of bluebell_result rows per session.
--    LIKE INCLUDING ALL mirrors the live bluebell_result schema exactly
--    (keeps raw JSONB untouched).
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_result_history CASCADE;
CREATE TABLE bluebell_result_history (
  LIKE bluebell_result INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_session TEXT
);
-- bluebell_result may already own a primary key via LIKE; ensure index on lookups
CREATE INDEX IF NOT EXISTS idx_bluebell_result_history_studentid ON bluebell_result_history("studentId");
CREATE INDEX IF NOT EXISTS idx_bluebell_result_history_class ON bluebell_result_history("studentClass");

-- ---------------------------------------------------------------------
-- 6) bluebell_settings — optional session history bookkeeping column
-- ---------------------------------------------------------------------
ALTER TABLE bluebell_settings ADD COLUMN IF NOT EXISTS session_history JSONB DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 7) Passport placeholder backfill
--    IMPORTANT: manually upload a 'placeholder.png' image into the
--    Supabase Storage 'passport' bucket (Storage -> passport -> Upload),
--    then run the backfill below. Until then, students without a photo
--    keep showing as before.
-- ---------------------------------------------------------------------
-- UPDATE bluebell_student SET passport = 'placeholder.png' WHERE passport IS NULL OR passport = '';

-- ---------------------------------------------------------------------
-- 8) Verify
-- ---------------------------------------------------------------------
SELECT tablename FROM pg_tables WHERE tablename IN
  ('bluebell_staff','bluebell_attendance','bluebell_staff_attendance','bluebell_auditlogs','bluebell_result_history')
ORDER BY tablename;
