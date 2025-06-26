-- Upload the logo to Supabase storage
DO $$ 
BEGIN
  -- Create the logos bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('logos', 'logos', true)
  ON CONFLICT (id) DO NOTHING;

  -- Set up CORS policy
  UPDATE storage.buckets
  SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/svg+xml']
  WHERE id = 'logos';

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Logos are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Only admins can manage logos" ON storage.objects;

  -- Create policy to allow public access to view logos
  CREATE POLICY "Logos are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

  -- Create policy to allow only admins to manage logos
  CREATE POLICY "Only admins can manage logos"
  ON storage.objects FOR ALL 
  TO authenticated
  USING (
    bucket_id = 'logos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'logos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
END $$;