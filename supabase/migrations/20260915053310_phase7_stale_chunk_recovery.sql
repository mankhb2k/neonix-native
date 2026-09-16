-- Phase 7: recover indexed chunk leases after a task disappears.
-- The old attempt is retained for audit; a new queued attempt owns the same
-- immutable frame range, runtime checksum and asset-version snapshot.

create or replace function public.render_job_chunks_recover_stale(
  p_job_id text,
  p_stale_after_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_chunk public.render_job_chunks;
  recovered jsonb := '[]'::jsonb;
begin
  for current_chunk in
    select chunks.*
      from public.render_job_chunks chunks
      join public.render_jobs jobs on jobs.id = chunks.render_job_id
     where jobs.public_ref = p_job_id
       and jobs.status not in ('done', 'failed', 'cancelled')
       and chunks.status = 'running'
       and chunks.heartbeat_at is not null
       and chunks.heartbeat_at < now() - make_interval(secs => greatest(p_stale_after_seconds, 60))
     for update of chunks skip locked
  loop
    update public.render_job_chunks
       set status = 'failed',
           error_code = 'WORKER_STALE_LEASE',
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
      jsonb_build_object('recoveredFrom', current_chunk.id, 'reason', 'WORKER_STALE_LEASE')
    );

    recovered := recovered || jsonb_build_array(jsonb_build_object(
      'chunkIndex', current_chunk.chunk_index,
      'previousAttempt', current_chunk.attempt,
      'nextAttempt', current_chunk.attempt + 1,
      'frameRange', jsonb_build_array(current_chunk.start_frame, current_chunk.end_frame_exclusive)
    ));
  end loop;
  return recovered;
end;
$$;

revoke all on function public.render_job_chunks_recover_stale(text, integer) from public, anon, authenticated;
grant execute on function public.render_job_chunks_recover_stale(text, integer) to service_role;
