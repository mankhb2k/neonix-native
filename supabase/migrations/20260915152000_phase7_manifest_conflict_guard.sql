-- Never let an idempotent retry hide a different immutable payload at the
-- same chunk index.

create or replace function public.render_job_runtime_upload_commit(p_job_id uuid)
returns jsonb
language plpgsql security definer set search_path = render_internal, public
as $$
declare
  upload render_internal.render_job_runtime_uploads;
  received integer;
  received_bytes bigint;
  immutable_count integer;
begin
  perform set_config('statement_timeout', '180000', true);
  select * into upload
    from render_internal.render_job_runtime_uploads
   where render_job_id = p_job_id
   for update;
  if not found then raise exception 'runtime manifest upload has not started'; end if;
  if upload.status = 'committed' then
    return jsonb_build_object('status', 'committed', 'bytes', upload.total_bytes, 'sha256', upload.sha256, 'chunk_count', upload.chunk_count);
  end if;
  if upload.status <> 'uploading' then raise exception 'runtime manifest upload is not writable'; end if;

  select count(*), coalesce(sum(octet_length(payload)), 0)
    into received, received_bytes
    from render_internal.render_job_runtime_upload_chunks
   where render_job_id = p_job_id;
  if received <> upload.chunk_count then
    raise exception 'runtime manifest is incomplete: received % of % chunks', received, upload.chunk_count;
  end if;
  if received_bytes <> upload.total_bytes then
    raise exception 'runtime manifest byte length does not match';
  end if;
  if exists (
    select 1
      from render_internal.render_job_runtime_manifest_chunks immutable
      join render_internal.render_job_runtime_upload_chunks staging
        on staging.render_job_id = immutable.render_job_id
       and staging.chunk_index = immutable.chunk_index
     where immutable.render_job_id = p_job_id
       and immutable.payload <> staging.payload
  ) then
    raise exception 'runtime manifest immutable chunk conflict';
  end if;
  if exists (
    select 1 from public.render_jobs
     where id = p_job_id
       and (runtime_json is not null or runtime_manifest_text is not null or runtime_manifest_chunk_count is not null)
  ) then
    raise exception 'render job already has a committed runtime manifest';
  end if;

  insert into render_internal.render_job_runtime_manifest_chunks
    (render_job_id, chunk_index, chunk_count, payload)
  select render_job_id, chunk_index, upload.chunk_count, payload
    from render_internal.render_job_runtime_upload_chunks
   where render_job_id = p_job_id
  on conflict (render_job_id, chunk_index) do nothing;

  select count(*) into immutable_count
    from render_internal.render_job_runtime_manifest_chunks
   where render_job_id = p_job_id;
  if immutable_count <> upload.chunk_count then
    raise exception 'runtime manifest immutable chunk set is incomplete';
  end if;

  update public.render_jobs
     set runtime_manifest_chunk_count = upload.chunk_count,
         runtime_manifest_sha256 = upload.sha256,
         updated_at = now()
   where id = p_job_id;
  update render_internal.render_job_runtime_uploads
     set status = 'committed', updated_at = now()
   where render_job_id = p_job_id;
  delete from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id;
  return jsonb_build_object('status', 'committed', 'bytes', upload.total_bytes, 'sha256', upload.sha256, 'chunk_count', upload.chunk_count);
end;
$$;

revoke all on function public.render_job_runtime_upload_commit(uuid) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_commit(uuid) to service_role;
