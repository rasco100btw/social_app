/*
  # Update group creation policy for class leaders
  
  1. Changes
    - Modify the "Students can create groups" policy to only allow class leaders
    - Update policy name to reflect new permission
    
  2. Security
    - Only class leaders can create new groups
    - Maintains existing permissions for viewing and managing groups
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Students can create groups" ON student_groups;

-- Create new policy that only allows class leaders to create groups
CREATE POLICY "Only class leaders can create groups"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = creator_id) AND 
  (
    -- User has primary role of class_leader
    (
      SELECT role FROM profiles
      WHERE id = auth.uid()
    ) = 'class_leader'
    OR
    -- User has secondary role of class_leader
    (
      SELECT secondary_role FROM profiles
      WHERE id = auth.uid()
    ) = 'class_leader'
  )
);