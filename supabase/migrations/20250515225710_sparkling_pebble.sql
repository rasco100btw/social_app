-- Create followers table
CREATE TABLE IF NOT EXISTS followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can read all followers"
  ON followers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own follows"
  ON followers
  FOR ALL
  TO authenticated
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- Create notification trigger for new followers
CREATE OR REPLACE FUNCTION handle_new_follower()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    link
  )
  SELECT
    NEW.following_id,
    'follow',
    profiles.name || ' started following you',
    'You have a new follower',
    '/profile/' || NEW.follower_id
  FROM profiles
  WHERE profiles.id = NEW.follower_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_follower_notification
  AFTER INSERT ON followers
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_follower();