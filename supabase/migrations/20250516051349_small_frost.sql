-- Create event_attendees table if it doesn't exist
CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(event_id, student_id)
);

-- Enable RLS
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Create policies for event_attendees
CREATE POLICY "Students can apply for events"
ON event_attendees
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'student'
  )
);

CREATE POLICY "Students can view their own applications"
ON event_attendees
FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM events
    WHERE id = event_attendees.event_id
    AND teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Teachers can manage applications for their events"
ON event_attendees
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_attendees.event_id
    AND teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_attendees.event_id
    AND teacher_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all applications"
ON event_attendees
FOR ALL
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