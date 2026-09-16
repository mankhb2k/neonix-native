-- Phase 7: reclaim a finalizer process that was killed after claiming its lease.
-- The coordinator calls this targeted RPC while it is waiting for the
-- finalizer. It is intentionally separate from the broad stale-job sweep so
-- one render cannot reclaim unrelated jobs.

create or replace function public.render_job_finalizer_recover_stale(
  p_job_id text,
  p_stale_after_seconds integer default 1800,
  p_max_attempts integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.render_jobs;
  next_attempt integer;
begin
  select * into job
    from public.render_jobs
   where public_ref = p_job_id
   for update;

  if not found then
    return null;
  end if;

  if job.status in ('done', 'failed', 'cancelled') then
    return jsonb_build_object('state', job.status, 'attemptCount', job.attempt_count);
  end if;

  if job.lease_owner is null
     or job.heartbeat_at is null
     or job.heartbeat_at >= now() - make_interval(secs => greatest(p_stale_after_seconds, 60)) then
    return jsonb_build_object('state', 'not-stale', 'attemptCount', job.attempt_count);
  end if;

  next_attempt := coalesce(job.attempt_count, 0) + 1;
  if next_attempt > greatest(p_max_attempts, 1) then
    update public.render_jobs
       set status = 'failed',
           stage = 'failed',
           error_code = 'FINALIZER_STALE_LEASE_RETRY_EXHAUSTED',
           lease_owner = null,
           heartbeat_at = null,
           finished_at = now(),
           updated_at = now()
     where id = job.id;
    return jsonb_build_object('state', 'failed', 'attemptCount', coalesce(job.attempt_count, 0));
  end if;

  update public.render_jobs
     set status = 'queued',
         stage = 'finalizer-retry',
         error_code = 'FINALIZER_STALE_LEASE',
         attempt_count = next_attempt,
         lease_owner = null,
         heartbeat_at = null,
         finished_at = null,
         updated_at = now()
   where id = job.id;

  return jsonb_build_object(
    'state', 'recovered',
    'attemptCount', next_attempt,
    'jobId', job.public_ref
  );
end;
$$;

revoke all on function public.render_job_finalizer_recover_stale(text, integer, integer) from public, anon, authenticated;
grant execute on function public.render_job_finalizer_recover_stale(text, integer, integer) to service_role;
