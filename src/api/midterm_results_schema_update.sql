-- SQL script to add midterm result fields to bluebell_result table

-- First, let's see what tables exist that match our result table pattern
DO $$
DECLARE
  result_table_name TEXT;
  table_found BOOLEAN := FALSE;
BEGIN
  -- Look for the result table
  SELECT table_name INTO result_table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND LOWER(table_name) = 'bluebell_result'
  LIMIT 1;
  
  IF result_table_name IS NOT NULL THEN
    table_found := TRUE;
    
    -- Add midterm subject arrays to result table
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS term1midtermsubjects JSONB DEFAULT ''[]''::jsonb, ADD COLUMN IF NOT EXISTS term2midtermsubjects JSONB DEFAULT ''[]''::jsonb, ADD COLUMN IF NOT EXISTS term3midtermsubjects JSONB DEFAULT ''[]''::jsonb', result_table_name);

    -- Add midterm overall result objects to result table
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS overall1midterm JSONB DEFAULT ''{}'', ADD COLUMN IF NOT EXISTS overall2midterm JSONB DEFAULT ''{}'', ADD COLUMN IF NOT EXISTS overall3midterm JSONB DEFAULT ''{}''', result_table_name);

    -- Create indexes for better performance on midterm fields
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_result_term1_midterm_subjects ON %I USING gin (term1midtermsubjects)', result_table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_result_term2_midterm_subjects ON %I USING gin (term2midtermsubjects)', result_table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_result_term3_midterm_subjects ON %I USING gin (term3midtermsubjects)', result_table_name);

    -- Update existing records to ensure they have the new fields with default values
    -- This is just to ensure consistency across all records
    EXECUTE format('UPDATE %I SET term1midtermsubjects = ''[]''::jsonb, term2midtermsubjects = ''[]''::jsonb, term3midtermsubjects = ''[]''::jsonb, overall1midterm = ''{}'', overall2midterm = ''{}'', overall3midterm = ''{}'' WHERE term1midtermsubjects IS NULL OR term2midtermsubjects IS NULL OR term3midtermsubjects IS NULL OR overall1midterm IS NULL OR overall2midterm IS NULL OR overall3midterm IS NULL', result_table_name);
  END IF;
  
  IF NOT table_found THEN
    RAISE NOTICE 'Table bluebell_result does not exist, skipping schema update';
  END IF;
END $$;