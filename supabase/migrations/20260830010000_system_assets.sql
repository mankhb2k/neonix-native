-- Static system placeholders stored in the private neonix-system-assets R2 bucket.
-- A single self-referencing catalog keeps origins and their future derivatives
-- together without coupling system assets to a user workspace.

create table if not exists public.system_assets (
  id text primary key,
  parent_id text references public.system_assets (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio')),
  variant_kind text not null
    check (variant_kind in ('origin', 'poster', 'audio', 'waveform', 'thumbnail')),
  r2_key text not null unique,
  mime_type text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  metadata_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_json) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, variant_kind)
);

create index if not exists system_assets_parent_idx
  on public.system_assets (parent_id, variant_kind)
  where enabled;

alter table public.system_assets enable row level security;

drop policy if exists system_assets_select_authenticated on public.system_assets;
create policy system_assets_select_authenticated on public.system_assets
for select to authenticated
using (enabled);

grant select on public.system_assets to authenticated;

insert into public.system_assets (
  id,
  parent_id,
  kind,
  variant_kind,
  r2_key,
  mime_type,
  byte_size,
  width,
  height,
  duration_ms,
  metadata_json
)
values
  (
    'system:image-placeholder',
    null,
    'image',
    'origin',
    'placeholder/image.webp',
    'image/webp',
    121770,
    1920,
    1080,
    null,
    '{"role":"placeholder"}'::jsonb
  ),
  (
    'system:svg-placeholder',
    null,
    'image',
    'origin',
    'placeholder/svg-placeholder.svg',
    'image/svg+xml',
    906,
    1920,
    1080,
    null,
    '{"role":"placeholder"}'::jsonb
  ),
  (
    'system:video-placeholder',
    null,
    'video',
    'origin',
    'placeholder/video.mp4',
    'video/mp4',
    196315,
    1920,
    1080,
    10067,
    '{"role":"placeholder"}'::jsonb
  ),
  (
    'system:video-placeholder:poster',
    'system:video-placeholder',
    'image',
    'poster',
    'placeholder/video-poster.webp',
    'image/webp',
    133950,
    1920,
    1080,
    null,
    '{"role":"poster"}'::jsonb
  ),
  (
    'system:audio-silence',
    null,
    'audio',
    'origin',
    'placeholder/silence.m4a',
    'audio/x-m4a',
    283929,
    null,
    null,
    600000,
    '{"role":"placeholder","silent":true}'::jsonb
  )
on conflict (id) do update set
  parent_id = excluded.parent_id,
  kind = excluded.kind,
  variant_kind = excluded.variant_kind,
  r2_key = excluded.r2_key,
  mime_type = excluded.mime_type,
  byte_size = excluded.byte_size,
  width = excluded.width,
  height = excluded.height,
  duration_ms = excluded.duration_ms,
  metadata_json = excluded.metadata_json,
  enabled = true,
  updated_at = now();

