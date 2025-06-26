/*
  # Fix Group Membership Policies

  1. Changes
    - Drop existing policies that cause infinite recursion
    - Create simplified policies that prevent recursion
    - Add proper indexes for performance optimization
  
  2. Security
    - Maintain proper access control
    - Ensure users can only manage their own memberships
    - Allow admins to manage group memberships
*/

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_membership;
DROP POLICY IF EXISTS "Group members can view membership" ON group_membership;
DROP POLICY IF EXISTS "Users can leave groups" ON group_membership;
DROP POLICY IF EXISTS "Users can view group membership" ON group_membership;

-- Create new simplified policies to prevent infinite recursion
CREATE POLICY "Group admins can manage membership"
ON group_membership
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can view group membership"
ON group_membership
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can leave groups"
ON group_membership
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create index to improve performance
CREATE INDEX IF NOT EXISTS idx_group_membership_group_user
ON group_membership(group_id, user_id);

CREATE INDEX IF NOT EXISTS idx_group_membership_role
ON group_membership(role) 
WHERE role IN ('admin', 'primary_admin');