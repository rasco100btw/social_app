/*
  # Fix student groups RLS policy

  1. Changes
    - Update RLS policy for student_groups table to allow students to create groups
    - Add policy to ensure creator_id matches the authenticated user
    - Maintain existing policies for viewing and managing groups

  2. Security
    - Students can only create groups where they are the creator
    - Maintains existing security for group management
*/

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Students can create groups" ON student_groups;

-- Create new policy that properly checks user role and creator_id
CREATE POLICY "Students can create groups"
ON student_groups
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be the creator
  auth.uid() = creator_id 
  AND
  -- User must be a student
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'student'
  )
);