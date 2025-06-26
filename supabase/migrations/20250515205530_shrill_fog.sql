/*
  # Add biography column to profiles table

  1. Changes
    - Add `bio` column to `profiles` table
      - Type: text
      - Nullable: true
      - Default: empty string

  2. Notes
    - Using DO block to safely add column if it doesn't exist
    - Setting default value to empty string to prevent null issues
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text DEFAULT '';
  END IF;
END $$;