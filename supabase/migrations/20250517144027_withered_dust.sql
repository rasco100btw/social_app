/*
  # Fix class leader functionality
  
  1. Changes
    - Drop dependent triggers first to avoid constraint errors
    - Add class_name column to class_leader_info table
    - Remove secondary_role from profiles
    - Update profiles role check
    - Create simplified class leader notification system
*/

-- First drop the dependent triggers
DROP TRIGGER IF EXISTS on_class_leader_role_change ON profiles;
DROP TRIGGER IF EXISTS on_class_leader_profile_update ON profiles;
DROP TRIGGER IF EXISTS on_class_leader_assignment ON profiles;

-- Add class_name column to class_leader_info if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_leader_info' 
    AND column_name = 'class_name'
  ) THEN
    ALTER TABLE class_leader_info 
    ADD COLUMN class_name text NOT NULL DEFAULT 'Default Class';
  END IF;
END $$;

-- Now we can safely remove secondary_role from profiles
ALTER TABLE profiles
DROP COLUMN IF EXISTS secondary_role;

-- Update profiles role check to ensure only one role per user
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin', 'suspended', 'class_leader'));

-- Create simplified function to handle class leader notifications
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
CREATE TRIGGER on_class_leader_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'class_leader' AND OLD.role != 'class_leader')
  EXECUTE FUNCTION handle_class_leader_notification();