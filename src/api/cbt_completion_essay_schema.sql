-- SQL Migration: Add completion and essay tables for CBT exams
-- Run this in Supabase SQL Editor
-- Execute each section separately if you encounter errors

-- ============================================
-- SECTION 1: Create Completion Questions Table
-- ============================================
CREATE TABLE IF NOT EXISTS bluebell_cbtCompletion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  class TEXT NOT NULL,
  term TEXT DEFAULT '',
  duration INTEGER NOT NULL,
  purpose TEXT DEFAULT 'practice', -- 'practice', 'test', 'midterm', 'exam'
  questions JSONB NOT NULL, -- Array of completion questions
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SECTION 2: Create Essay Questions Table
-- ============================================
CREATE TABLE IF NOT EXISTS bluebell_cbtEssay (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  class TEXT NOT NULL,
  term TEXT DEFAULT '',
  duration INTEGER NOT NULL,
  purpose TEXT DEFAULT 'practice',
  questions JSONB NOT NULL, -- Array of essay questions
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SECTION 3: Create Indexes for Performance
-- ============================================

-- Completion table indexes
DO $$ 
BEGIN
  -- Check and create indexes for bluebell_cbtCompletion
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_completion_subject') THEN
    CREATE INDEX idx_cbt_completion_subject ON bluebell_cbtCompletion(subject);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_completion_class') THEN
    CREATE INDEX idx_cbt_completion_class ON bluebell_cbtCompletion(class);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_completion_term') THEN
    CREATE INDEX idx_cbt_completion_term ON bluebell_cbtCompletion(term);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_completion_purpose') THEN
    CREATE INDEX idx_cbt_completion_purpose ON bluebell_cbtCompletion(purpose);
  END IF;
END $$;

-- Essay table indexes
DO $$ 
BEGIN
  -- Check and create indexes for bluebell_cbtEssay
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_essay_subject') THEN
    CREATE INDEX idx_cbt_essay_subject ON bluebell_cbtEssay(subject);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_essay_class') THEN
    CREATE INDEX idx_cbt_essay_class ON bluebell_cbtEssay(class);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_essay_term') THEN
    CREATE INDEX idx_cbt_essay_term ON bluebell_cbtEssay(term);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cbt_essay_purpose') THEN
    CREATE INDEX idx_cbt_essay_purpose ON bluebell_cbtEssay(purpose);
  END IF;
END $$;

-- ============================================
-- SECTION 4: Verify Tables Were Created
-- ============================================
-- Run this separately if the above fails
SELECT 
  table_name, 
  column_name, 
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('bluebell_cbtcompletion', 'bluebell_cbtessay')
ORDER BY table_name, ordinal_position;
