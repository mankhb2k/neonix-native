-- Explicit operator replay after a transient fault has been corrected. This
-- is separate from the automatic bounded retry and only replays the latest
-- failed attempt for each chunk; it never mutates an immutable frame range or
-- runtime checksum.

create or replace function public.render_job_chunks_replay_failed(
  p_job_id text,
  p_reason text default 'OPERATOR_REPLAY_AFTER_FAULT_CLEAR'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  current_chunk public.render_job_chunks;
  replayed jsonb := '[]'::jsonb;
begin
  if length(coalesce(p_reason, '')) < 1 or length(p_reason) > 200 then
    raise exception 'invalid replay reason';
  end if;
  for current_chunk in
    select latest.*
      from public.render_job_chunks latest
      join public.render_jobs jobs on jobs.id = latest.render_job_id
     where jobs.public_ref = p_job_id
       and jobs.status not in ('done', 'failed', 'cancelled')
       and latest.status = 'failed'
       and latest.id = (
         select candidate.id
           from public.render_job_chunks candidate
          where candidate.render_job_id = latest.render_job_id
            and candidate.chunk_index = latest.chunk_index
          order by candidate.attempt desc
          limit 1
       )
     for update of latest
  loop
    insert into public.render_job_chunks (
      render_job_id, chunk_index, start_frame, end_frame_exclusive, attempt,
      status, runtime_checksum, asset_versions_json, metrics_json
    ) values (
      current_chunk.render_job_id, current_chunk.chunk_index,
      current_chunk.start_frame, current_chunk.end_frame_exclusive,
      current_chunk.attempt + 1, 'queued', current_chunk.runtime_checksum,
      current_chunk.asset_versions_json,
      jsonb_build_object('replayedFrom', current_chunk.id, 'reason', p_reason)
    );
    replayed := replayed || jsonb_build_array(jsonb_build_object(
      'chunkIndex', current_chunk.chunk_index,
      'previousAttempt', current_chunk.attempt,
      'nextAttempt', current_chunk.attempt + 1,
      'frameRange', jsonb_build_array(current_chunk.start_frame, current_chunk.end_frame_exclusive)
    ));
  end loop;
  return replayed;
end;
$$;

revoke all on function public.render_job_chunks_replay_failed(text, text) from public, anon, authenticated;
grant execute on function public.render_job_chunks_replay_failed(text, text) to service_role;
