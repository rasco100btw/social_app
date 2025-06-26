/*
  # Add message reactions support

  1. New Tables
    - `message_reactions`
      - `id` (uuid, primary key)
      - `message_id` (uuid, references messages)
      - `user_id` (uuid, references profiles)
      - `emoji` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for reaction management
*/

CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own reactions
CREATE POLICY "Users can manage their reactions"
  ON message_reactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can view reactions on messages they can see
CREATE POLICY "Users can view message reactions"
  ON message_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );