/*
  # Create posts storage bucket

  1. New Storage
    - Creates a new 'posts' bucket for storing post media
    - Enables public access to media files
  
  2. Security
    - Adds policies for user access control
    - Limits file sizes to 5MB
    - Restricts file uploads to authenticated users
*/

-- Create the posts bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

-- Set up security policies for the posts bucket
create policy "Post media is publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'posts' );

create policy "Users can upload post media"
  on storage.objects for insert
  with check (
    bucket_id = 'posts' AND
    auth.uid()::text = split_part(name, '/', 1) AND
    coalesce((metadata->>'size')::int, 0) <= 5242880 -- 5MB max file size
  );

create policy "Users can update their own post media"
  on storage.objects for update
  with check (
    bucket_id = 'posts' AND
    auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users can delete their own post media"
  on storage.objects for delete
  using (
    bucket_id = 'posts' AND
    auth.uid()::text = split_part(name, '/', 1)
  );