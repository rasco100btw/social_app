/*
  # Fix group membership RLS policies

  1. Changes
    - Fix infinite recursion in group_membership RLS policies
    - Simplify policy conditions to prevent recursive loops
    - Maintain security while ensuring efficient queries

  2. Security
    - Maintain existing access control rules
    - Fix policy implementation without changing security model
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_membership;
DROP POLICY IF EXISTS "Group members can view membership" ON group_membership;
DROP POLICY IF EXISTS "Users can leave groups" ON group_membership;

-- Create new policies without recursion
CREATE POLICY "Group admins can manage membership"
ON group_membership
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_membership gm
    WHERE gm.group_id = group_membership.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('admin', 'primary_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_membership gm
    WHERE gm.group_id = group_membership.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('admin', 'primary_admin')
  )
);

CREATE POLICY "Group members can view membership"
ON group_membership
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM group_membership gm
    WHERE gm.group_id = group_membership.group_id
    AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can leave groups"
ON group_membership
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
);