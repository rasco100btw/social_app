/*
  # Create Privacy and Activities Tables

  1. New Tables
    - user_privacy_settings
      - Stores user privacy preferences
      - Controls visibility of profile sections
    - student_activities
      - Tracks student activities and achievements
      - Links to profile

  2. Security
    - Enable RLS on both tables
    - Add policies for data access control
    - Users can manage their own data
*/

-- Create user_privacy_settings table
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_visibility text DEFAULT 'public' CHECK (profile_visibility IN ('public', 'connections', 'private')),
  contact_info_visibility text DEFAULT 'public' CHECK (contact_info_visibility IN ('public', 'connections', 'private')),
  academic_info_visibility text DEFAULT 'public' CHECK (academic_info_visibility IN ('public', 'connections', 'private')),
  activities_visibility text DEFAULT 'public' CHECK (activities_visibility IN ('public', 'connections', 'private')),
  allow_messages boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create student_activities table
CREATE TABLE IF NOT EXISTS student_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_activities ENABLE ROW LEVEL SECURITY;

-- Policies for user_privacy_settings
CREATE POLICY "Users can view their own privacy settings"
  ON user_privacy_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own privacy settings"
  ON user_privacy_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for student_activities
CREATE POLICY "Users can view public activities"
  ON student_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_privacy_settings
      WHERE user_id = student_activities.student_id
      AND (activities_visibility = 'public' OR auth.uid() = student_activities.student_id)
    )
  );

CREATE POLICY "Users can manage their own activities"
  ON student_activities
  FOR ALL
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_privacy_settings_updated_at
  BEFORE UPDATE ON user_privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_activities_updated_at
  BEFORE UPDATE ON student_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();