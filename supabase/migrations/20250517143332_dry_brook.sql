-- Modify class_leader_info table to remove unnecessary fields
ALTER TABLE class_leader_info
DROP COLUMN IF EXISTS class_name,
DROP COLUMN IF EXISTS appointed_date,
DROP COLUMN IF EXISTS responsibilities;

-- Keep only the badge_color field which is needed for the badge display
-- Ensure the badge_color field exists with proper constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_leader_info' 
    AND column_name = 'badge_color'
  ) THEN
    ALTER TABLE class_leader_info 
    ADD COLUMN badge_color text DEFAULT 'blue' 
    CHECK (badge_color IN ('blue', 'green', 'purple', 'red', 'yellow'));
  END IF;
END $$;

-- Update profiles role check to include class_leader
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended', 'class_leader'));

-- Ensure secondary_role column exists for flexibility
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS secondary_role text
CHECK (secondary_role IN ('class_leader', NULL));

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