-- SQL Migration: Add completion and essay tables for CBT exams
-- Run this ENTIRE script in Supabase SQL Editor
-- All statements are safe to run multiple times

-- ============================================
-- STEP 1: Drop tables if they exist (clean slate)
-- ============================================
DROP TABLE IF EXISTS jmis_cbtCompletion CASCADE;
DROP TABLE IF EXISTS jmis_cbtEssay CASCADE;

-- ============================================
-- STEP 2: Create Completion Questions Table
-- ============================================
CREATE TABLE jmis_cbtCompletion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  class TEXT NOT NULL,
  term TEXT DEFAULT '',
  duration INTEGER NOT NULL,
  purpose TEXT DEFAULT 'practice',
  questions JSONB NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create Essay Questions Table
-- ============================================
CREATE TABLE jmis_cbtEssay (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  class TEXT NOT NULL,
  term TEXT DEFAULT '',
  duration INTEGER NOT NULL,
  purpose TEXT DEFAULT 'practice',
  questions JSONB NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 4: Create Indexes
-- ============================================

-- Completion indexes
CREATE INDEX idx_cbt_completion_subject ON jmis_cbtCompletion(subject);
CREATE INDEX idx_cbt_completion_class ON jmis_cbtCompletion(class);
CREATE INDEX idx_cbt_completion_term ON jmis_cbtCompletion(term);
CREATE INDEX idx_cbt_completion_purpose ON jmis_cbtCompletion(purpose);

-- Essay indexes
CREATE INDEX idx_cbt_essay_subject ON jmis_cbtEssay(subject);
CREATE INDEX idx_cbt_essay_class ON jmis_cbtEssay(class);
CREATE INDEX idx_cbt_essay_term ON jmis_cbtEssay(term);
CREATE INDEX idx_cbt_essay_purpose ON jmis_cbtEssay(purpose);

-- ============================================
-- STEP 5: Verify (should show both tables)
-- ============================================
SELECT tablename, schemaname
FROM pg_tables
WHERE tablename IN ('jmis_cbtcompletion', 'jmis_cbtessay')
ORDER BY tablename;
