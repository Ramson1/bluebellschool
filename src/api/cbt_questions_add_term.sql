-- SQL Migration: Add term column to bluebell_cbtQuestions table
-- Run this in Supabase SQL Editor

-- Add term column for filtering CBT questions by term
ALTER TABLE bluebell_cbtQuestions
ADD COLUMN IF NOT EXISTS term TEXT DEFAULT '';

-- Add index for better query performance on term filtering
CREATE INDEX IF NOT EXISTS idx_cbt_questions_term ON bluebell_cbtQuestions(term);

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bluebell_cbtQuestions'
AND column_name = 'term';
