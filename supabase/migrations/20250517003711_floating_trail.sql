/*
  # Add likes functionality
  
  1. New Tables
    - `post_likes`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references posts)
      - `user_id` (uuid, references profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for like management
*/

CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view likes
CREATE POLICY "Anyone can view likes"
  ON post_likes FOR SELECT
  TO authenticated
  USING (true);

-- Users can manage their own likes
CREATE POLICY "Users can manage their own likes"
  ON post_likes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to get like count for a post
CREATE OR REPLACE FUNCTION get_post_likes(post_id uuid)
RETURNS bigint AS $$
  SELECT COUNT(*)
  FROM post_likes
  WHERE post_likes.post_id = $1;
$$ LANGUAGE sql STABLE;

-- Function to check if user liked a post
CREATE OR REPLACE FUNCTION has_user_liked(post_id uuid, user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM post_likes
    WHERE post_likes.post_id = $1
    AND post_likes.user_id = $2
  );
$$ LANGUAGE sql STABLE;