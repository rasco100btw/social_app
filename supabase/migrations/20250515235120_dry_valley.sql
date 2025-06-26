/*
  # Add link column to messages table

  1. Changes
    - Add `link` column to `messages` table to store URLs for shared posts
      - Type: text
      - Nullable: true (not all messages will have links)

  2. Notes
    - Using DO block with IF NOT EXISTS check for safety
    - No data migration needed as new column can be null
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'link'
  ) THEN
    ALTER TABLE messages ADD COLUMN link text;
  END IF;
END $$;