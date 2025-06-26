/*
  # Add Group Messages Functionality

  1. New Tables
    - `group_messages` - For storing messages in group chats
    - `group_message_reads` - For tracking read status of messages

  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
    - Create triggers for notifications
*/

-- Create group_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES student_groups(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  media text[],
  media_type text[],
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Group members can read messages" ON group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON group_messages;

-- Create policies
CREATE POLICY "Group members can read messages"
  ON group_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_messages.group_id
      AND group_membership.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages"
  ON group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_messages.group_id
      AND group_membership.user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_group_messages_updated_at
  BEFORE UPDATE ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new group messages
CREATE OR REPLACE FUNCTION handle_new_group_message()
RETURNS TRIGGER AS $$
DECLARE
  group_name text;
  member_id uuid;
BEGIN
  -- Get group name
  SELECT name INTO group_name
  FROM student_groups
  WHERE id = NEW.group_id;
  
  -- Notify all group members except the sender
  FOR member_id IN (
    SELECT user_id FROM group_membership
    WHERE group_id = NEW.group_id
    AND user_id != NEW.sender_id
  ) LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    ) VALUES (
      member_id,
      'group_message',
      'New message in ' || group_name,
      (SELECT name FROM profiles WHERE id = NEW.sender_id) || ': ' || 
      substring(NEW.content, 1, 50) || CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END,
      '/groups/' || NEW.group_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new group messages
CREATE TRIGGER on_new_group_message
  AFTER INSERT ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_group_message();

-- Create storage bucket for group message media
INSERT INTO storage.buckets (id, name, public)
VALUES ('group_messages', 'group_messages', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Group members can upload message media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group_messages' AND
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = (storage.foldername(name))[1]::uuid
      AND group_membership.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can view message media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'group_messages' AND
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = (storage.foldername(name))[1]::uuid
      AND group_membership.user_id = auth.uid()
    )
  );

-- Create table for tracking message read status
CREATE TABLE IF NOT EXISTS group_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES student_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE group_message_reads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own read status"
  ON group_message_reads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to update read status when viewing messages
CREATE OR REPLACE FUNCTION update_group_message_read_status(p_group_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO group_message_reads (group_id, user_id)
  VALUES (p_group_id, auth.uid())
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET last_read_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;