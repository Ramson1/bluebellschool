-- =====================================================================
-- MISSING TABLE: bluebell_cbt_results (CBT Completion + Essay exam results)
-- Symptom: CompletionExam.jsx and EssayExam.jsx insert every submitted
-- exam result into bluebell_cbt_results, and the admin dashboard reads the
-- latest 8 from it — but the table was never created, so CBT essay /
-- completion results are silently lost (inserts fail, dashboard panel
-- stays empty, Data Tools export records "Export failed" for it).
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive/idempotent — safe to run more than once.
-- Column names are camelCase (quoted) because the app code writes them
-- exactly as-is from JavaScript (studentId, sessionType, examResults...).
-- =====================================================================

CREATE TABLE IF NOT EXISTS bluebell_cbt_results (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "studentId"     bigint,
  "studentName"   text,
  "studentClass"  text,
  "score"         numeric,
  "totalQuestions" integer,
  "percentage"    numeric,
  "subject"       text,
  "term"          text,
  "purpose"       text,
  "sessionType"   text,          -- 'completion' | 'essay'
  "answers"       jsonb,         -- raw student answers
  "examResults"   jsonb,         -- full grading breakdown
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cbt_results_created_at_idx ON bluebell_cbt_results (created_at DESC);
CREATE INDEX IF NOT EXISTS cbt_results_student_idx    ON bluebell_cbt_results ("studentId");

-- RLS: exams are submitted by students with no login (token access) using the
-- anon key, and read by the admin dashboard with an authenticated session —
-- mirror the permissive posture of the other jmis platform tables.
ALTER TABLE bluebell_cbt_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbt_results_anon_read"   ON bluebell_cbt_results;
DROP POLICY IF EXISTS "cbt_results_authed_read" ON bluebell_cbt_results;
CREATE POLICY "cbt_results_anon_read"   ON bluebell_cbt_results FOR SELECT TO anon          USING (true);
CREATE POLICY "cbt_results_authed_read" ON bluebell_cbt_results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cbt_results_anon_write"   ON bluebell_cbt_results;
DROP POLICY IF EXISTS "cbt_results_authed_write" ON bluebell_cbt_results;
CREATE POLICY "cbt_results_anon_write"   ON bluebell_cbt_results FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "cbt_results_authed_write" ON bluebell_cbt_results FOR INSERT TO authenticated WITH CHECK (true);

-- Update/Delete: permissive for parity with the other jmis tables so the
-- Data Tools "Delete All Rows" function works on this table too.
DROP POLICY IF EXISTS "cbt_results_anon_update"   ON bluebell_cbt_results;
DROP POLICY IF EXISTS "cbt_results_authed_update" ON bluebell_cbt_results;
DROP POLICY IF EXISTS "cbt_results_anon_delete"   ON bluebell_cbt_results;
DROP POLICY IF EXISTS "cbt_results_authed_delete" ON bluebell_cbt_results;
CREATE POLICY "cbt_results_anon_update"   ON bluebell_cbt_results FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "cbt_results_authed_update" ON bluebell_cbt_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cbt_results_anon_delete"   ON bluebell_cbt_results FOR DELETE TO anon          USING (true);
CREATE POLICY "cbt_results_authed_delete" ON bluebell_cbt_results FOR DELETE TO authenticated USING (true);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bluebell_cbt_results'
ORDER BY ordinal_position;
