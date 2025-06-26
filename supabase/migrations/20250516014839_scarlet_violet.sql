/*
  # Add teacher role and event management
  
  1. Changes
    - Add role field to profiles table
    - Create events and event_attendees tables
    - Add policies for teacher event management
    - Add policies for student attendance
  
  2. Security
    - Enable RLS on new tables
    - Add role-based policies for events and attendance
*/

-- Add role field to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher'));
  END IF;
END $$;

-- Create events table if it doesn't exist
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
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Events policies
  DROP POLICY IF EXISTS "Teachers can manage their own events" ON events;
  DROP POLICY IF EXISTS "Everyone can view events" ON events;
  
  -- Event attendees policies
  DROP POLICY IF EXISTS "Students can manage their own attendance" ON event_attendees;
  DROP POLICY IF EXISTS "Teachers can view their event attendees" ON event_attendees;
END $$;

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

-- Add updated_at trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_events_updated_at'
  ) THEN
    CREATE TRIGGER update_events_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;