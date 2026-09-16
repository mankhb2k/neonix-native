-- Finalization must evaluate the latest attempt for each chunk. Historical
-- failed attempts remain for audit/retry, but must not block a successful
-- replay from reaching the mux/finalizer stage.

create or replace function public.render_job_finalizer_claim(p_job_id text, p_worker_id text, p_stale_after_seconds integer default 1800)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  job public.render_jobs;
  claimed public.render_jobs;
  total_chunks integer;
  verified_chunks integer;
begin
  select * into job
    from public.render_jobs
   where public_ref = p_job_id
   for update;

  if not found then
    return null;
  end if;

  if job.status = 'done' then
    return jsonb_build_object('state', 'done', 'job', to_jsonb(job) - 'runtime_manifest_text');
  end if;

  select count(*), count(*) filter (where status = 'verified')
    into total_chunks, verified_chunks
    from (
      select distinct on (chunk_index) status
        from public.render_job_chunks
       where render_job_id = job.id
       order by chunk_index, attempt desc
    ) latest;

  if total_chunks = 0 or total_chunks <> verified_chunks then
    return jsonb_build_object('state', 'waiting', 'verified', verified_chunks, 'total', total_chunks);
  end if;

  if job.lease_owner is not null
     and (job.heartbeat_at is null or job.heartbeat_at >= now() - make_interval(secs => greatest(p_stale_after_seconds, 60))) then
    return jsonb_build_object('state', 'busy');
  end if;

  update public.render_jobs
     set status = 'muxing',
         stage = 'finalizing',
         lease_owner = p_worker_id,
         heartbeat_at = now(),
         updated_at = now()
   where id = job.id
  returning * into claimed;

  return jsonb_build_object('state', 'claimed', 'job', to_jsonb(claimed) - 'runtime_manifest_text');
end;
$$;

revoke all on function public.render_job_finalizer_claim(text, text, integer) from public, anon, authenticated;
grant execute on function public.render_job_finalizer_claim(text, text, integer) to service_role;
