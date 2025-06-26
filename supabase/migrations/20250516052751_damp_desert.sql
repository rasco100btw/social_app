/*
  # Add event application notifications

  1. Changes
    - Add trigger for event applications
    - Create notification function for event applications
    - Update event_attendees policies
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Create function to handle event application notifications
CREATE OR REPLACE FUNCTION handle_event_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the student
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    link
  )
  SELECT
    NEW.student_id,
    'event',
    'Event Application Confirmed',
    'You have been automatically registered for ' || events.title,
    '/calendar'
  FROM events
  WHERE events.id = NEW.event_id;

  -- Set status to confirmed automatically
  NEW.status = 'confirmed';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for event applications
CREATE TRIGGER on_event_application
  BEFORE INSERT ON event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION handle_event_application();

-- Update event_attendees policies
DROP POLICY IF EXISTS "Students can apply for events" ON event_attendees;
DROP POLICY IF EXISTS "Students can view their own applications" ON event_attendees;

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