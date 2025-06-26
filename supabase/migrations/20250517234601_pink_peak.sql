/*
  # Add saved posts functionality
  
  1. New Tables
    - `saved_posts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `post_id` (uuid, references posts)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for saved posts management
    - Add indexes for performance optimization
*/

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their saved posts" ON saved_posts;
DROP POLICY IF EXISTS "Users can view their own saved posts" ON saved_posts;

-- Create saved posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create unique index to prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS saved_posts_user_id_post_id_key ON public.saved_posts (user_id, post_id);

-- Enable RLS
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON saved_posts(created_at DESC);