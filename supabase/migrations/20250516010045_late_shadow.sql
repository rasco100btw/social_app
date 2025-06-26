/*
  # Add teacher role and calendar functionality
  
  1. Changes
    - Add role field to profiles table
    - Create events table for teacher calendar
    - Create event_attendees table for student participation
    - Add RLS policies for role-based access
  
  2. Security
    - Enable RLS on new tables
    - Add policies to restrict calendar access to teachers
    - Add policies for student event participation
*/

-- Add role field to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
CHECK (role IN ('student', 'teacher'));

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  teacher_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  max_attendees integer,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create event_attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(event_id, student_id)
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Events policies
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

CREATE POLICY "Everyone can view events"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

-- Event attendees policies
CREATE POLICY "Students can manage their own attendance"
  ON event_attendees
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
    AND student_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
    AND student_id = auth.uid()
  );

CREATE POLICY "Teachers can view their event attendees"
  ON event_attendees
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
    AND (
      SELECT teacher_id 
      FROM events 
      WHERE id = event_attendees.event_id
    ) = auth.uid()
  );

-- Add updated_at triggers
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();