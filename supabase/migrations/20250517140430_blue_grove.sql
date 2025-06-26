/*
  # Fix Class Leader Creation Policy

  1. Changes
    - Drop existing policies with a unique policy name
    - Create new policy for class leaders to create groups
    - Add function for class leader notifications
    - Add trigger for class leader role changes
*/

-- Drop all potentially conflicting policies first
DROP POLICY IF EXISTS "Students can create groups" ON student_groups;
DROP POLICY IF EXISTS "Only class leaders can create groups" ON student_groups;
DROP POLICY IF EXISTS "Class leaders can create groups" ON student_groups;
DROP POLICY IF EXISTS "Only class leaders can create student groups" ON student_groups;

-- Create new policy with a unique name
CREATE POLICY "Class leaders can create student groups v2"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = creator_id) AND 
  (
    -- User has role of class_leader
    (
      SELECT role FROM profiles
      WHERE id = auth.uid()
    ) = 'class_leader'
  )
);

-- Create function to handle class leader notifications
CREATE OR REPLACE FUNCTION handle_class_leader_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being made a class leader
  IF (NEW.role = 'class_leader' AND OLD.role != 'class_leader') THEN
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

-- Create trigger for class leader role changes
DROP TRIGGER IF EXISTS on_class_leader_role_change ON profiles;
CREATE TRIGGER on_class_leader_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'class_leader' AND OLD.role != 'class_leader')
  EXECUTE FUNCTION handle_class_leader_notification();