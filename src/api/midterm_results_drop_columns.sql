-- Direct SQL commands to drop obsolete midterm columns from jmis_result table
-- Run these commands in your Supabase SQL editor

-- Drop indexes on midterm subject arrays if they exist
DROP INDEX IF EXISTS idx_result_term1_midterm_subjects;
DROP INDEX IF EXISTS idx_result_term2_midterm_subjects;
DROP INDEX IF EXISTS idx_result_term3_midterm_subjects;

-- Drop midterm subject and overall columns
ALTER TABLE jmis_result 
  DROP COLUMN IF EXISTS term1midtermsubjects,
  DROP COLUMN IF EXISTS term2midtermsubjects,
  DROP COLUMN IF EXISTS term3midtermsubjects,
  DROP COLUMN IF EXISTS overall1midterm,
  DROP COLUMN IF EXISTS overall2midterm,
  DROP COLUMN IF EXISTS overall3midterm;

-- Verify that the columns were removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jmis_result' 
  AND (column_name LIKE '%midterm%');

