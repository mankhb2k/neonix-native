-- Phase 1 correction: keep asset readiness in sync with media job leases and
-- expose recovery only to the internal service role.

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
declare
  claimed public.media_jobs%rowtype;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 86400 then
    raise exception 'lease seconds must be between 30 and 86400';
  end if;

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
  returning job.* into claimed;

  if found then
    update public.assets
    set media_status = 'processing'
    where id = claimed.asset_id;

    return query select claimed.id, claimed.status, claimed.started_at,
      claimed.attempt_count, claimed.lease_expires_at;
  end if;
end;
$$;

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

  update public.assets as asset
  set media_status = 'queued'
  from public.media_jobs as job
  where job.asset_id = asset.id
    and job.status = 'retryable'
    and job.last_error_code = 'lease_expired';

  return recovered;
end;
$$;

revoke all on function public.claim_media_job(uuid, text, integer) from public;
grant execute on function public.claim_media_job(uuid, text, integer) to authenticated;
grant execute on function public.claim_media_job(uuid, text, integer) to service_role;

revoke all on function public.recover_stale_media_jobs(integer) from public;
grant execute on function public.recover_stale_media_jobs(integer) to service_role;
