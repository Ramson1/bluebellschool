-- FINAL VERSION: All lowercase table names (PostgreSQL standard)
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- Then click RUN once

-- Drop old tables if they exist
DROP TABLE IF EXISTS bluebell_cbt_completion CASCADE;
DROP TABLE IF EXISTS bluebell_cbt_essay CASCADE;

-- Create completion questions table
CREATE TABLE bluebell_cbt_completion (
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

-- Create essay questions table
CREATE TABLE bluebell_cbt_essay (
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

-- Create indexes
CREATE INDEX idx_cbt_comp_subject ON bluebell_cbt_completion(subject);
CREATE INDEX idx_cbt_comp_class ON bluebell_cbt_completion(class);
CREATE INDEX idx_cbt_comp_term ON bluebell_cbt_completion(term);
CREATE INDEX idx_cbt_comp_purpose ON bluebell_cbt_completion(purpose);

CREATE INDEX idx_cbt_ess_subject ON bluebell_cbt_essay(subject);
CREATE INDEX idx_cbt_ess_class ON bluebell_cbt_essay(class);
CREATE INDEX idx_cbt_ess_term ON bluebell_cbt_essay(term);
CREATE INDEX idx_cbt_ess_purpose ON bluebell_cbt_essay(purpose);

-- Verify
SELECT tablename FROM pg_tables WHERE tablename LIKE 'bluebell_cbt%' ORDER BY tablename;
