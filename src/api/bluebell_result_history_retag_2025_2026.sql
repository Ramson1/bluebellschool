-- =============================================================================
-- Result Archive: re-tag archived results to the correct (previous) session.
--
-- Context
--   * 2026/2027 is the NEW current session (bluebell_settings.session).
--   * The results that appear on the Result Archive page are from the LAST
--     session (2025/2026), but their bluebell_result_history.archived_session label
--     is wrong (empty, or left as 2026/2027 because the session label was
--     changed before the results were archived).
--
-- IMPORTANT — the archive page shows TWO kinds of rows:
--   1. "Archived" rows  -> come from bluebell_result_history, labelled by
--      archived_session. STEP B below fixes these. THIS IS THE USUAL CASE.
--   2. "Current" rows   -> come from the LIVE bluebell_result table (the "Include
--      current" switch is on). bluebell_result has NO session column, so these
--      cannot be labelled 2025/2026 by editing history. If your old results are
--      showing as "Current", do NOT run STEP B on them — instead archive them
--      under 2025/2026 via Session Tools (see the note at the bottom of file).
--
-- Paste this whole script into the Supabase SQL Editor and Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP A: PREVIEW — see exactly which session labels the archive carries now.
--         Read the counts BEFORE running the update, so you know what changes.
-- -----------------------------------------------------------------------------
SELECT COALESCE(NULLIF(archived_session, ''), '(empty)') AS session_label,
       COUNT(*) AS rows
FROM bluebell_result_history
GROUP BY archived_session
ORDER BY rows DESC;

-- -----------------------------------------------------------------------------
-- STEP B: RETAG the mislabelled archive rows to 2025/2026.
--         Targets only rows that are empty or wrongly stamped 2026/2027, so any
--         genuinely older session (e.g. 2024/2025) is left untouched.
-- -----------------------------------------------------------------------------
UPDATE bluebell_result_history
SET archived_session = '2025/2026'
WHERE archived_session IS NULL
   OR archived_session = ''
   OR archived_session = '2026/2027';

-- -----------------------------------------------------------------------------
-- STEP C: VERIFY — rerun the same breakdown; everything from Step B should now
--         sit under 2025/2026.
-- -----------------------------------------------------------------------------
SELECT COALESCE(NULLIF(archived_session, ''), '(empty)') AS session_label,
       COUNT(*) AS rows
FROM bluebell_result_history
GROUP BY archived_session
ORDER BY rows DESC;

-- =============================================================================
-- IF YOUR OLD RESULTS SHOW AS "Current" (not "Archived"):
-- They are still in the live bluebell_result table and have no session label. To
-- move them into the archive under 2025/2026 without losing them, use the app:
--   1. Session Tools -> Academic Session -> Correct the CURRENT session label
--      from 2026/2027 back to 2025/2026 (this just renames the active session).
--   2. Then run "Start New Session" (rollover) with the new label 2026/2027.
--      The rollover archives every bluebell_result row tagged archived_session =
--      2025/2026 (the session at archive time), verifies inserted == source,
--      then clears bluebell_result and sets the active session to 2026/2027.
--   3. Turn "Include current" OFF on the Result Archive page to view just the
--      archived 2025/2026 results.
-- =============================================================================
