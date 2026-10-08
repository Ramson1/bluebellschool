-- ULTRA SIMPLE: Create tables one at a time
-- Run EACH statement separately in Supabase SQL Editor

-- First, run ONLY this line:
DROP TABLE IF EXISTS bluebell_cbtcompletion CASCADE;

-- Then run ONLY this line:
DROP TABLE IF EXISTS bluebell_cbtessay CASCADE;

-- Then run ONLY this:
CREATE TABLE bluebell_cbtcompletion (
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

-- Then run ONLY this:
CREATE TABLE bluebell_cbtessay (
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

-- Then run all indexes together:
CREATE INDEX ON bluebell_cbtcompletion(subject);
CREATE INDEX ON bluebell_cbtcompletion(class);
CREATE INDEX ON bluebell_cbtcompletion(term);
CREATE INDEX ON bluebell_cbtcompletion(purpose);
CREATE INDEX ON bluebell_cbtessay(subject);
CREATE INDEX ON bluebell_cbtessay(class);
CREATE INDEX ON bluebell_cbtessay(term);
CREATE INDEX ON bluebell_cbtessay(purpose);

-- Finally verify:
SELECT tablename FROM pg_tables WHERE tablename LIKE 'bluebell_cbt%' ORDER BY tablename;
