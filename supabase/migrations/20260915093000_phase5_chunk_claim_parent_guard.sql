-- Do not start chunk work for a terminal parent job. This also protects
-- idempotent/backfilled historical jobs whose parent completed before chunks
-- were initialized.

create or replace function public.render_job_chunk_claim(
  p_job_id text,
  p_chunk_index integer,
  p_worker_id text,
  p_stale_after_seconds integer default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.render_job_chunks;
begin
  update public.render_job_chunks chunks
     set status = 'running',
         lease_owner = p_worker_id,
         heartbeat_at = now(),
         started_at = coalesce(started_at, now()),
         finished_at = null,
         error_code = null,
         updated_at = now()
   where chunks.render_job_id = (
           select id from public.render_jobs
            where public_ref = p_job_id
              and status not in ('done', 'failed', 'cancelled')
         )
     and chunks.chunk_index = p_chunk_index
     and chunks.attempt = (
           select max(candidate.attempt)
             from public.render_job_chunks candidate
            where candidate.render_job_id = chunks.render_job_id
              and candidate.chunk_index = chunks.chunk_index
         )
     and (
           chunks.status = 'queued'
           or (
             chunks.status = 'running'
             and chunks.heartbeat_at < now() - make_interval(secs => greatest(p_stale_after_seconds, 60))
           )
         )
   returning chunks.* into claimed;

  if not found then
    return null;
  end if;
  return to_jsonb(claimed);
end;
$$;

revoke execute on function public.render_job_chunk_claim(text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.render_job_chunk_claim(text, integer, text, integer) to service_role;
