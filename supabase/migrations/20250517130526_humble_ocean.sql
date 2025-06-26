-- Fix the infinite recursion issue in group_membership policies

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_membership;
DROP POLICY IF EXISTS "Group members can view membership" ON group_membership;
DROP POLICY IF EXISTS "Users can leave groups" ON group_membership;

-- Create new policies with optimized logic to prevent infinite recursion
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
  -- User can view their own membership
  auth.uid() = user_id
  OR
  -- User can view membership of groups they belong to or public groups
  EXISTS (
    SELECT 1 
    FROM student_groups sg
    WHERE sg.id = group_membership.group_id
    AND (
      sg.visibility = 'public'
      OR
      EXISTS (
        SELECT 1 
        FROM group_membership gm
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

-- Create index to improve performance
CREATE INDEX IF NOT EXISTS idx_group_membership_group_user
ON group_membership(group_id, user_id);

CREATE INDEX IF NOT EXISTS idx_group_membership_role
ON group_membership(role) 
WHERE role IN ('admin', 'primary_admin');