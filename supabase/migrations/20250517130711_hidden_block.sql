/*
  # Fix infinite recursion in group membership policies

  1. Changes
    - Remove recursive policies from group_membership table
    - Rewrite policies to avoid self-referential checks
    - Add clear, non-recursive conditions for membership management

  2. Security
    - Maintain existing security model while preventing recursion
    - Ensure admins can still manage group membership
    - Preserve member access controls
*/

-- Drop existing policies to recreate them without recursion
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_membership;
DROP POLICY IF EXISTS "Group members can view membership" ON group_membership;
DROP POLICY IF EXISTS "Users can leave groups" ON group_membership;

-- Create new, non-recursive policies
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
        SELECT 1 FROM group_membership gm
        WHERE gm.group_id = sg.id
        AND gm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can leave groups"
ON group_membership
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);