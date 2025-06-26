/*
  # Update calendar event policies

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new policies that:
      - Allow everyone to view events
      - Allow teachers and admins to create events
      - Restrict event editing to admins only
      - Restrict event deletion to admins only

  2. Security
    - Maintain read access for all authenticated users
    - Allow teachers and admins to create new events
    - Restrict modification and deletion to admins only
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Teachers and admins can create events" ON events;
DROP POLICY IF EXISTS "Only admins can edit events" ON events;
DROP POLICY IF EXISTS "Only admins can delete events" ON events;

-- Create new policies
CREATE POLICY "Everyone can view events"
ON events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teachers and admins can create events"
ON events FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = teacher_id 
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);

CREATE POLICY "Only admins can edit events"
ON events FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Only admins can delete events"
ON events FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);