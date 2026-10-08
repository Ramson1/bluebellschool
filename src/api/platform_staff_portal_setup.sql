-- =====================================================================
-- PLATFORM EXPANSION 3/5: Staff portal academic tables
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- Backs assignments/assessments, notes, lesson plans, scheme of work,
-- announcements, class participation and subject reviews.
-- All file_url values point at the existing 'cbt' storage bucket under
-- the academics/ folder (Storage -> cbt -> academics).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Shared trigger function (re-declared here so this file can run
--    independently of the enquiries setup file)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jmis_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1) jmis_assignments — homework / assessments / projects per class+subject
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_assignments CASCADE;
CREATE TABLE jmis_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  due_date DATE,
  attachment_url TEXT,
  assignment_type TEXT DEFAULT 'assignment',   -- 'assignment' | 'assessment' | 'project'
  academic_session TEXT,
  term TEXT,
  created_by TEXT,                             -- staff email
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_assignments_class ON jmis_assignments(class);
CREATE INDEX idx_jmis_assignments_subject ON jmis_assignments(subject);
CREATE INDEX idx_jmis_assignments_due ON jmis_assignments(due_date);

-- ---------------------------------------------------------------------
-- 2) jmis_notes — lesson notes / documents shared with a class+subject
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_notes CASCADE;
CREATE TABLE jmis_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  academic_session TEXT,
  term TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_notes_class ON jmis_notes(class);
CREATE INDEX idx_jmis_notes_subject ON jmis_notes(subject);

-- ---------------------------------------------------------------------
-- 3) jmis_lesson_plans — weekly lesson plans/outline; admin review trail
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_lesson_plans CASCADE;
CREATE TABLE jmis_lesson_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  academic_session TEXT,
  term TEXT,
  week INT,
  objectives TEXT,
  content TEXT,
  activities TEXT,
  resources TEXT,
  submitted_by TEXT,
  review_status TEXT DEFAULT 'pending',        -- 'pending' | 'reviewed' | 'approved' | 'revision'
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_lesson_plans_class ON jmis_lesson_plans(class);
CREATE INDEX idx_jmis_lesson_plans_review ON jmis_lesson_plans(review_status);

DROP TRIGGER IF EXISTS trg_jmis_lesson_plans_updated ON jmis_lesson_plans;
CREATE TRIGGER trg_jmis_lesson_plans_updated
  BEFORE UPDATE ON jmis_lesson_plans
  FOR EACH ROW EXECUTE FUNCTION jmis_touch_updated_at();

-- ---------------------------------------------------------------------
-- 4) jmis_scheme_of_work — termly scheme of work per class+subject
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_scheme_of_work CASCADE;
CREATE TABLE jmis_scheme_of_work (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  academic_session TEXT,
  term TEXT,
  topic TEXT,
  content TEXT,
  file_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_sow_class ON jmis_scheme_of_work(class);
CREATE INDEX idx_jmis_sow_subject ON jmis_scheme_of_work(subject);

-- ---------------------------------------------------------------------
-- 5) jmis_announcements — audience targeting:
--    'all_students' | 'all_staff' | 'public' (website news) | 'class:<name>'
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_announcements CASCADE;
CREATE TABLE jmis_announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all_students',
  pinned BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jmis_announcements_audience ON jmis_announcements(audience);
CREATE INDEX idx_jmis_announcements_created ON jmis_announcements(created_at DESC);

-- ---------------------------------------------------------------------
-- 6) jmis_class_participation — per-lesson participation scores.
--    one record per student/subject/day keeps re-scans idempotent.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_class_participation CASCADE;
CREATE TABLE jmis_class_participation (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT,
  student_name TEXT NOT NULL,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  score INT CHECK (score >= 0 AND score <= 5),
  note TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_participation_student_subject_day UNIQUE (student_name, class, subject, date)
);
CREATE INDEX idx_jmis_participation_class ON jmis_class_participation(class);
CREATE INDEX idx_jmis_participation_student ON jmis_class_participation(student_name);

-- ---------------------------------------------------------------------
-- 7) jmis_student_reviews — teacher written review per subject/term
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS jmis_student_reviews CASCADE;
CREATE TABLE jmis_student_reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT,
  student_name TEXT NOT NULL,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  academic_session TEXT,
  term TEXT,
  review TEXT,
  rating INT CHECK (rating >= 0 AND rating <= 10),
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_review_student_subject_term UNIQUE (student_name, class, subject, term, academic_session)
);
CREATE INDEX idx_jmis_reviews_student ON jmis_student_reviews(student_name);
CREATE INDEX idx_jmis_reviews_class ON jmis_student_reviews(class);

-- ---------------------------------------------------------------------
-- 8) Verify
-- ---------------------------------------------------------------------
SELECT tablename FROM pg_tables
WHERE tablename IN ('jmis_assignments','jmis_notes','jmis_lesson_plans',
  'jmis_scheme_of_work','jmis_announcements','jmis_class_participation','jmis_student_reviews')
ORDER BY tablename;
