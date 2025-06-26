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

-- Drop and recreate updated_at trigger
DROP TRIGGER IF EXISTS update_class_leader_info_updated_at ON class_leader_info;
CREATE TRIGGER update_class_leader_info_updated_at
  BEFORE UPDATE ON class_leader_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle class leader role assignment
CREATE OR REPLACE FUNCTION handle_class_leader_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the user
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    link
  ) VALUES (
    NEW.user_id,
    'role_change',
    'You are now a Class Leader',
    'You have been appointed as a class leader for ' || NEW.class_name || '. Check your profile for details.',
    '/profile'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for class leader assignment
DROP TRIGGER IF EXISTS on_class_leader_assignment ON class_leader_info;
CREATE TRIGGER on_class_leader_assignment
  AFTER INSERT ON class_leader_info
  FOR EACH ROW
  EXECUTE FUNCTION handle_class_leader_assignment();