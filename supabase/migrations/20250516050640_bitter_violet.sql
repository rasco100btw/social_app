/*
  # Fix Events Table RLS Policies

  1. Changes
    - Drop existing RLS policies for events table
    - Create new, more specific RLS policies:
      - Everyone can view events
      - Teachers can create and manage their own events
      - Admins can manage all events

  2. Security
    - Maintains RLS enabled on events table
    - Ensures proper role-based access control
    - Preserves data integrity with proper foreign key constraints
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Teachers can create events" ON events;
DROP POLICY IF EXISTS "Teachers can manage their own events" ON events;

-- Create new policies
CREATE POLICY "Everyone can view events"
ON events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teachers can create and manage events"
ON events FOR ALL
TO authenticated
USING (
  (auth.uid() = teacher_id AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'teacher'
  ))
)
WITH CHECK (
  (auth.uid() = teacher_id AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'teacher'
  ))
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