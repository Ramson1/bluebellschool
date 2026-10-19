-- =====================================================================
-- TABLE: bluebell_assignment_submissions (student -> teacher submissions)
-- Requirement 10: students submit their assignment / assessment / project
-- work as TEXT and/or one-or-more FILES and/or IMAGES (all at once) to the
-- teacher who set it; the teacher reviews it in the staff portal
-- (Submissions page).
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive / idempotent — safe to run more than once. It also upgrades
-- an existing (single-file) table by adding the new `attachments` column.
--
-- Files/images are stored in the EXISTING public "cbt" storage bucket under
-- submissions/ (falling back to "passport"). Students submit with the ANON
-- key, so the storage INSERT policies at the bottom are REQUIRED for their
-- uploads to succeed.
-- =====================================================================

CREATE TABLE IF NOT EXISTS bluebell_assignment_submissions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id   bigint NOT NULL,        -- references bluebell_assignments.id (no FK, matches platform style)
  class           text NOT NULL,
  subject         text,
  student_id      bigint,
  student_name    text NOT NULL,
  submission_text text,
  file_url        text,                   -- kept as a backward-compat mirror of attachments[0]
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb, -- NEW: [{url,name,type,mime,size}]
  status          text DEFAULT 'submitted', -- 'submitted' | 'reviewed'
  submitted_at    timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Upgrade an existing single-file table with the multi-attachment column.
ALTER TABLE bluebell_assignment_submissions
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- One submission per student per assignment — enables an idempotent upsert
-- (re-submitting edits the same row instead of creating duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_assignment_student
  ON bluebell_assignment_submissions (assignment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submission_assignment
  ON bluebell_assignment_submissions (assignment_id);

-- RLS: students submit without a full login (token access, anon key) and the
-- staff/admin read + review with an authenticated session. Mirror the
-- permissive posture of the other jmis platform tables (chat / academics).
ALTER TABLE bluebell_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_anon_all"   ON bluebell_assignment_submissions;
DROP POLICY IF EXISTS "submissions_authed_all" ON bluebell_assignment_submissions;
CREATE POLICY "submissions_anon_all"   ON bluebell_assignment_submissions FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "submissions_authed_all" ON bluebell_assignment_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage: allow ANON (student portal) + authenticated uploads into the public
-- 'cbt' bucket (and the 'passport' fallback). Objects are read via public URLs,
-- so no SELECT policy is needed as long as the bucket is public.
DROP POLICY IF EXISTS "submissions_cbt_upload"      ON storage.objects;
CREATE POLICY "submissions_cbt_upload" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'cbt');
DROP POLICY IF EXISTS "submissions_passport_upload" ON storage.objects;
CREATE POLICY "submissions_passport_upload" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'passport');

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bluebell_assignment_submissions'
ORDER BY ordinal_position;
