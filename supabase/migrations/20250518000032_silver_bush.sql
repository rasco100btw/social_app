/*
  # Fix Saved Posts Table Migration

  1. Changes
    - Create saved_posts table if it doesn't exist
    - Add unique constraint for user_id and post_id
    - Add proper indexes for performance
    - Ensure RLS policies are created without conflicts

  2. Security
    - Enable RLS on saved_posts table
    - Add policies for users to manage their own saved posts
*/

-- Check if the table exists first
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_posts') THEN
    -- Create saved_posts table
    CREATE TABLE public.saved_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now() NOT NULL
    );

    -- Create unique index to prevent duplicate saves
    CREATE UNIQUE INDEX saved_posts_user_id_post_id_key ON public.saved_posts (user_id, post_id);

    -- Enable RLS
    ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Check if policies exist before creating them
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'saved_posts' AND policyname = 'Users can manage their saved posts'
  ) THEN
    CREATE POLICY "Users can manage their saved posts"
      ON saved_posts
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'saved_posts' AND policyname = 'Users can view their own saved posts'
  ) THEN
    CREATE POLICY "Users can view their own saved posts"
      ON saved_posts
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE tablename = 'saved_posts' AND indexname = 'idx_saved_posts_user_id'
  ) THEN
    CREATE INDEX idx_saved_posts_user_id ON saved_posts(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE tablename = 'saved_posts' AND indexname = 'idx_saved_posts_post_id'
  ) THEN
    CREATE INDEX idx_saved_posts_post_id ON saved_posts(post_id);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE tablename = 'saved_posts' AND indexname = 'idx_saved_posts_created_at'
  ) THEN
    CREATE INDEX idx_saved_posts_created_at ON saved_posts(created_at DESC);
  END IF;
END $$;