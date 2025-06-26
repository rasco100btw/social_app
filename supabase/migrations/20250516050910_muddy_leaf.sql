/*
  # Update calendar event policies
  
  1. Changes
    - Modify policies to restrict event management to admins only
    - Teachers can only create events
    - Everyone can view events
    
  2. Security
    - Only admins can edit/delete any event
    - Teachers can only create new events
    - All authenticated users can view events
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Teachers can create and manage events" ON events;
DROP POLICY IF EXISTS "Admins can manage all events" ON events;

-- Create new policies
CREATE POLICY "Everyone can view events"
ON events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teachers can create events"
ON events FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = teacher_id 
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'teacher'
  )
);

CREATE POLICY "Admins can manage all events"
ON events FOR ALL
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