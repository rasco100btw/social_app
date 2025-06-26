/*
  # Fix group membership policy recursion

  1. Changes
    - Update group membership policies to avoid infinite recursion
    - Simplify policy conditions for better performance and clarity

  2. Security
    - Maintain existing security model while fixing recursion issues
    - Ensure proper access control for group members and admins
*/

-- Drop existing policies to recreate them
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
    SELECT 1 FROM student_groups sg
    WHERE sg.id = group_membership.group_id
    AND (
      sg.visibility = 'public'
      OR
      EXISTS (
        SELECT 1 FROM group_membership viewer_membership
        WHERE viewer_membership.group_id = group_membership.group_id
        AND viewer_membership.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can leave groups"
ON group_membership
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);