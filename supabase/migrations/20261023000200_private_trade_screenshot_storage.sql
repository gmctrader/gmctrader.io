-- Make trade chart screenshots private and scoped to the owning account.
-- Existing objects use the first path segment as the Supabase user UUID.
-- Review current storage.objects policies before applying this migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trade screenshots owner can read" on storage.objects;
drop policy if exists "Trade screenshots owner can upload" on storage.objects;
drop policy if exists "Trade screenshots owner can update" on storage.objects;
drop policy if exists "Trade screenshots owner can delete" on storage.objects;
drop policy if exists "Trade screenshots restrict reads to owner" on storage.objects;
drop policy if exists "Trade screenshots restrict uploads to owner" on storage.objects;
drop policy if exists "Trade screenshots restrict updates to owner" on storage.objects;
drop policy if exists "Trade screenshots restrict deletes to owner" on storage.objects;

-- Restrictive policies also constrain any broader permissive policy that may
-- already exist on storage.objects. Other buckets are unaffected.
create policy "Trade screenshots restrict reads to owner"
on storage.objects as restrictive
for select to public
using (
  bucket_id <> 'trade-screenshots'
  or (auth.uid() is not null and (storage.foldername(name))[1] = (select auth.uid()::text))
);

create policy "Trade screenshots restrict uploads to owner"
on storage.objects as restrictive
for insert to public
with check (
  bucket_id <> 'trade-screenshots'
  or (auth.uid() is not null and (storage.foldername(name))[1] = (select auth.uid()::text))
);

create policy "Trade screenshots restrict updates to owner"
on storage.objects as restrictive
for update to public
using (
  bucket_id <> 'trade-screenshots'
  or (auth.uid() is not null and (storage.foldername(name))[1] = (select auth.uid()::text))
)
with check (
  bucket_id <> 'trade-screenshots'
  or (auth.uid() is not null and (storage.foldername(name))[1] = (select auth.uid()::text))
);

create policy "Trade screenshots restrict deletes to owner"
on storage.objects as restrictive
for delete to public
using (
  bucket_id <> 'trade-screenshots'
  or (auth.uid() is not null and (storage.foldername(name))[1] = (select auth.uid()::text))
);

create policy "Trade screenshots owner can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Trade screenshots owner can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Trade screenshots owner can update"
on storage.objects for update to authenticated
using (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Trade screenshots owner can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
