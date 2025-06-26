/*
  # Fix Class Leader Badge Display
  
  1. Changes
    - Add secondary_role column to profiles if it doesn't exist
    - Update profiles role check to include class_leader
    - Ensure class_leader_info table exists with proper constraints
    - Create policies for class leader info access
    - Add trigger for class leader badge display
  
  2. Security
    - Enable RLS on class_leader_info table
    - Only admins and teachers can manage class leaders
    - Class leaders can view their own info
*/

-- Add secondary_role column to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'secondary_role'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN secondary_role text 
    CHECK (secondary_role IN ('class_leader', NULL));
  END IF;
END $$;

-- Update profiles role check to include class_leader
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended', 'class_leader'));

-- Ensure class_leader_info table exists with proper constraints
CREATE TABLE IF NOT EXISTS class_leader_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_color text DEFAULT 'blue' CHECK (badge_color IN ('blue', 'green', 'purple', 'red', 'yellow')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE class_leader_info ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Class leaders can view their own info" ON class_leader_info;
DROP POLICY IF EXISTS "Only admins and teachers can manage class leaders" ON class_leader_info;

-- Create policies
CREATE POLICY "Class leaders can view their own info"
  ON class_leader_info
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  );

CREATE POLICY "Only admins and teachers can manage class leaders"
  ON class_leader_info
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_class_leader_info_updated_at ON class_leader_info;
CREATE TRIGGER update_class_leader_info_updated_at
  BEFORE UPDATE ON class_leader_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();