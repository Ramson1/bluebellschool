-- =====================================================================
-- bluebell_result — de-duplicate student result rows (OPERATOR-RUN, REVIEW FIRST)
--
-- Context: a bug let editing an already-saved result INSERT a duplicate row
-- instead of updating the existing one, so some students now have several
-- identical bluebell_result rows. The application bug is fixed; this script cleans
-- up the leftover duplicate DATA only.
--
-- DESTRUCTIVE. Run it in the Supabase SQL Editor for THIS build's database,
-- STEP BY STEP. Do not run the whole thing blind. The delete is wrapped in a
-- transaction so you can ROLLBACK while checking.
--
-- Rule: for each studentId keep ONE row — the newest by id, which is the row
-- the fixed editor treats as authoritative — and delete the surplus. Every
-- deleted row is first copied into a dedicated backup table so nothing is
-- lost and the change can be reversed.
-- =====================================================================

-- STEP 1 — PREVIEW. Run this alone first and eyeball it. Each row listed has
-- duplicates (ids shown). This is the same set the app was creating.
SELECT "studentId", count(*) AS rows,
       array_agg(id ORDER BY id) AS ids
FROM bluebell_result
GROUP BY "studentId"
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- STEP 2 — BACK UP + DELETE surplus (keep the newest id per student).
-- Leave the final COMMIT commented the first time; run the inner statements,
-- check STEP 3, then COMMIT (or ROLLBACK) deliberately.
BEGIN;

-- 2a. Snapshot every row that is about to be removed.
DROP TABLE IF EXISTS bluebell_result_dedup_backup;
CREATE TABLE bluebell_result_dedup_backup AS
SELECT r.*
FROM bluebell_result r
JOIN (
  SELECT "studentId", max(id) AS keep_id
  FROM bluebell_result
  GROUP BY "studentId"
  HAVING count(*) > 1
) d
  ON d."studentId" = r."studentId"
 AND r.id <> d.keep_id;

-- 2b. Confirm the backup captured exactly the surplus rows.
SELECT count(*) AS backed_up_rows FROM bluebell_result_dedup_backup;

-- 2c. Delete the surplus rows (same predicate as the backup).
DELETE FROM bluebell_result r
USING (
  SELECT "studentId", max(id) AS keep_id
  FROM bluebell_result
  GROUP BY "studentId"
  HAVING count(*) > 1
) d
WHERE d."studentId" = r."studentId"
  AND r.id <> d.keep_id;

-- STEP 3 — VERIFY: this must return ZERO rows before you commit.
SELECT "studentId", count(*) AS rows
FROM bluebell_result
GROUP BY "studentId"
HAVING count(*) > 1;

-- If STEP 3 is empty and STEP 2b looked right, commit; otherwise ROLLBACK.
COMMIT;
-- ROLLBACK;  -- use this instead of COMMIT if anything looked wrong.

-- To restore a backed-up row later (only after a COMMIT you want to undo):
-- INSERT INTO bluebell_result
-- SELECT b.* FROM bluebell_result_dedup_backup b
-- WHERE NOT EXISTS (SELECT 1 FROM bluebell_result r WHERE r.id = b.id);
