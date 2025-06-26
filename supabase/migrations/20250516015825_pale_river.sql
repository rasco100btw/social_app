-- Add admin role to profiles role check
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('student', 'teacher', 'admin'));

-- Set the specified user as admin
UPDATE profiles
SET role = 'admin'
WHERE id = 'cf06a82f-38c8-405f-b2c4-378d034b48c7';