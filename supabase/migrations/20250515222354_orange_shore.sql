-- Add INSERT policy for profiles table
CREATE POLICY "Users can insert their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Ensure all required policies exist
DO $$ 
BEGIN
    -- Check and recreate SELECT policy if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can read all profiles'
    ) THEN
        CREATE POLICY "Users can read all profiles"
        ON profiles
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    -- Check and recreate UPDATE policy if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile"
        ON profiles
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;