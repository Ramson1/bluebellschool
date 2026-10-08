-- SQL Migration: Add Pre-Nursery 1 and Pre-Nursery 2 fields to bluebell_classfees table
-- Run this in Supabase SQL Editor

-- Add new columns for Pre-Nursery 1 and Pre-Nursery 2
ALTER TABLE bluebell_classfees
ADD COLUMN IF NOT EXISTS prenursery1 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prenursery2 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prenursery1uniform TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS prenursery2uniform TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS prenursery1textbook TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS prenursery2textbook TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS prenursery1exercisebook TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS prenursery2exercisebook TEXT DEFAULT '';

-- Optional: Migrate data from old prenursery column to prenursery1
-- Uncomment the line below if you want to copy existing prenursery data to prenursery1
-- UPDATE bluebell_classfees SET prenursery1 = prenursery WHERE prenursery IS NOT NULL AND prenursery1 = 0;

-- Optional: Drop old prenursery columns after migration
-- Uncomment these lines only after confirming data migration is successful
-- ALTER TABLE bluebell_classfees DROP COLUMN IF EXISTS prenursery;
-- ALTER TABLE bluebell_classfees DROP COLUMN IF EXISTS prenurseryuniform;
-- ALTER TABLE bluebell_classfees DROP COLUMN IF EXISTS prenurserytextbook;
-- ALTER TABLE bluebell_classfees DROP COLUMN IF EXISTS prenurseryexercisebook;

-- Verify the new columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bluebell_classfees'
AND column_name LIKE 'prenursery%'
ORDER BY column_name;
