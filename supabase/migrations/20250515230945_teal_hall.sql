/*
  # Add media_type column to posts table

  1. Changes
    - Add media_type column to posts table to store the type of media (image/video)
    - Set default value to empty array to match media column behavior
    - Make it nullable to handle posts without media

  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Maintains consistency with existing media column structure
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'posts' 
    AND column_name = 'media_type'
  ) THEN
    ALTER TABLE posts
    ADD COLUMN media_type text[] DEFAULT '{}'::text[];
  END IF;
END $$;