-- Email Notification Enhancement - Database Migration
-- Run this in Supabase SQL Editor to enable multiple email recipients

-- Add column for additional email recipients
ALTER TABLE bluebell_settings 
ADD COLUMN IF NOT EXISTS additionalEmails TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bluebell_settings.additionalEmails IS 'Comma-separated list of additional email addresses to receive CBT result notifications';

-- Example configuration (uncomment and update with your actual emails)
-- UPDATE bluebell_settings 
-- SET 
--   adminEmail = 'principal@school.com',
--   additionalEmails = 'registrar@school.com,ict@school.com,exams@school.com';

-- Verify the changes
SELECT 
  'Email configuration updated successfully!' as status,
  adminEmail,
  additionalEmails
FROM bluebell_settings
LIMIT 1;
