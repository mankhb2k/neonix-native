-- Poster-first media preview metadata. Derivative bytes remain in private R2;
-- Postgres stores only keys, status, and source metadata for authorization and UX.

alter table public.assets
  add column if not exists preview_key text,
  add column if not exists preview_status text not null default 'unsupported',
  add column if not exists source_duration_ms bigint,
  add column if not exists source_width integer,
  add column if not exists source_height integer,
  add column if not exists has_audio boolean,
  add column if not exists preview_version integer,
  add column if not exists preview_error text;

alter table public.assets
  drop constraint if exists assets_preview_status_check;

alter table public.assets
  add constraint assets_preview_status_check
    check (preview_status in ('pending', 'ready', 'failed', 'unsupported'));

alter table public.assets
  drop constraint if exists assets_preview_metadata_check;

alter table public.assets
  add constraint assets_preview_metadata_check check (
    (source_duration_ms is null or source_duration_ms >= 0)
    and (source_width is null or source_width > 0)
    and (source_height is null or source_height > 0)
    and (preview_version is null or preview_version >= 1)
    and ((preview_status in ('pending', 'ready') and preview_key is not null)
      or preview_status in ('failed', 'unsupported'))
  );

alter table public.upload_sessions
  add column if not exists expected_preview_byte_size bigint,
  add column if not exists expected_preview_mime_type text,
  add column if not exists preview_key text;

alter table public.upload_sessions
  drop constraint if exists upload_sessions_preview_size_check;

alter table public.upload_sessions
  add constraint upload_sessions_preview_size_check
    check (expected_preview_byte_size is null or expected_preview_byte_size > 0);

create index if not exists assets_preview_status_idx
  on public.assets (workspace_id, preview_status)
  where deleted_at is null;

comment on column public.assets.preview_key is
  'Private R2 poster derivative key; never a public URL.';
comment on column public.assets.preview_status is
  'Poster lifecycle. Derivative bytes are not included in user storage quota.';
comment on column public.assets.source_duration_ms is
  'Browser-observed media duration for editor UX; export validates independently.';
