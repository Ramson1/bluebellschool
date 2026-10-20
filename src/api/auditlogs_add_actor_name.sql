-- =====================================================================
-- bluebell_auditlogs — add actor_name
-- Requirement: audit/notification entries must identify the person who
-- made a change by their STAFF NAME, not "Unknown User".
--
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- It is additive / idempotent — safe to run more than once, and safe on a
-- database that already has the bluebell_auditlogs table provisioned.
--
-- The application (src/api/auditLog.js) now writes this column, so this
-- migration MUST be run before the staff/admin/student portal code that
-- inserts actor_name is deployed; otherwise PostgREST rejects the insert
-- (undefined_column 42703) and the audit row is silently dropped.
-- =====================================================================

ALTER TABLE bluebell_auditlogs
  ADD COLUMN IF NOT EXISTS actor_name TEXT;

-- Display-only: no index required unless an actor_name search filter is added.
-- CREATE INDEX IF NOT EXISTS idx_bluebell_auditlogs_actor_name ON bluebell_auditlogs(actor_name);

-- Verify the column exists.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bluebell_auditlogs'
ORDER BY ordinal_position;
