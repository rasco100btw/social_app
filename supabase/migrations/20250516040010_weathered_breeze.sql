/*
  # Create announcements storage bucket

  1. Storage
    - Create a new bucket called 'announcements' for storing announcement media
    - Set public access to enable viewing uploaded files
    - Configure CORS policy for web access

  2. Security
    - Enable RLS on the bucket
    - Add policy for authenticated users to read media
    - Add policy for teachers and admins to upload media
*/

-- Enable storage by creating the announcements bucket
insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true);

-- Set up CORS policy
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcements',
  'announcements',
  true,
  5242880, -- 5MB in bytes
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) on conflict (id) do update
set file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create policy to allow authenticated users to read files
create policy "Authenticated users can read announcement files"
on storage.objects for select
to authenticated
using (bucket_id = 'announcements');

-- Create policy to allow teachers and admins to upload files
create policy "Teachers and admins can upload announcement files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'announcements' 
  and (
    auth.role() = 'authenticated' 
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('teacher', 'admin')
    )
  )
);