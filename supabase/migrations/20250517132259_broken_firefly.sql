/*
  # Fix Group RLS Policies
  
  1. Changes
    - Fix uid() function calls to use auth.uid()
    - Recreate policies with proper permissions
    - Maintain existing security rules
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Students can create groups" ON student_groups;
DROP POLICY IF EXISTS "Anyone can view public groups" ON student_groups;
DROP POLICY IF EXISTS "Group admins can update their groups" ON student_groups;
DROP POLICY IF EXISTS "Primary admins can delete their groups" ON student_groups;

-- Create new policies with proper permissions
CREATE POLICY "Students can create groups"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = creator_id) AND 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role = 'student'
  )
);

CREATE POLICY "Anyone can view public groups"
ON student_groups
FOR SELECT
TO authenticated
USING (
  visibility = 'public' OR
  EXISTS (
    SELECT 1 FROM group_membership
    WHERE group_membership.group_id = student_groups.id
    AND group_membership.user_id = auth.uid()
  )
);

CREATE POLICY "Group admins can update their groups"
ON student_groups
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_membership
    WHERE group_membership.group_id = student_groups.id
    AND group_membership.user_id = auth.uid()
    AND group_membership.role IN ('admin', 'primary_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_membership
    WHERE group_membership.group_id = student_groups.id
    AND group_membership.user_id = auth.uid()
    AND group_membership.role IN ('admin', 'primary_admin')
  )
);

CREATE POLICY "Primary admins can delete their groups"
ON student_groups
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_membership
    WHERE group_membership.group_id = student_groups.id
    AND group_membership.user_id = auth.uid()
    AND group_membership.role = 'primary_admin'
  )
);