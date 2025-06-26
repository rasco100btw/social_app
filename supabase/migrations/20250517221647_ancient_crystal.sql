/*
  # Add Pinned Posts Feature
  
  1. Changes
    - Add `is_pinned` column to posts table
    - Add `pinned_at` column to posts table
    - Add `pinned_by` column to posts table
    - Create index for efficient querying of pinned posts
    
  2. Security
    - Only teachers and admins can pin/unpin posts
    - Maintain existing RLS policies
*/

-- Add columns to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES profiles(id);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON posts(is_pinned) WHERE is_pinned = true;

-- Create function to handle post pinning
CREATE OR REPLACE FUNCTION handle_post_pin()
RETURNS TRIGGER AS $$
BEGIN
  -- If post is being pinned
  IF NEW.is_pinned = true AND (OLD.is_pinned = false OR OLD.is_pinned IS NULL) THEN
    -- Set pinned_at to current time
    NEW.pinned_at := now();
    
    -- Create notification for post author if they're not the one pinning
    IF NEW.pinned_by != NEW.author_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        link
      ) VALUES (
        NEW.author_id,
        'post_pinned',
        'Your post has been pinned',
        'A teacher or admin has pinned your post to the top of the feed',
        '/posts/' || NEW.id
      );
    END IF;
  END IF;
  
  -- If post is being unpinned
  IF NEW.is_pinned = false AND OLD.is_pinned = true THEN
    -- Clear pinned_at and pinned_by
    NEW.pinned_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for post pinning
CREATE TRIGGER on_post_pin
  BEFORE UPDATE OF is_pinned ON posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_post_pin();

-- Update RLS policies to allow teachers and admins to pin posts
CREATE POLICY "Teachers and admins can pin posts"
  ON posts
  FOR UPDATE
  TO authenticated
  USING (
    (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('teacher', 'admin')
    ) OR (
      -- Maintain existing policy for authors to update their own posts
      auth.uid() = author_id
    )
  )
  WITH CHECK (
    (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('teacher', 'admin')
    ) OR (
      -- Maintain existing policy for authors to update their own posts
      auth.uid() = author_id
    )
  );