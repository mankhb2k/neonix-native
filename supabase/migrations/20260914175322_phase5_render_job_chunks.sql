-- Phase 5.1: immutable frame-range manifest and per-chunk state.
-- render_jobs remains the source of truth for the parent export; this table
-- records independently retryable video segments.

alter table public.render_jobs
  add column if not exists chunk_manifest_json jsonb,
  add column if not exists chunk_manifest_checksum text,
  add column if not exists chunk_size integer,
  add column if not exists chunk_count integer,
  add column if not exists chunk_parallelism integer;

alter table public.render_jobs
  drop constraint if exists render_jobs_chunk_manifest_check,
  drop constraint if exists render_jobs_chunk_size_check,
  drop constraint if exists render_jobs_chunk_count_check,
  drop constraint if exists render_jobs_chunk_parallelism_check;

alter table public.render_jobs
  add constraint render_jobs_chunk_manifest_check
    check (chunk_manifest_json is null or jsonb_typeof(chunk_manifest_json) = 'object'),
  add constraint render_jobs_chunk_size_check
    check (chunk_size is null or chunk_size > 0),
  add constraint render_jobs_chunk_count_check
    check (chunk_count is null or chunk_count > 0),
  add constraint render_jobs_chunk_parallelism_check
    check (chunk_parallelism is null or chunk_parallelism > 0);

create table if not exists public.render_job_chunks (
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.render_jobs (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  start_frame integer not null check (start_frame >= 0),
  end_frame_exclusive integer not null check (end_frame_exclusive > start_frame),
  attempt integer not null default 1 check (attempt > 0),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'uploaded', 'verified', 'failed', 'cancelled')),
  runtime_checksum text not null,
  asset_versions_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(asset_versions_json) = 'array'),
  segment_key text,
  temporary_key text,
  output_checksum text,
  output_size_bytes bigint check (output_size_bytes is null or output_size_bytes >= 0),
  verified_frames integer check (verified_frames is null or verified_frames >= 0),
  error_code text,
  metrics_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics_json) = 'object'),
  heartbeat_at timestamptz,
  lease_owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (render_job_id, chunk_index, attempt)
);

create index if not exists render_job_chunks_job_idx
  on public.render_job_chunks (render_job_id, chunk_index);

create index if not exists render_job_chunks_status_idx
  on public.render_job_chunks (status, updated_at);

create unique index if not exists render_job_chunks_active_idx
  on public.render_job_chunks (render_job_id, chunk_index)
  where status in ('queued', 'running', 'uploaded', 'verified');

drop trigger if exists render_job_chunks_touch_updated_at on public.render_job_chunks;
create trigger render_job_chunks_touch_updated_at
before update on public.render_job_chunks
for each row execute function public.touch_updated_at();

alter table public.render_job_chunks enable row level security;

drop policy if exists render_job_chunks_select_member on public.render_job_chunks;
create policy render_job_chunks_select_member on public.render_job_chunks
for select using (
  exists (
    select 1
    from public.render_jobs jobs
    join public.workspace_members members on members.workspace_id = jobs.workspace_id
    where jobs.id = render_job_chunks.render_job_id
      and members.user_id = (select auth.uid())
  )
);

grant select on public.render_job_chunks to authenticated;
