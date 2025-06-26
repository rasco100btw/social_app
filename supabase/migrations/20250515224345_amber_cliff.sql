/*
  # Create messages table with relationships

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `content` (text)
      - `sender_id` (uuid, references profiles)
      - `receiver_id` (uuid, references profiles)
      - `status` (text)
      - `media` (text array)
      - `media_type` (text array)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on messages table
    - Add policies for:
      - Reading own messages
      - Sending messages
      - Updating own sent messages
*/

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text DEFAULT 'sent',
  media text[],
  media_type text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT messages_receiver_id_fkey
FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can read their own messages"
ON messages FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id OR
  auth.uid() = receiver_id
);

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own sent messages"
ON messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Add updated_at trigger
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();