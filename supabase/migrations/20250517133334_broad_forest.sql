/*
  # Add Class Leader Role
  
  1. Changes
    - Update profiles role check to include 'class_leader'
    - Add class_leader_info table to store additional information
    - Create RLS policies for the new table
    
  2. Security
    - Only admins can assign class leader role
    - Class leaders can view and update their own info
*/

-- Update profiles role check to include class_leader
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended', 'class_leader'));

-- Create class_leader_info table
CREATE TABLE IF NOT EXISTS class_leader_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_name text NOT NULL,
  appointed_date timestamptz DEFAULT now() NOT NULL,
  responsibilities text,
  badge_color text DEFAULT 'blue' CHECK (badge_color IN ('blue', 'green', 'purple', 'red', 'yellow')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE class_leader_info ENABLE ROW LEVEL SECURITY;

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
CREATE TRIGGER update_class_leader_info_updated_at
  BEFORE UPDATE ON class_leader_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle class leader role assignment
CREATE OR REPLACE FUNCTION handle_class_leader_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being made a class leader
  IF NEW.role = 'class_leader' AND OLD.role != 'class_leader' THEN
    -- Create notification for the user
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    ) VALUES (
      NEW.id,
      'role_change',
      'You are now a Class Leader',
      'You have been appointed as a class leader. Check your profile for details.',
      '/profile'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for class leader assignment
CREATE TRIGGER on_class_leader_assignment
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'class_leader' AND OLD.role != 'class_leader')
  EXECUTE FUNCTION handle_class_leader_assignment();