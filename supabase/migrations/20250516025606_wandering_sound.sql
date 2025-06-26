/*
  # Account Suspension System

  1. Changes
    - Updates profiles table to support suspended role
    - Creates suspension_logs table for tracking suspensions
    - Adds RLS policies for suspension management
    - Implements suspension handling trigger
    - Updates message policies to prevent suspended users from accessing data

  2. Security
    - Only admins can access suspension logs
    - Only admins can suspend/unsuspend accounts
    - Suspended users cannot access messages
*/

-- Update profiles role check to include suspended role
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended'));

-- Create suspension_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS suspension_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  suspended_at timestamptz DEFAULT now() NOT NULL,
  unsuspended_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on suspension_logs
ALTER TABLE suspension_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Only admin can access suspension logs" ON suspension_logs;

-- Only admin can access suspension logs
CREATE POLICY "Only admin can access suspension logs"
  ON suspension_logs
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Function to handle user suspension
CREATE OR REPLACE FUNCTION handle_user_suspension()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being suspended
  IF NEW.role = 'suspended' AND OLD.role != 'suspended' THEN
    -- Delete all active sessions for the suspended user
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
    
    -- Update user metadata
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{suspended}',
      'true'::jsonb
    )
    WHERE id = NEW.id;
  
  -- If user is being unsuspended
  ELSIF NEW.role != 'suspended' AND OLD.role = 'suspended' THEN
    -- Update suspension log
    UPDATE suspension_logs
    SET unsuspended_at = now()
    WHERE user_id = NEW.id AND unsuspended_at IS NULL;
    
    -- Update user metadata
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data - 'suspended'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_user_suspension_trigger ON profiles;

-- Create trigger for user suspension
CREATE TRIGGER handle_user_suspension_trigger
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_suspension();

-- Update existing policies to prevent suspended users from accessing data
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

-- Add policy to ensure only admin can suspend/unsuspend accounts
DROP POLICY IF EXISTS "Only admin can suspend accounts" ON profiles;
CREATE POLICY "Only admin can suspend accounts"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR (
      id = auth.uid() 
      AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  );