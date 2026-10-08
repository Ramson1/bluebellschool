-- ULTRA SIMPLE: Create tables one at a time
-- Run EACH statement separately in Supabase SQL Editor

-- First, run ONLY this line:
DROP TABLE IF EXISTS jmis_cbtcompletion CASCADE;

-- Then run ONLY this line:
DROP TABLE IF EXISTS jmis_cbtessay CASCADE;

-- Then run ONLY this:
CREATE TABLE jmis_cbtcompletion (
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
CREATE TABLE jmis_cbtessay (
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
CREATE INDEX ON jmis_cbtcompletion(subject);
CREATE INDEX ON jmis_cbtcompletion(class);
CREATE INDEX ON jmis_cbtcompletion(term);
CREATE INDEX ON jmis_cbtcompletion(purpose);
CREATE INDEX ON jmis_cbtessay(subject);
CREATE INDEX ON jmis_cbtessay(class);
CREATE INDEX ON jmis_cbtessay(term);
CREATE INDEX ON jmis_cbtessay(purpose);

-- Finally verify:
SELECT tablename FROM pg_tables WHERE tablename LIKE 'jmis_cbt%' ORDER BY tablename;
