/*
  # Add saved posts functionality

  1. New Tables
    - `saved_posts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `post_id` (uuid, references posts)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `saved_posts` table
    - Add policies for users to manage their saved posts
    - Add policy for users to view their own saved posts

  3. Indexes
    - Create index on (user_id, post_id) for efficient lookups
*/

-- Create saved posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create unique index to prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS saved_posts_user_id_post_id_key ON public.saved_posts (user_id, post_id);

-- Enable RLS
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their saved posts"
  ON saved_posts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own saved posts"
  ON saved_posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);