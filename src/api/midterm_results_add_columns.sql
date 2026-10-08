-- Direct SQL commands to add midterm columns to bluebell_result table
-- Run these commands in your Supabase SQL editor

-- Add midterm subject arrays to result table
ALTER TABLE bluebell_result 
ADD COLUMN IF NOT EXISTS term1midtermsubjects JSONB DEFAULT '[]'::jsonb, 
ADD COLUMN IF NOT EXISTS term2midtermsubjects JSONB DEFAULT '[]'::jsonb, 
ADD COLUMN IF NOT EXISTS term3midtermsubjects JSONB DEFAULT '[]'::jsonb;

-- Add midterm overall result objects to result table
ALTER TABLE bluebell_result 
ADD COLUMN IF NOT EXISTS overall1midterm JSONB DEFAULT '{}', 
ADD COLUMN IF NOT EXISTS overall2midterm JSONB DEFAULT '{}', 
ADD COLUMN IF NOT EXISTS overall3midterm JSONB DEFAULT '{}';

-- Create indexes for better performance on midterm fields
CREATE INDEX IF NOT EXISTS idx_result_term1_midterm_subjects ON bluebell_result USING gin (term1midtermsubjects);
CREATE INDEX IF NOT EXISTS idx_result_term2_midterm_subjects ON bluebell_result USING gin (term2midtermsubjects);
CREATE INDEX IF NOT EXISTS idx_result_term3_midterm_subjects ON bluebell_result USING gin (term3midtermsubjects);

-- Update existing records to ensure they have the new fields with default values
UPDATE bluebell_result SET 
  term1midtermsubjects = '[]'::jsonb, 
  term2midtermsubjects = '[]'::jsonb, 
  term3midtermsubjects = '[]'::jsonb, 
  overall1midterm = '{}', 
  overall2midterm = '{}', 
  overall3midterm = '{}' 
WHERE 
  term1midtermsubjects IS NULL 
  OR term2midtermsubjects IS NULL 
  OR term3midtermsubjects IS NULL 
  OR overall1midterm IS NULL 
  OR overall2midterm IS NULL 
  OR overall3midterm IS NULL;

-- Verify that the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bluebell_result' 
  AND (column_name LIKE '%midterm%');