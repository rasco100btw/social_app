/*
  # Add support for dual roles (student and class_leader)
  
  1. Changes
    - Modify the profiles table to add a secondary_role column
    - Update the handle_class_leader_assignment function to work with dual roles
    - Add a trigger on profiles table for class leader assignment
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper role management
*/

-- Add secondary_role column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS secondary_role text 
CHECK (secondary_role IN ('class_leader', NULL));

-- Create function to handle class leader role assignment from profiles
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
  
  -- If secondary_role is being set to class_leader
  IF NEW.secondary_role = 'class_leader' AND (OLD.secondary_role IS NULL OR OLD.secondary_role != 'class_leader') THEN
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
      'You have been appointed as a class leader while maintaining your student role. Check your profile for details.',
      '/profile'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for class leader assignment on profiles
DROP TRIGGER IF EXISTS on_class_leader_assignment ON profiles;
CREATE TRIGGER on_class_leader_assignment
  AFTER UPDATE OF role, secondary_role ON profiles
  FOR EACH ROW
  WHEN (
    (NEW.role = 'class_leader' AND OLD.role != 'class_leader') OR
    (NEW.secondary_role = 'class_leader' AND (OLD.secondary_role IS NULL OR OLD.secondary_role != 'class_leader'))
  )
  EXECUTE FUNCTION handle_class_leader_assignment();

-- Update existing class leaders to have proper dual roles if needed
UPDATE profiles
SET secondary_role = 'class_leader', role = 'student'
WHERE role = 'class_leader'
AND id IN (
  SELECT user_id FROM class_leader_info
);