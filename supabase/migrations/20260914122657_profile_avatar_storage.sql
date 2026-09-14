-- Store custom avatar metadata on the existing profile row.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists avatar_mime_type text,
  add column if not exists avatar_size_bytes bigint,
  add column if not exists avatar_updated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_avatar_size_check;

alter table public.profiles
  add constraint profiles_avatar_size_check
  check (avatar_size_bytes is null or avatar_size_bytes between 1 and 5242880);

comment on column public.profiles.avatar_path is
  'Private object path for the account custom avatar in the avatars bucket.';
comment on column public.profiles.avatar_mime_type is
  'MIME type of the account custom avatar.';
comment on column public.profiles.avatar_size_bytes is
  'Size in bytes of the account custom avatar. Maximum 5 MiB.';

-- Public read access is intentional: avatar_url is safe to render in app chrome.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
