/*
  # Profile System Enhancement

  1. Changes
    - Add educational background fields
    - Add location fields
    - Add social links and contact preferences
    - Add hobby categories and sample hobbies

  2. Security
    - No changes to RLS policies
    - Default JSON values for new columns
*/

-- Update profiles table with new fields
DO $$ 
BEGIN 
  -- Only attempt to drop if column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'hobbies'
  ) THEN
    ALTER TABLE profiles DROP COLUMN hobbies;
  END IF;
END $$;

-- Add educational background fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS field_of_study text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduation_year integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution text;

-- Add location fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_country text;

-- Add social and contact preference fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_preferences jsonb DEFAULT '{"email": true, "messages": true}';

-- Add hobby categories
INSERT INTO hobby_categories (name, description) VALUES
  ('Sports & Fitness', 'Physical activities for health and recreation'),
  ('Creative Arts', 'Artistic and creative pursuits'),
  ('Entertainment', 'Leisure and entertainment activities'),
  ('Learning & Development', 'Educational and skill-building activities'),
  ('Social Activities', 'Community and social engagement')
ON CONFLICT (name) DO NOTHING;

-- Add sample hobbies for each category
INSERT INTO hobbies (name, description, category_id, time_commitment, cost_level)
SELECT 'Basketball', 'Team sport played on a court', id, 'Medium', 'Low'
FROM hobby_categories WHERE name = 'Sports & Fitness'
ON CONFLICT (name) DO NOTHING;

INSERT INTO hobbies (name, description, category_id, time_commitment, cost_level)
SELECT 'Photography', 'Capturing moments through a lens', id, 'Flexible', 'Medium'
FROM hobby_categories WHERE name = 'Creative Arts'
ON CONFLICT (name) DO NOTHING;

INSERT INTO hobbies (name, description, category_id, time_commitment, cost_level)
SELECT 'Gaming', 'Playing video and computer games', id, 'Flexible', 'Varies'
FROM hobby_categories WHERE name = 'Entertainment'
ON CONFLICT (name) DO NOTHING;

INSERT INTO hobbies (name, description, category_id, time_commitment, cost_level)
SELECT 'Programming', 'Creating software and applications', id, 'High', 'Low'
FROM hobby_categories WHERE name = 'Learning & Development'
ON CONFLICT (name) DO NOTHING;

INSERT INTO hobbies (name, description, category_id, time_commitment, cost_level)
SELECT 'Volunteering', 'Helping communities and causes', id, 'Flexible', 'Low'
FROM hobby_categories WHERE name = 'Social Activities'
ON CONFLICT (name) DO NOTHING;