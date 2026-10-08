-- SQL Migration: Add term column to jmis_cbtQuestions table
-- Run this in Supabase SQL Editor

-- Add term column for filtering CBT questions by term
ALTER TABLE jmis_cbtQuestions
ADD COLUMN IF NOT EXISTS term TEXT DEFAULT '';

-- Add index for better query performance on term filtering
CREATE INDEX IF NOT EXISTS idx_cbt_questions_term ON jmis_cbtQuestions(term);

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'jmis_cbtQuestions'
AND column_name = 'term';
