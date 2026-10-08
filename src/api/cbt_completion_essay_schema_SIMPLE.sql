-- SQL Migration: Add completion and essay tables for CBT exams
-- Run this ENTIRE script in Supabase SQL Editor
-- All statements are safe to run multiple times

-- ============================================
-- STEP 1: Drop tables if they exist (clean slate)
-- ============================================
DROP TABLE IF EXISTS bluebell_cbtCompletion CASCADE;
DROP TABLE IF EXISTS bluebell_cbtEssay CASCADE;

-- ============================================
-- STEP 2: Create Completion Questions Table
-- ============================================
CREATE TABLE bluebell_cbtCompletion (
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
CREATE TABLE bluebell_cbtEssay (
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
CREATE INDEX idx_cbt_completion_subject ON bluebell_cbtCompletion(subject);
CREATE INDEX idx_cbt_completion_class ON bluebell_cbtCompletion(class);
CREATE INDEX idx_cbt_completion_term ON bluebell_cbtCompletion(term);
CREATE INDEX idx_cbt_completion_purpose ON bluebell_cbtCompletion(purpose);

-- Essay indexes
CREATE INDEX idx_cbt_essay_subject ON bluebell_cbtEssay(subject);
CREATE INDEX idx_cbt_essay_class ON bluebell_cbtEssay(class);
CREATE INDEX idx_cbt_essay_term ON bluebell_cbtEssay(term);
CREATE INDEX idx_cbt_essay_purpose ON bluebell_cbtEssay(purpose);

-- ============================================
-- STEP 5: Verify (should show both tables)
-- ============================================
SELECT tablename, schemaname
FROM pg_tables
WHERE tablename IN ('bluebell_cbtcompletion', 'bluebell_cbtessay')
ORDER BY tablename;
