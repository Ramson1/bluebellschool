-- SQL script to set up class-specific fees functionality

-- Create the bluebell_class_specific_fees table to store fees for each class
CREATE TABLE IF NOT EXISTS bluebell_class_specific_fees (
  id SERIAL PRIMARY KEY,
  class_name VARCHAR(255) NOT NULL UNIQUE,
  next_term_fees DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default fees for common classes if they don't exist
INSERT INTO bluebell_class_specific_fees (class_name, next_term_fees)
SELECT class_name, 0.00
FROM (VALUES 
  ('Creche', 0.00),
  ('Nursery 1', 0.00),
  ('Nursery 2', 0.00),
  ('Pre-Nursery 1', 0.00),
  ('Pre-Nursery 2', 0.00),
  ('Year 1', 0.00),
  ('Year 2', 0.00),
  ('Year 3', 0.00),
  ('Year 4', 0.00),
  ('Year 5', 0.00),
  ('Year 6', 0.00),
  ('Year 7', 0.00),
  ('Year 8', 0.00),
  ('Year 9', 0.00)
) AS default_classes(class_name, default_fee)
ON CONFLICT (class_name) DO NOTHING;

-- Add a column to bluebell_settings to indicate if class-specific fees are enabled
ALTER TABLE bluebell_settings 
ADD COLUMN IF NOT EXISTS use_class_specific_fees BOOLEAN DEFAULT TRUE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_class_specific_fees_class_name ON bluebell_class_specific_fees(class_name);