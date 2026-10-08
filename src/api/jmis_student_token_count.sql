-- =====================================================================
-- TOKEN BUDGET: move the student "token count" onto jmis_student
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN once.
--
-- WHY: tokenCount used to live ONLY on jmis_result rows. Students with no
-- result row (fresh admissions, or results wiped by a new-session rollover)
-- therefore had nowhere to store a count — the admin "edit to 5" write hit a
-- 0-row UPDATE and silently did nothing, leaving the counter stuck at 0.
--
-- FIX: jmis_student.tokenCount becomes the single, always-present source of
-- truth (default 5). The result-view counter now decrements THIS column.
--
-- NOTE: camelCase column must be quoted. The Supabase JS client maps the
-- `tokenCount` field to this quoted column automatically.
-- =====================================================================

ALTER TABLE jmis_student
  ADD COLUMN IF NOT EXISTS "tokenCount" INTEGER NOT NULL DEFAULT 5;

-- The existing rows are backfilled to 5 by the DEFAULT above, which also
-- resets every student to the expected 5 — that is intentional.

-- ---------------------------------------------------------------------
-- RLS: allow the result-view decrement to UPDATE jmis_student.
-- The student portal verifies a learner by name + access token WITHOUT a
-- login, so the write happens under the anon role. These policies are
-- idempotent (drop/create) and permissive, matching the posture already used
-- for jmis_result / jmis_result_history in this platform.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "student_anon_update"   ON jmis_student;
DROP POLICY IF EXISTS "student_authed_update" ON jmis_student;
CREATE POLICY "student_anon_update"   ON jmis_student FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "student_authed_update" ON jmis_student FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'jmis_student' AND column_name = 'tokenCount';
