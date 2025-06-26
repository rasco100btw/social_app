/*
  # Add Polls Feature
  
  1. New Tables
    - `polls` - Stores poll questions and metadata
    - `poll_options` - Stores options for each poll
    - `poll_votes` - Tracks user votes on polls
  
  2. Changes
    - Add poll-related columns to posts table
    - Create indexes for efficient querying
    - Add RLS policies for proper access control
*/

-- Add poll-related columns to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS is_poll boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS poll_data jsonb;

-- Create polls table
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  end_date timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(post_id)
);

-- Create poll_options table
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create poll_votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger to polls (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_polls_updated_at'
  ) THEN
    CREATE TRIGGER update_polls_updated_at
      BEFORE UPDATE ON polls
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create policies for polls
CREATE POLICY "Anyone can view polls"
  ON polls
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create polls"
  ON polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_id
      AND posts.author_id = auth.uid()
    )
  );

-- Create policies for poll_options
CREATE POLICY "Anyone can view poll options"
  ON poll_options
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create poll options"
  ON poll_options
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls
      JOIN posts ON polls.post_id = posts.id
      WHERE polls.id = poll_id
      AND posts.author_id = auth.uid()
    )
  );

-- Create policies for poll_votes
CREATE POLICY "Anyone can view poll votes"
  ON poll_votes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can vote in polls"
  ON poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (
      SELECT 1 FROM poll_votes
      WHERE poll_id = poll_votes.poll_id
      AND user_id = auth.uid()
    )
  );

-- Create function to check if poll has ended
CREATE OR REPLACE FUNCTION has_poll_ended(poll_id uuid)
RETURNS boolean AS $$
DECLARE
  end_date timestamptz;
BEGIN
  SELECT polls.end_date INTO end_date
  FROM polls
  WHERE polls.id = poll_id;
  
  IF end_date IS NULL THEN
    RETURN false;
  ELSE
    RETURN end_date < now();
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to prevent voting on ended polls
CREATE OR REPLACE FUNCTION check_poll_vote()
RETURNS TRIGGER AS $$
BEGIN
  IF has_poll_ended(NEW.poll_id) THEN
    RAISE EXCEPTION 'This poll has ended';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent voting on ended polls (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'check_poll_vote_trigger'
  ) THEN
    CREATE TRIGGER check_poll_vote_trigger
      BEFORE INSERT ON poll_votes
      FOR EACH ROW
      EXECUTE FUNCTION check_poll_vote();
  END IF;
END $$;

-- Create index for efficient poll querying
CREATE INDEX IF NOT EXISTS idx_polls_post_id ON polls(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_poll ON poll_votes(user_id, poll_id);