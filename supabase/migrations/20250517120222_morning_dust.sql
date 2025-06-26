/*
  # Fix Admin Report Notifications
  
  1. Changes
    - Drop and recreate handle_new_report function with improved notification handling
    - Add missing notification policies
    - Ensure notifications are properly delivered to admins
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_new_report ON incident_reports;
DROP FUNCTION IF EXISTS handle_new_report();

-- Create improved function to handle new report notifications
CREATE OR REPLACE FUNCTION handle_new_report()
RETURNS TRIGGER AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- Create notifications for all admins
  FOR admin_id IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  ) LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link,
      read
    ) VALUES (
      admin_id,
      'report',
      'New Incident Report',
      'A new incident report has been submitted by ' || NEW.reporter_name || ' regarding ' || NEW.incident_type,
      '/reports',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new reports
CREATE TRIGGER on_new_report
  AFTER INSERT ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_report();

-- Ensure notifications table has proper policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      type = 'report' AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add index to improve notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_type_user
  ON notifications(type, user_id);

-- Add index for admin role checks
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles(role)
  WHERE role = 'admin';