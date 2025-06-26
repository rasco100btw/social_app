/*
  # Create messages storage bucket and policies

  1. Storage
    - Creates a new 'messages' bucket for storing message attachments
  
  2. Security
    - Adds policy for users to upload files to their own folder
    - Adds policy for users to read files from their conversations
*/

-- Create the messages bucket
insert into storage.buckets (id, name)
values ('messages', 'messages')
on conflict do nothing;

-- Set up storage policies
create policy "Users can upload message attachments to their folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'messages' and
  split_part(name, '/', 1) = auth.uid()::text
);

create policy "Users can read message attachments from their conversations"
on storage.objects for select to authenticated
using (
  bucket_id = 'messages' and
  exists (
    select 1 from messages m
    where 
      split_part(name, '/', 1) in (m.sender_id::text, m.receiver_id::text) and
      auth.uid() in (m.sender_id, m.receiver_id)
  )
);