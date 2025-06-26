/*
  # Create messages storage bucket

  1. Storage
    - Creates a new 'messages' bucket for storing message attachments
    - Sets up security policies for file access and management

  2. Security
    - Allows authenticated users to upload files
    - Enables public access for viewing files
    - Permits users to delete their own files
*/

-- Create the messages bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', true);

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'messages');

-- Create policy to allow public access to view files
CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'messages');

-- Create policy to allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'messages' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);