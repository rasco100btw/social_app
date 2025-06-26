/*
  # Add formatted_content column to messages table

  1. Changes
    - Add `formatted_content` column to `messages` table
      - Type: JSONB
      - Nullable: true
      - Default: null
      - Purpose: Store formatted message content with rich text formatting

  2. Security
    - No additional RLS policies needed as the column inherits existing table policies
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'formatted_content'
  ) THEN
    ALTER TABLE messages 
    ADD COLUMN formatted_content JSONB;
  END IF;
END $$;