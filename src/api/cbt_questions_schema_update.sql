-- SQL script to add purpose field to bluebell_cbtQuestions table
-- First check if the table exists before making changes

-- First, let's see what tables exist that match our pattern
DO $$
DECLARE
  found_table_name_var TEXT;
  table_found BOOLEAN := FALSE;
BEGIN
  -- Look for the CBT questions table (could be stored in different cases)
  SELECT table_name INTO found_table_name_var
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND LOWER(table_name) LIKE '%cbt%question%'
  LIMIT 1;
  
  IF found_table_name_var IS NOT NULL THEN
    table_found := TRUE;
    
    -- Use dynamic SQL to alter the table
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) DEFAULT ''practice''', found_table_name_var);
    
    -- Add constraint to ensure purpose only accepts valid values if it doesn't exist
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT valid_purpose CHECK (purpose IN (''practice'', ''test'', ''exam''))', found_table_name_var);
    EXCEPTION
      WHEN duplicate_object THEN
        -- Constraint already exists, do nothing
        NULL;
    END;
    
    -- Create index for better performance on purpose field
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cbt_questions_purpose ON %I(purpose)', found_table_name_var);
    
    -- Update existing records to have a default purpose value
    EXECUTE format('UPDATE %I SET purpose = ''practice'' WHERE purpose IS NULL OR purpose = ''''', found_table_name_var);
  END IF;
  
  IF NOT table_found THEN
    RAISE NOTICE 'No CBT questions table found, skipping schema update';
  END IF;
END $$;