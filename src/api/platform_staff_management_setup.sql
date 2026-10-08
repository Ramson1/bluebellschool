-- =====================================================================
-- PLATFORM EXPANSION 1/5: Staff directory upgrade, assignments, secretary
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Existing live tables are ALTERed (never dropped). New tables follow the
-- proven DROP-if-exists + CREATE convention (all names lowercase).
--
-- STORAGE: also create a private-or-public bucket named 'staff_passport'
-- (Storage -> New bucket -> staff_passport, public read) for staff photos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) jmis_staff — add the full profile fields the admin creates
--    (NAME, SEX, STAFF NO (auto), ADDRESS, CLASS, DESIGNATION, SUBJECT,
--     EMAIL, PHONE NUMBER, PROFILE PIC) plus portal linkage.
-- ---------------------------------------------------------------------
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS staff_no TEXT UNIQUE;
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS class_assigned TEXT;      -- display class (homeroom)
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS designation TEXT;         -- e.g. 'Teacher', 'Security', 'Secretary'
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}'; -- subjects taught
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Academic'; -- 'Academic' | 'Non-Academic'
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS profile_pic TEXT;         -- file path in staff_passport bucket
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS auth_user_id UUID;        -- Supabase auth.users id
ALTER TABLE jmis_staff ADD COLUMN IF NOT EXISTS qr_payload TEXT;          -- {"staffId":..,"name":..,"role":..}
-- status semantics widen: 'active' | 'suspended' | 'blocked' (legacy 'inactive' tolerated)

-- Auto-generate STAFF NO like JMI-0001
CREATE SEQUENCE IF NOT EXISTS jmis_staff_no_seq START 1;

CREATE OR REPLACE FUNCTION jmis_staff_set_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.staff_no IS NULL OR NEW.staff_no = '' THEN
    NEW.staff_no := 'JMI-' || lpad(nextval('jmis_staff_no_seq')::text, 4, '0');
  END IF;
  IF NEW.qr_payload IS NULL OR NEW.qr_payload = '' THEN
    NEW.qr_payload := jsonb_build_object(
      'staffId', COALESCE(NEW.id::text, ''),
      'name', COALESCE(NEW.name, ''),
      'role', COALESCE(NEW.designation, 'Staff')
    )::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jmis_staff_defaults ON jmis_staff;
CREATE TRIGGER trg_jmis_staff_defaults
  BEFORE INSERT ON jmis_staff
  FOR EACH ROW EXECUTE FUNCTION jmis_staff_set_defaults();

CREATE INDEX IF NOT EXISTS idx_jmis_staff_email ON jmis_staff(lower(email));
CREATE INDEX IF NOT EXISTS idx_jmis_staff_auth_user ON jmis_staff(auth_user_id);

-- ---------------------------------------------------------------------
-- 2) jmis_staff_assignments — which class/subject each staff member owns.
--    subject NULL + assignment_type='class_teacher' => whole class.
--    Drives every scoping rule in the staff portal.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_staff_assignments CASCADE;
CREATE TABLE jmis_staff_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES jmis_staff(id) ON DELETE CASCADE,
  class TEXT NOT NULL,
  subject TEXT,                                -- NULL = all subjects (class teacher)
  assignment_type TEXT NOT NULL DEFAULT 'subject_teacher', -- 'class_teacher' | 'subject_teacher'
  academic_session TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_staff_assignment UNIQUE (staff_id, class, subject, assignment_type, academic_session)
);
CREATE INDEX idx_jmis_staff_assign_staff ON jmis_staff_assignments(staff_id);
CREATE INDEX idx_jmis_staff_assign_class ON jmis_staff_assignments(class);

-- ---------------------------------------------------------------------
-- 3) jmis_secretaryauth — secretary role emails (read-only dashboard access)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_secretaryauth CASCADE;
CREATE TABLE jmis_secretaryauth (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4) Verify
-- ---------------------------------------------------------------------
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jmis_staff'
ORDER BY column_name;
SELECT tablename FROM pg_tables
WHERE tablename IN ('jmis_staff_assignments','jmis_secretaryauth')
ORDER BY tablename;
