/*
  # Create student connections table and fix privacy settings

  1. New Tables
    - `student_connections`
      - `id` (uuid, primary key)
      - `requester_id` (uuid, references profiles)
      - `recipient_id` (uuid, references profiles)
      - `status` (text: pending, accepted, rejected)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `student_connections` table
    - Add policies for connection management
    - Fix RLS policies for user_privacy_settings

  3. Changes
    - Add unique constraint on requester_id and recipient_id
    - Add check constraint for valid status values
*/

-- Create student connections table
CREATE TABLE IF NOT EXISTS student_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, recipient_id)
);

-- Enable RLS
ALTER TABLE student_connections ENABLE ROW LEVEL SECURITY;

-- Policies for student_connections
CREATE POLICY "Users can create connection requests"
  ON student_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view their own connections"
  ON student_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (requester_id, recipient_id));

CREATE POLICY "Users can update their received connection requests"
  ON student_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Fix user_privacy_settings policies
DROP POLICY IF EXISTS "Users can manage their own privacy settings" ON user_privacy_settings;
DROP POLICY IF EXISTS "Users can view their own privacy settings" ON user_privacy_settings;

CREATE POLICY "Users can manage their own privacy settings"
  ON user_privacy_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT recipient_id FROM student_connections 
    WHERE requester_id = user_id AND status = 'accepted'
    UNION
    SELECT requester_id FROM student_connections 
    WHERE recipient_id = user_id AND status = 'accepted'
  ))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public privacy settings"
  ON user_privacy_settings
  FOR SELECT
  TO authenticated
  USING (true);