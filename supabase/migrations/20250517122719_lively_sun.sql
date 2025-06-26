/*
  # Fix Report Notifications System

  1. Changes
    - Drop and recreate the handle_new_report function
    - Ensure notifications are properly sent to all admin users
    - Add debugging information to notifications
    - Fix the trigger to properly execute after insert

  2. Security
    - Maintain existing RLS policies
    - Use SECURITY DEFINER to ensure function runs with proper permissions
*/

-- Drop existing function and trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_new_report ON incident_reports;
DROP FUNCTION IF EXISTS handle_new_report();

-- Create improved function to handle new report notifications
CREATE OR REPLACE FUNCTION handle_new_report()
RETURNS TRIGGER AS $$
DECLARE
  admin_id uuid;
  admin_count integer := 0;
BEGIN
  -- Create notifications for all admins
  FOR admin_id IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  ) LOOP
    admin_count := admin_count + 1;
    
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    ) VALUES (
      admin_id,
      'report',
      'New Incident Report: ' || NEW.report_id,
      'A new incident report has been submitted by ' || NEW.reporter_name || ' regarding ' || NEW.incident_type || ' in ' || NEW.location,
      '/reports'
    );
  END LOOP;

  -- If no admins were found, log this information
  IF admin_count = 0 THEN
    RAISE NOTICE 'No admin users found to notify about report %', NEW.report_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new reports
CREATE TRIGGER on_new_report
  AFTER INSERT ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_report();

-- Create a function to manually send notifications to admins for existing reports
CREATE OR REPLACE FUNCTION resend_report_notifications()
RETURNS void AS $$
DECLARE
  report_record RECORD;
  admin_id uuid;
BEGIN
  FOR report_record IN (
    SELECT * FROM incident_reports
    WHERE created_at > (NOW() - INTERVAL '7 days')
  ) LOOP
    FOR admin_id IN (
      SELECT id FROM profiles 
      WHERE role = 'admin'
    ) LOOP
      -- Check if notification already exists
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = admin_id
        AND type = 'report'
        AND content LIKE '%' || report_record.report_id || '%'
      ) THEN
        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          content,
          link
        ) VALUES (
          admin_id,
          'report',
          'New Incident Report: ' || report_record.report_id,
          'A new incident report has been submitted by ' || report_record.reporter_name || ' regarding ' || report_record.incident_type || ' in ' || report_record.location,
          '/reports'
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to resend notifications for recent reports
SELECT resend_report_notifications();