/*
  # Update group creation policy
  
  1. Changes
    - Drop existing policy that only allows class leaders to create groups
    - Create new policy that allows admins, teachers, and class leaders to create groups
    
  2. Security
    - Maintains RLS on student_groups table
    - Ensures only authorized roles can create groups
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Class leaders can create student groups v2" ON student_groups;

-- Create new policy that allows admins, teachers, and class leaders to create groups
CREATE POLICY "Only admins, teachers, and class leaders can create groups"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = creator_id) AND 
  (
    -- User has role of admin, teacher, or class_leader
    (
      SELECT role FROM profiles
      WHERE id = auth.uid()
    ) IN ('admin', 'teacher', 'class_leader')
  )
);