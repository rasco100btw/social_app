/*
  # Add insert policy for profiles table

  1. Changes
    - Add policy to allow authenticated users to insert their own profile
*/

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);