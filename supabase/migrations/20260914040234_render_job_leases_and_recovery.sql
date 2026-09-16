alter table public.render_jobs
  add column if not exists heartbeat_at timestamptz,
  add column if not exists lease_owner text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists cancel_requested boolean not null default false;

alter table public.render_jobs
  drop constraint if exists render_jobs_attempt_count_check;

alter table public.render_jobs
  add constraint render_jobs_attempt_count_check check (attempt_count >= 0);

create index if not exists render_jobs_lease_recovery_idx
  on public.render_jobs (heartbeat_at)
  where lease_owner is not null and status not in ('done', 'failed', 'cancelled');

create or replace function public.render_job_claim(
  p_job_id text,
  p_worker_id text,
  p_stale_after_seconds integer default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.render_jobs;
begin
  update public.render_jobs
  set lease_owner = p_worker_id,
      heartbeat_at = now(),
      attempt_count = attempt_count + 1,
      status = case when status = 'queued' then 'planning' else status end,
      stage = case when status = 'queued' then 'planning' else stage end,
      updated_at = now()
  where public_ref = p_job_id
    and cancel_requested = false
    and status not in ('done', 'failed', 'cancelled')
    and (
      lease_owner is null
      or heartbeat_at is null
      or heartbeat_at < now() - make_interval(secs => greatest(p_stale_after_seconds, 60))
    )
  returning * into claimed;

  if not found then
    return null;
  end if;

  return to_jsonb(claimed);
end;
$$;

create or replace function public.render_job_touch_lease(
  p_job_id text,
  p_worker_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.render_jobs
  set heartbeat_at = now(), updated_at = now()
  where public_ref = p_job_id
    and lease_owner = p_worker_id
    and status not in ('done', 'failed', 'cancelled')
    and cancel_requested = false
  returning true;
$$;

create or replace function public.render_jobs_recover_stale(
  p_stale_after_seconds integer default 1800
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with recovered as (
    update public.render_jobs
    set status = case when cancel_requested then 'cancelled' else 'queued' end,
        stage = case when cancel_requested then 'cancelled' else 'queue-retry' end,
        error_code = case when cancel_requested then 'Render was cancelled.' else error_code end,
        lease_owner = null,
        heartbeat_at = null,
        updated_at = now(),
        finished_at = case when cancel_requested then now() else null end
    where lease_owner is not null
      and status not in ('done', 'failed', 'cancelled')
      and heartbeat_at < now() - make_interval(secs => greatest(p_stale_after_seconds, 60))
    returning public_ref, status
  )
  select coalesce(jsonb_agg(jsonb_build_object('jobId', public_ref, 'status', status)), '[]'::jsonb)
  from recovered;
$$;

revoke execute on function public.render_job_claim(text, text, integer) from public, anon, authenticated;
revoke execute on function public.render_job_touch_lease(text, text) from public, anon, authenticated;
revoke execute on function public.render_jobs_recover_stale(integer) from public, anon, authenticated;
grant execute on function public.render_job_claim(text, text, integer) to service_role;
grant execute on function public.render_job_touch_lease(text, text) to service_role;
grant execute on function public.render_jobs_recover_stale(integer) to service_role;
