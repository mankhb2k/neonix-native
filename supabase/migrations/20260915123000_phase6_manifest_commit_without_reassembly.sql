-- Do not concatenate a 30 MB payload inside a PostgREST statement. The client
-- already computes the SHA-256 before upload; commit only validates chunk
-- coverage/byte count and marks the immutable chunk set as committed. Workers
-- reconstruct and parse it from bounded RPC responses.

create or replace function public.render_job_runtime_manifest_get_chunk(p_job_id uuid, p_chunk_index integer)
returns table(payload_base64 text)
language sql security definer set search_path = render_internal, public
as $$
  select encode(chunks.payload, 'base64')
    from render_internal.render_job_runtime_uploads uploads
    join render_internal.render_job_runtime_upload_chunks chunks on chunks.render_job_id = uploads.render_job_id
   where uploads.render_job_id = p_job_id
     and uploads.status = 'committed'
     and chunks.chunk_index = p_chunk_index;
$$;

revoke all on function public.render_job_runtime_manifest_get_chunk(uuid, integer) from public, anon, authenticated;
grant execute on function public.render_job_runtime_manifest_get_chunk(uuid, integer) to service_role;

create or replace function public.render_job_runtime_upload_commit(p_job_id uuid)
returns jsonb
language plpgsql security definer set search_path = render_internal, public
as $$
declare
  upload render_internal.render_job_runtime_uploads;
  received integer;
  received_bytes bigint;
begin
  perform set_config('statement_timeout', '180000', true);
  select * into upload from render_internal.render_job_runtime_uploads where render_job_id = p_job_id for update;
  if not found then raise exception 'runtime manifest upload has not started'; end if;
  if upload.status = 'committed' then
    return jsonb_build_object('status','committed','bytes',upload.total_bytes,'sha256',upload.sha256,'chunk_count',upload.chunk_count);
  end if;
  select count(*), coalesce(sum(octet_length(payload)),0) into received,received_bytes
    from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id;
  if received <> upload.chunk_count then raise exception 'runtime manifest is incomplete: received % of % chunks',received,upload.chunk_count; end if;
  if received_bytes <> upload.total_bytes then raise exception 'runtime manifest byte length does not match'; end if;
  if exists (select 1 from public.render_jobs where id=p_job_id and (runtime_json is not null or runtime_manifest_text is not null or runtime_manifest_chunk_count is not null)) then raise exception 'render job already has a committed runtime manifest'; end if;
  update public.render_jobs set runtime_manifest_chunk_count=upload.chunk_count,updated_at=now() where id=p_job_id;
  update render_internal.render_job_runtime_uploads set status='committed',updated_at=now() where render_job_id=p_job_id;
  return jsonb_build_object('status','committed','bytes',upload.total_bytes,'sha256',upload.sha256,'chunk_count',upload.chunk_count);
end;
$$;

revoke all on function public.render_job_runtime_upload_commit(uuid) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_commit(uuid) to service_role;
