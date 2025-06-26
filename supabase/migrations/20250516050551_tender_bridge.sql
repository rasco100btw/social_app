/*
  # Fix Events RLS Policies

  1. Changes
    - Drop existing RLS policies for events table
    - Create new policies that properly handle:
      - Event creation by teachers
      - Event viewing by all authenticated users
      - Event management by teachers (for their own events)

  2. Security
    - Enable RLS on events table
    - Add policies for:
      - SELECT: All authenticated users can view events
      - INSERT: Only teachers can create events
      - UPDATE/DELETE: Teachers can only manage their own events
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Teachers can manage their own events" ON events;

-- Create new policies
CREATE POLICY "Everyone can view events"
ON events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teachers can create events"
ON events
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
  AND teacher_id = auth.uid()
);

CREATE POLICY "Teachers can manage their own events"
ON events
FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
  AND teacher_id = auth.uid()
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
  AND teacher_id = auth.uid()
);