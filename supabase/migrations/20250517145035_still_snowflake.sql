-- Drop existing policy
DROP POLICY IF EXISTS "Only admins, teachers, and class leaders can create groups" ON student_groups;

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

-- Ensure admins can still delete groups
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