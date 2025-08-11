-- Create public storage bucket for blog cover images and policies
-- Idempotent bucket creation
insert into storage.buckets (id, name, public)
values ('blog-covers','blog-covers', true)
on conflict (id) do nothing;

-- Allow public read access to blog cover images
create policy if not exists "Public can read blog cover images"
  on storage.objects
  for select
  using (bucket_id = 'blog-covers');

-- Allow authenticated users to upload their own cover images under a user folder
create policy if not exists "Users can upload own blog covers"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'blog-covers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update their own uploaded cover images
create policy if not exists "Users can update own blog covers"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'blog-covers' and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'blog-covers' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own uploaded cover images
create policy if not exists "Users can delete own blog covers"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'blog-covers' and auth.uid()::text = (storage.foldername(name))[1]
  );