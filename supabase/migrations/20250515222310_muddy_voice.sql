/*
  # Update profiles table RLS policies

  1. Changes
    - Update the RLS policies for the profiles table
    - Add comprehensive UPDATE policy to allow users to modify their own profiles
    - Ensure users can only update their own profile data
  
  2. Security
    - Maintain existing SELECT policy for authenticated users
    - Add UPDATE policy with proper auth.uid() check
    - Ensure data integrity by limiting updates to profile owners
*/

-- First ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Recreate the policies with proper permissions
CREATE POLICY "Users can read all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);