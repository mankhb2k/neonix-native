-- User font uploads are static, single-face files only.
-- Keep the binary in public.assets for quota/account ownership, while the
-- user_font_* tables store searchable font semantics.

alter table public.user_font_faces
  drop constraint if exists user_font_faces_format_check;

alter table public.user_font_faces
  add constraint user_font_faces_format_check
    check (format in ('woff2', 'woff', 'ttf'));

alter table public.user_font_faces
  drop constraint if exists user_font_faces_font_family_id_face_key_format_key;

create unique index if not exists user_font_faces_family_face_uidx
  on public.user_font_faces (font_family_id, face_key);

create unique index if not exists user_font_assets_filename_uidx
  on public.assets (workspace_id, lower(btrim(original_filename)))
  where kind = 'font'
    and original_filename is not null
    and deleted_at is null
    and status in ('uploading', 'ready');

create unique index if not exists user_font_assets_content_hash_uidx
  on public.assets (workspace_id, content_hash)
  where kind = 'font'
    and content_hash not like 'pending:%'
    and deleted_at is null
    and status = 'ready';
