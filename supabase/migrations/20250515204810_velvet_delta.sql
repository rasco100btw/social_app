/*
  # Set up media storage buckets and policies

  1. New Buckets
    - `images` for image storage
    - `videos` for video storage
  
  2. Security
    - Enable public access for viewing
    - Restrict uploads to authenticated users
    - Enforce file size limits
    - Validate file metadata
*/

-- Create the images bucket
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Create the videos bucket
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

-- Set up security policies for images
create policy "Images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'images' );

create policy "Users can upload images"
  on storage.objects for insert
  with check (
    bucket_id = 'images' AND
    auth.uid()::text = split_part(name, '/', 1) AND
    coalesce((metadata->>'size')::int, 0) <= 5242880 AND -- 5MB
    (metadata->>'title') is not null AND
    (metadata->>'description') is not null AND
    (metadata->>'copyright') is not null
  );

-- Set up security policies for videos
create policy "Videos are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'videos' );

create policy "Users can upload videos"
  on storage.objects for insert
  with check (
    bucket_id = 'videos' AND
    auth.uid()::text = split_part(name, '/', 1) AND
    coalesce((metadata->>'size')::int, 0) <= 104857600 AND -- 100MB
    (metadata->>'title') is not null AND
    (metadata->>'description') is not null AND
    (metadata->>'copyright') is not null
  );

-- Common policies for both buckets
create policy "Users can manage their own media"
  on storage.objects for all
  using (
    auth.uid()::text = split_part(name, '/', 1)
  );