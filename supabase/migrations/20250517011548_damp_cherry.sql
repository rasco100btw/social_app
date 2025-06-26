/*
  # Add admin post management capabilities
  
  1. Changes
    - Add policies to allow admins to manage all posts
    - Update existing post policies
    
  2. Security
    - Admins can edit/delete any post
    - Users can still manage their own posts
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Posts are readable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

-- Create new policies
CREATE POLICY "Posts are readable by everyone"
ON posts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create posts"
ON posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts"
ON posts FOR UPDATE
TO authenticated
USING (
  auth.uid() = author_id OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  auth.uid() = author_id OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Users can delete their own posts"
ON posts FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);