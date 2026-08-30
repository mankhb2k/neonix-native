-- Atomically claim a queued media job before dispatching it to the renderer.
-- The workspace editor check keeps this RPC safe when called with the user's
-- authenticated Supabase client.

create or replace function public.claim_media_job(p_job_id uuid)
returns table (
  id uuid,
  status text,
  started_at timestamptz,
  attempt_count integer
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  return query
  update public.media_jobs as job
  set
    status = 'processing',
    started_at = coalesce(job.started_at, now()),
    attempt_count = job.attempt_count + 1,
    last_error = null,
    completed_at = null
  where job.id = p_job_id
    and job.status = 'queued'
    and public.has_workspace_role(job.workspace_id, 'editor')
  returning job.id, job.status, job.started_at, job.attempt_count;
end;
$$;

grant execute on function public.claim_media_job(uuid) to authenticated;

comment on function public.claim_media_job(uuid) is
  'Atomically moves a queued media job to processing and increments its dispatch attempt count.';
