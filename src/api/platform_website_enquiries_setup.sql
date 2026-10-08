-- =====================================================================
-- PLATFORM EXPANSION 2/5: Website enquiry capture + admissions
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- These tables back the public website forms and the admin follow-up
-- ("keep in touch with potential parents") page.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) bluebell_enquiries — every contact/admission enquiry from the website.
--    follow_up_notes is a JSONB array of {at, by, note} objects appended
--    by admins; next_follow_up drives the "overdue" dashboard widget.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_enquiries CASCADE;
CREATE TABLE bluebell_enquiries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  enquiry_type TEXT DEFAULT 'general',      -- 'admission' | 'visit' | 'general'
  child_age_class TEXT,                     -- e.g. 'Nursery 1' or 'age 4'
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',       -- 'new' | 'in_progress' | 'resolved' | 'closed'
  follow_up_notes JSONB DEFAULT '[]'::jsonb,
  next_follow_up DATE,
  assigned_to TEXT,                         -- admin email owning the follow-up
  source TEXT DEFAULT 'website',            -- 'website' | 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bluebell_enquiries_status ON bluebell_enquiries(status);
CREATE INDEX idx_bluebell_enquiries_email ON bluebell_enquiries(lower(email));
CREATE INDEX idx_bluebell_enquiries_created ON bluebell_enquiries(created_at DESC);

-- keep updated_at fresh without app code
CREATE OR REPLACE FUNCTION bluebell_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bluebell_enquiries_updated ON bluebell_enquiries;
CREATE TRIGGER trg_bluebell_enquiries_updated
  BEFORE UPDATE ON bluebell_enquiries
  FOR EACH ROW EXECUTE FUNCTION bluebell_touch_updated_at();

-- ---------------------------------------------------------------------
-- 2) bluebell_admissions_applications — the full onboarding form submitted
--    from /admissions. Linked to bluebell_enquiries by parent email.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS bluebell_admissions_applications CASCADE;
CREATE TABLE bluebell_admissions_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT,
  parent_address TEXT,
  child_name TEXT NOT NULL,
  child_dob TEXT,                             -- keep flexible: ISO date string
  child_sex TEXT,
  applying_class TEXT,
  current_school TEXT,
  special_needs TEXT,
  preferred_visit_date TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',   -- 'draft'|'submitted'|'reviewed'|'offered'|'enrolled'|'declined'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bluebell_admissions_status ON bluebell_admissions_applications(status);
CREATE INDEX idx_bluebell_admissions_email ON bluebell_admissions_applications(lower(parent_email));

DROP TRIGGER IF EXISTS trg_bluebell_admissions_updated ON bluebell_admissions_applications;
CREATE TRIGGER trg_bluebell_admissions_updated
  BEFORE UPDATE ON bluebell_admissions_applications
  FOR EACH ROW EXECUTE FUNCTION bluebell_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3) Verify
-- ---------------------------------------------------------------------
SELECT tablename FROM pg_tables
WHERE tablename IN ('bluebell_enquiries','bluebell_admissions_applications')
ORDER BY tablename;
