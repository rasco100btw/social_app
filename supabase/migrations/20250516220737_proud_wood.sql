/*
  # Make specific user admin
  
  1. Changes
    - Update user role to admin for specified email
    - Ensure user exists before updating
*/

DO $$ 
BEGIN
  -- Update the user's role to admin
  UPDATE profiles
  SET role = 'admin'
  WHERE id IN (
    SELECT id 
    FROM auth.users 
    WHERE email = 'rascodam@gmail.com'
  );

  -- Log the change in case we need to audit later
  INSERT INTO suspension_logs (
    user_id,
    admin_id,
    reason,
    suspended_at,
    unsuspended_at
  )
  SELECT 
    id as user_id,
    id as admin_id,
    'Elevated to admin role',
    now(),
    now()
  FROM auth.users 
  WHERE email = 'rascodam@gmail.com';
END $$;