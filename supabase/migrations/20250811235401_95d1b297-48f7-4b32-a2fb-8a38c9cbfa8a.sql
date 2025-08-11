-- Create public storage bucket for blog cover images and policies
insert into storage.buckets (id, name, public)
values ('blog-covers','blog-covers', true)
on conflict (id) do nothing;

-- Public read access
create policy "Public can read blog cover images"
  on storage.objects
  for select
  using (bucket_id = 'blog-covers');

-- Authenticated users can upload into their own folder (userId/...)
create policy "Users can upload own blog covers"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'blog-covers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Update own covers
create policy "Users can update own blog covers"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'blog-covers' and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'blog-covers' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Delete own covers
create policy "Users can delete own blog covers"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'blog-covers' and auth.uid()::text = (storage.foldername(name))[1]
  );