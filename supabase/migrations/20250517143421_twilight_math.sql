/*
  # Add class_name column to class_leader_info table

  1. Changes
    - Add class_name column to class_leader_info table
    - Make class_name required
    - Add it after user_id column for better organization
*/

ALTER TABLE class_leader_info 
ADD COLUMN class_name text NOT NULL;