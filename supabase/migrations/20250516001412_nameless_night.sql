-- Add hobbies array to profiles if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'hobbies'
    ) THEN
        ALTER TABLE profiles ADD COLUMN hobbies text[] DEFAULT '{}'::text[];
    END IF;
END $$;