-- Phase 5.2/5.3: leaseable chunk rows and an idempotent finalizer claim.

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
           select id from public.render_jobs where public_ref = p_job_id
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

create or replace function public.render_job_chunk_touch(
  p_chunk_id uuid,
  p_worker_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.render_job_chunks
     set heartbeat_at = now(), updated_at = now()
   where id = p_chunk_id
     and lease_owner = p_worker_id
     and status = 'running'
  returning true;
$$;

create or replace function public.render_job_chunk_retry(
  p_chunk_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_chunk public.render_job_chunks;
  retry_chunk public.render_job_chunks;
begin
  select * into current_chunk
    from public.render_job_chunks
   where id = p_chunk_id
     and lease_owner = p_worker_id
   for update;
  if not found then
    return null;
  end if;

  update public.render_job_chunks
     set status = 'failed',
         lease_owner = null,
         heartbeat_at = null,
         finished_at = now(),
         updated_at = now()
   where id = current_chunk.id;

  insert into public.render_job_chunks (
    render_job_id, chunk_index, start_frame, end_frame_exclusive, attempt,
    status, runtime_checksum, asset_versions_json, metrics_json
  ) values (
    current_chunk.render_job_id,
    current_chunk.chunk_index,
    current_chunk.start_frame,
    current_chunk.end_frame_exclusive,
    current_chunk.attempt + 1,
    'queued',
    current_chunk.runtime_checksum,
    current_chunk.asset_versions_json,
    '{}'::jsonb
  ) returning * into retry_chunk;
  return to_jsonb(retry_chunk);
end;
$$;

create or replace function public.render_job_finalizer_claim(
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
    return jsonb_build_object('state', 'done', 'job', to_jsonb(job));
  end if;
  select count(*), count(*) filter (where status = 'verified')
    into total_chunks, verified_chunks
    from public.render_job_chunks
   where render_job_id = job.id;
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
  return jsonb_build_object('state', 'claimed', 'job', to_jsonb(claimed));
end;
$$;

revoke execute on function public.render_job_chunk_claim(text, integer, text, integer) from public, anon, authenticated;
revoke execute on function public.render_job_chunk_touch(uuid, text) from public, anon, authenticated;
revoke execute on function public.render_job_chunk_retry(uuid, text) from public, anon, authenticated;
revoke execute on function public.render_job_finalizer_claim(text, text, integer) from public, anon, authenticated;
grant execute on function public.render_job_chunk_claim(text, integer, text, integer) to service_role;
grant execute on function public.render_job_chunk_touch(uuid, text) to service_role;
grant execute on function public.render_job_chunk_retry(uuid, text) to service_role;
grant execute on function public.render_job_finalizer_claim(text, text, integer) to service_role;
