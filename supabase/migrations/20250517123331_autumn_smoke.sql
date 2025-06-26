/*
  # Fix Report Notifications System

  1. Changes
    - Remove notification functionality from report handling
    - Ensure reports are still properly stored and accessible to admins
    - Add performance improvements for report queries
    - Clean up existing report notifications

  2. Security
    - No changes to existing RLS policies
    - Maintains admin-only access to reports section
*/

-- Drop existing function and trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_new_report ON incident_reports;
DROP FUNCTION IF EXISTS handle_new_report();

-- Create a new function that doesn't send notifications
CREATE OR REPLACE FUNCTION handle_new_report()
RETURNS TRIGGER AS $$
BEGIN
  -- This function intentionally does not create notifications
  -- Reports will still be visible in the Reports section for admins
  -- but no notifications will be sent
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new reports
CREATE TRIGGER on_new_report
  AFTER INSERT ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_report();

-- Remove any existing report notifications
DELETE FROM notifications 
WHERE type = 'report';

-- Create index to improve report queries
CREATE INDEX IF NOT EXISTS idx_incident_reports_status
  ON incident_reports(status);

CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at
  ON incident_reports(created_at DESC);

-- Add index for reporter_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter_id
  ON incident_reports(reporter_id);

-- Add index for incident_type to improve filtering
CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_type
  ON incident_reports(incident_type);