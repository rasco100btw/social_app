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