-- Durable media-ingest queue and audio derivative catalog.
-- The origin asset becomes usable after R2 verification; derivative readiness
-- is tracked independently by media_jobs and assets.preview_status.

alter table public.asset_variants
  drop constraint if exists asset_variants_variant_kind_check;

alter table public.asset_variants
  add constraint asset_variants_variant_kind_check
    check (variant_kind in ('thumbnail', 'proxy', 'waveform', 'poster', 'audio'));

create table if not exists public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'ready', 'partial', 'failed')),
  idempotency_key text not null unique,
  source_integrity text not null,
  pipeline_version integer not null default 1 check (pipeline_version >= 1),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  streams_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(streams_json) = 'array'),
  derivatives_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(derivatives_json) = 'array'),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id)
);

create index if not exists media_jobs_queue_idx
  on public.media_jobs (status, created_at)
  where status in ('queued', 'processing');

create index if not exists media_jobs_workspace_idx
  on public.media_jobs (workspace_id, created_at desc);

drop trigger if exists media_jobs_touch_updated_at on public.media_jobs;
create trigger media_jobs_touch_updated_at
before update on public.media_jobs
for each row execute function public.touch_updated_at();

alter table public.media_jobs enable row level security;

create policy media_jobs_select_member on public.media_jobs
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy media_jobs_insert_editor on public.media_jobs
for insert to authenticated
with check (public.has_workspace_role(workspace_id, 'editor'));

create policy media_jobs_update_editor on public.media_jobs
for update to authenticated
using (public.has_workspace_role(workspace_id, 'editor'))
with check (public.has_workspace_role(workspace_id, 'editor'));

grant select, insert, update on public.media_jobs to authenticated;

comment on table public.media_jobs is
  'Durable video probe/derivative queue. Worker reports completion through the Web API callback.';
comment on column public.media_jobs.source_integrity is
  'Origin identity used for idempotent media preparation.';
