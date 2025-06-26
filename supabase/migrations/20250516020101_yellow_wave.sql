/*
  # Role Management System

  1. Changes
    - Creates function to sync roles between profiles and auth.users
    - Adds trigger for role synchronization
    - Implements policy for role management
    - Updates existing role data

  2. Security
    - Only admins can change user roles
    - Users can update their own profiles without changing roles
    - Roles are permanently stored in auth.users metadata
*/

-- Create function to sync roles
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users metadata to include role
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(NEW.role)
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync roles
DROP TRIGGER IF EXISTS sync_user_role_trigger ON profiles;
CREATE TRIGGER sync_user_role_trigger
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role();

-- Add policy to ensure only admin can change roles
DROP POLICY IF EXISTS "Only admin can change roles" ON profiles;
CREATE POLICY "Only admin can change roles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if user is admin OR if user is updating their own profile without changing role
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    (profiles.id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = profiles.id))
  )
  WITH CHECK (
    -- Same conditions for the check policy
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    (profiles.id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = profiles.id))
  );

-- Ensure roles are properly set in existing records
UPDATE profiles
SET role = COALESCE(
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = profiles.id),
  role
)
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data->>'role' IS NOT NULL
);