-- Phase 1: make media readiness explicit and make media job claims recoverable.
-- Binary data remains in R2; this migration only adds lifecycle/identity data.

alter table public.assets
  add column if not exists media_status text not null default 'not_required';

alter table public.assets
  drop constraint if exists assets_media_status_check;

alter table public.assets
  add constraint assets_media_status_check
    check (media_status in ('not_required', 'queued', 'processing', 'ready', 'partial', 'failed'));

alter table public.media_jobs
  drop constraint if exists media_jobs_status_check;

alter table public.media_jobs
  add constraint media_jobs_status_check
    check (status in ('queued', 'processing', 'retryable', 'ready', 'partial', 'failed'));

alter table public.media_jobs
  add column if not exists media_kind text not null default 'video',
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists source_content_hash text;

alter table public.media_jobs
  drop constraint if exists media_jobs_media_kind_check;

alter table public.media_jobs
  add constraint media_jobs_media_kind_check
    check (media_kind in ('audio', 'video'));

-- Backfill the explicit media state without changing the existing origin
-- upload state represented by assets.status.
update public.assets as asset
set media_status = case
  when asset.kind not in ('audio', 'video') then 'not_required'
  when job.status in ('ready', 'partial', 'failed') then job.status
  when job.status = 'processing' then 'processing'
  else 'queued'
end
from public.media_jobs as job
where job.asset_id = asset.id;

update public.assets
set media_status = case when kind in ('audio', 'video') then 'queued' else 'not_required' end
where media_status = 'not_required'
  and kind in ('audio', 'video');

update public.media_jobs as job
set media_kind = asset.kind
from public.assets as asset
where asset.id = job.asset_id
  and asset.kind in ('audio', 'video');

create index if not exists media_jobs_claim_idx
  on public.media_jobs (status, lease_expires_at, created_at)
  where status in ('queued', 'retryable', 'processing');

create index if not exists assets_media_status_idx
  on public.assets (workspace_id, media_status, created_at desc)
  where deleted_at is null;

comment on column public.assets.media_status is
  'Derivative readiness state; independent from assets.status, which tracks origin lifecycle.';

comment on column public.media_jobs.lease_expires_at is
  'Lease expiry used to recover a worker that stopped without reporting a result.';

drop function if exists public.claim_media_job(uuid);

create or replace function public.claim_media_job(
  p_job_id uuid,
  p_lease_owner text default null,
  p_lease_seconds integer default 900
)
returns table (
  id uuid,
  status text,
  started_at timestamptz,
  attempt_count integer,
  lease_expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if p_lease_seconds < 30 or p_lease_seconds > 86400 then
    raise exception 'lease seconds must be between 30 and 86400';
  end if;

  return query
  update public.media_jobs as job
  set
    status = 'processing',
    started_at = coalesce(job.started_at, now()),
    attempt_count = job.attempt_count + 1,
    last_error = null,
    last_error_code = null,
    lease_owner = p_lease_owner,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where job.id = p_job_id
    and job.status in ('queued', 'retryable')
    and (job.lease_expires_at is null or job.lease_expires_at <= now())
    and public.has_workspace_role(job.workspace_id, 'editor')
  returning job.id, job.status, job.started_at, job.attempt_count, job.lease_expires_at;
end;
$$;

comment on function public.claim_media_job(uuid, text, integer) is
  'Atomically claims a queued/retryable media job and gives it a recoverable lease.';

create or replace function public.recover_stale_media_jobs(p_limit integer default 100)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  recovered integer;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'limit must be between 1 and 1000';
  end if;

  with stale as (
    select id
    from public.media_jobs
    where status = 'processing'
      and lease_expires_at is not null
      and lease_expires_at < now()
    order by lease_expires_at
    limit p_limit
    for update skip locked
  )
  update public.media_jobs as job
  set status = 'retryable',
      lease_owner = null,
      lease_expires_at = null,
      last_error_code = 'lease_expired',
      last_error = 'Media worker lease expired'
  from stale
  where job.id = stale.id;

  get diagnostics recovered = row_count;
  return recovered;
end;
$$;

grant execute on function public.claim_media_job(uuid, text, integer) to authenticated;
grant execute on function public.recover_stale_media_jobs(integer) to authenticated;
