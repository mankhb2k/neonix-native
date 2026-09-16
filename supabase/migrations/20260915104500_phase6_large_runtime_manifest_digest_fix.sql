-- Supabase installs pgcrypto in the extensions schema; keep the private
-- runtime upload RPC independent from search_path resolution.
create or replace function public.render_job_runtime_upload_commit(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = render_internal, public
as $$
declare
  upload render_internal.render_job_runtime_uploads;
  chunk render_internal.render_job_runtime_upload_chunks;
  received integer;
  assembled bytea := ''::bytea;
  assembled_text text;
  parsed jsonb;
  actual_sha256 text;
begin
  select * into upload
    from render_internal.render_job_runtime_uploads
   where render_job_id = p_job_id
   for update;
  if not found then raise exception 'runtime manifest upload has not started'; end if;
  if upload.status = 'committed' then
    return jsonb_build_object('status', 'committed', 'bytes', upload.total_bytes, 'sha256', upload.sha256);
  end if;

  select count(*) into received from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id;
  if received <> upload.chunk_count then
    raise exception 'runtime manifest is incomplete: received % of % chunks', received, upload.chunk_count;
  end if;

  for chunk in
    select * from render_internal.render_job_runtime_upload_chunks
     where render_job_id = p_job_id order by chunk_index
  loop
    assembled := assembled || chunk.payload;
  end loop;
  if octet_length(assembled) <> upload.total_bytes then
    raise exception 'runtime manifest byte length does not match';
  end if;
  actual_sha256 := encode(extensions.digest(assembled, 'sha256'), 'hex');
  if actual_sha256 <> upload.sha256 then
    update render_internal.render_job_runtime_uploads set status = 'failed', updated_at = now() where render_job_id = p_job_id;
    raise exception 'runtime manifest checksum mismatch';
  end if;
  begin
    assembled_text := convert_from(assembled, 'utf8');
    parsed := assembled_text::jsonb;
  exception when others then
    update render_internal.render_job_runtime_uploads set status = 'failed', updated_at = now() where render_job_id = p_job_id;
    raise exception 'runtime manifest is not valid UTF-8 JSON';
  end;
  if jsonb_typeof(parsed) <> 'object' then
    update render_internal.render_job_runtime_uploads set status = 'failed', updated_at = now() where render_job_id = p_job_id;
    raise exception 'runtime manifest must be a JSON object';
  end if;
  if exists (select 1 from public.render_jobs where id = p_job_id and runtime_json is not null) then
    raise exception 'render job already has a committed runtime manifest';
  end if;

  update public.render_jobs set runtime_json = parsed, updated_at = now() where id = p_job_id;
  update render_internal.render_job_runtime_uploads set status = 'committed', updated_at = now() where render_job_id = p_job_id;
  delete from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id;
  return jsonb_build_object('status', 'committed', 'bytes', upload.total_bytes, 'sha256', upload.sha256);
end;
$$;

revoke all on function public.render_job_runtime_upload_commit(uuid) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_commit(uuid) to service_role;
