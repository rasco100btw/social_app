/*
  # Add suspension system
  
  1. Changes
    - Drop existing policies to avoid conflicts
    - Create suspension_logs table
    - Add suspension handling function and trigger
    - Update profiles role check
    - Update message policies
*/

-- Drop existing policies first
DROP POLICY IF EXISTS "Only admin can access suspension logs" ON suspension_logs;

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

-- Enable RLS
ALTER TABLE suspension_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
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

-- Create trigger for user suspension
DROP TRIGGER IF EXISTS handle_user_suspension_trigger ON profiles;
CREATE TRIGGER handle_user_suspension_trigger
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_suspension();

-- Update profiles role check to include suspended role
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended'));

-- Drop existing message policies
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own sent messages" ON messages;

-- Recreate message policies with suspension check
CREATE POLICY "Users can read their own messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    ((auth.uid() = sender_id) OR (auth.uid() = receiver_id))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'suspended'
  );

CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'suspended'
  );

CREATE POLICY "Users can update their own sent messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = sender_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'suspended'
  );