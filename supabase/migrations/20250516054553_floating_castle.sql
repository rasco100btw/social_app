/*
  # Add hobbies column to profiles table

  1. Changes
    - Add `hobbies` column to `profiles` table as TEXT[] to store multiple hobbies
    - Set default value to empty array
    - Allow NULL values for flexibility

  2. Security
    - No additional RLS policies needed as the existing profile policies will cover this column
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS hobbies TEXT[] DEFAULT '{}'::TEXT[];

-- Update existing rows to have default empty array if needed
UPDATE profiles 
SET hobbies = '{}'::TEXT[] 
WHERE hobbies IS NULL;