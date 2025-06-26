-- Drop existing policies first
DROP POLICY IF EXISTS "Users can create reports" ON incident_reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON incident_reports;
DROP POLICY IF EXISTS "Only admins can update reports" ON incident_reports;

-- Create incident_reports table
CREATE TABLE IF NOT EXISTS incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL,
  reporter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reporter_name text NOT NULL,
  reporter_role text NOT NULL CHECK (reporter_role IN ('student', 'teacher')),
  reporter_class text NOT NULL,
  reporter_contact text NOT NULL,
  student_name text NOT NULL,
  student_class text NOT NULL,
  student_id text,
  incident_date text NOT NULL,
  incident_time text NOT NULL,
  location text NOT NULL,
  incident_type text NOT NULL CHECK (incident_type IN ('bullying', 'academic_dishonesty', 'behavioral_issue', 'property_damage', 'other')),
  description text NOT NULL,
  witnesses text,
  previous_incidents boolean DEFAULT false,
  immediate_actions text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved')),
  media_urls text[],
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create reports"
  ON incident_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON incident_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reporter_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update reports"
  ON incident_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create storage bucket for report evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload report evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own report evidence" ON storage.objects;

-- Set up storage policies
CREATE POLICY "Users can upload report evidence"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own report evidence"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_incident_reports_updated_at ON incident_reports;
CREATE TRIGGER update_incident_reports_updated_at
  BEFORE UPDATE ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new report notifications
CREATE OR REPLACE FUNCTION handle_new_report()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify admins
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    link
  )
  SELECT
    profiles.id,
    'report',
    'New Incident Report',
    'A new incident report has been submitted: ' || NEW.report_id,
    '/reports'
  FROM profiles
  WHERE profiles.role = 'admin';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_new_report ON incident_reports;

-- Create trigger for new reports
CREATE TRIGGER on_new_report
  AFTER INSERT ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_report();