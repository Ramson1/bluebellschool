-- =====================================================================
-- NEW TABLE: jmis_assignment_submissions (student -> teacher submissions)
-- Requirement 10: students submit their assignment / assessment / project
-- work (text and/or a file) to the teacher who set it; the teacher reviews
-- it in the staff portal (Submissions page).
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive / idempotent — safe to run more than once.
--
-- Files are stored in the EXISTING public "cbt" storage bucket under
-- submissions/ (same posture as academics uploads) — no new bucket or
-- storage policy is required here.
-- =====================================================================

CREATE TABLE IF NOT EXISTS jmis_assignment_submissions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id   bigint NOT NULL,        -- references jmis_assignments.id (no FK, matches platform style)
  class           text NOT NULL,
  subject         text,
  student_id      bigint,
  student_name    text NOT NULL,
  submission_text text,
  file_url        text,
  status          text DEFAULT 'submitted', -- 'submitted' | 'reviewed'
  submitted_at    timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- One submission per student per assignment — enables an idempotent upsert
-- (re-submitting edits the same row instead of creating duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_assignment_student
  ON jmis_assignment_submissions (assignment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submission_assignment
  ON jmis_assignment_submissions (assignment_id);

-- RLS: students submit without a full login (token access, anon key) and the
-- staff/admin read + review with an authenticated session. Mirror the
-- permissive posture of the other jmis platform tables (chat / academics).
ALTER TABLE jmis_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_anon_all"   ON jmis_assignment_submissions;
DROP POLICY IF EXISTS "submissions_authed_all" ON jmis_assignment_submissions;
CREATE POLICY "submissions_anon_all"   ON jmis_assignment_submissions FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "submissions_authed_all" ON jmis_assignment_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'jmis_assignment_submissions'
ORDER BY ordinal_position;
