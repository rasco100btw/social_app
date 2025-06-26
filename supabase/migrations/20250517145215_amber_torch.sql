/*
  # Update group creation policy
  
  1. Changes
    - Modify policy to only allow class leaders to create groups
    - Add policy for admins to delete any group
    - Remove ability for students to create groups
  
  2. Security
    - Only class leaders can create groups
    - Admins can delete any group regardless of who created it
    - Maintains existing policies for viewing and updating groups
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Only class leaders can create groups" ON student_groups;
DROP POLICY IF EXISTS "Admins can delete any group" ON student_groups;

-- Create new policy that allows only class leaders to create groups
CREATE POLICY "Only class leaders can create groups"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = creator_id) AND 
  (
    -- User has role of class_leader
    (
      SELECT role FROM profiles
      WHERE id = auth.uid()
    ) = 'class_leader'
  )
);

-- Ensure admins can delete any group
CREATE POLICY "Admins can delete any group"
ON student_groups
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);