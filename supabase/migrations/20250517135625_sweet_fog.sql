/*
  # Update group creation policies for class leaders
  
  1. Changes
    - Drop all existing group creation policies
    - Create new policy for class leaders only
    - Add notification system for class leader assignments
    
  2. Security
    - Only class leaders can create groups
    - Maintain existing RLS for other operations
*/

-- Drop all existing policies for student_groups
DROP POLICY IF EXISTS "Students can create groups" ON student_groups;
DROP POLICY IF EXISTS "Only class leaders can create groups" ON student_groups;
DROP POLICY IF EXISTS "Users can create groups" ON student_groups;

-- Create new policy that only allows class leaders to create groups
CREATE POLICY "Class leaders can create groups"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = creator_id) AND 
  (
    -- User has primary role of class_leader
    (
      SELECT role FROM profiles
      WHERE id = auth.uid()
    ) = 'class_leader'
    OR
    -- User has secondary role of class_leader
    (
      SELECT secondary_role FROM profiles
      WHERE id = auth.uid()
    ) = 'class_leader'
  )
);

-- Create function to handle class leader assignment in profiles
CREATE OR REPLACE FUNCTION handle_class_leader_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being made a class leader
  IF (NEW.role = 'class_leader' AND OLD.role != 'class_leader') OR 
     (NEW.secondary_role = 'class_leader' AND (OLD.secondary_role IS NULL OR OLD.secondary_role != 'class_leader')) THEN
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
      'You have been appointed as a class leader. You can now create and manage student groups.',
      '/groups'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for class leader assignment
DROP TRIGGER IF EXISTS on_class_leader_assignment ON profiles;
CREATE TRIGGER on_class_leader_assignment
  AFTER UPDATE OF role, secondary_role ON profiles
  FOR EACH ROW
  WHEN (
    (NEW.role = 'class_leader' AND OLD.role != 'class_leader') OR
    (NEW.secondary_role = 'class_leader' AND (OLD.secondary_role IS NULL OR OLD.secondary_role != 'class_leader'))
  )
  EXECUTE FUNCTION handle_class_leader_assignment();