/*
  # Add Suspended Role and Account Management

  1. Schema Changes
    - Add 'suspended' to valid profile roles
    - Update policies to prevent suspended users from accessing data
    - Add trigger for handling user suspension

  2. Security
    - Suspended users cannot access messages
    - Suspended users cannot send messages
    - Suspended users cannot update messages
*/

-- Add suspended role to profiles role check
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended'));

-- Update auth policies to prevent suspended users from accessing data
ALTER POLICY "Users can read their own messages" ON messages
USING (
  ((auth.uid() = sender_id) OR (auth.uid() = receiver_id))
  AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'suspended'
);

ALTER POLICY "Users can send messages" ON messages
WITH CHECK (
  auth.uid() = sender_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'suspended'
);

ALTER POLICY "Users can update their own sent messages" ON messages
USING (
  auth.uid() = sender_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'suspended'
);

-- Add function to handle user suspension
CREATE OR REPLACE FUNCTION handle_user_suspension()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being suspended
  IF NEW.role = 'suspended' AND OLD.role != 'suspended' THEN
    -- Delete all active sessions for the suspended user
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
    
    -- Update user metadata to include suspended status
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{suspended}',
      'true'::jsonb
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user suspension
DROP TRIGGER IF EXISTS handle_user_suspension_trigger ON profiles;
CREATE TRIGGER handle_user_suspension_trigger
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'suspended' AND OLD.role != 'suspended')
  EXECUTE FUNCTION handle_user_suspension();