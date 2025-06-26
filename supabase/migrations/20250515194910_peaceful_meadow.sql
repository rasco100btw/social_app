/*
  # Enhanced Profile and Social Features

  1. New Columns
    - Added to profiles:
      - first_name (text)
      - last_name (text)
      - filiere (text)
      - hobbies (text[])
      - bio (text)
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS filiere text,
ADD COLUMN IF NOT EXISTS hobbies text[],
ADD COLUMN IF NOT EXISTS bio text;