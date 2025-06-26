-- Add delete policy for posts
CREATE POLICY "Users can delete their own posts"
ON posts
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- Ensure all required policies exist
DO $$ 
BEGIN
    -- Check and recreate SELECT policy if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'posts' 
        AND policyname = 'Posts are readable by everyone'
    ) THEN
        CREATE POLICY "Posts are readable by everyone"
        ON posts
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    -- Check and recreate INSERT policy if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'posts' 
        AND policyname = 'Users can create posts'
    ) THEN
        CREATE POLICY "Users can create posts"
        ON posts
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = author_id);
    END IF;

    -- Check and recreate UPDATE policy if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'posts' 
        AND policyname = 'Users can update their own posts'
    ) THEN
        CREATE POLICY "Users can update their own posts"
        ON posts
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = author_id)
        WITH CHECK (auth.uid() = author_id);
    END IF;
END $$;