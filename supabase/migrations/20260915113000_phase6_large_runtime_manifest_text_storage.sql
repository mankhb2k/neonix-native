-- Store oversized runtime JSON as TOASTed text in render_jobs. The database
-- remains the source of truth, while workers parse the text after reading it;
-- casting a 30+ MB payload to jsonb inside a PostgREST statement exceeds the
-- hosted statement budget.

alter table public.render_jobs
  add column if not exists runtime_manifest_text text;

alter table public.render_jobs
  drop constraint if exists render_jobs_runtime_storage_check;

alter table public.render_jobs
  add constraint render_jobs_runtime_storage_check
  check (
    (runtime_json is null or runtime_manifest_text is null)
    and (runtime_manifest_text is null or length(runtime_manifest_text) > 0)
  );

create or replace function public.render_job_runtime_upload_commit(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = render_internal, public
as $$
declare
  upload render_internal.render_job_runtime_uploads;
  received integer;
  assembled bytea;
  assembled_text text;
  actual_sha256 text;
begin
  perform set_config('statement_timeout', '180000', true);
  select * into upload
    from render_internal.render_job_runtime_uploads
   where render_job_id = p_job_id
   for update;
  if not found then raise exception 'runtime manifest upload has not started'; end if;
  if upload.status = 'committed' then
    return jsonb_build_object('status', 'committed', 'bytes', upload.total_bytes, 'sha256', upload.sha256);
  end if;
  select count(*) into received
    from render_internal.render_job_runtime_upload_chunks
   where render_job_id = p_job_id;
  if received <> upload.chunk_count then
    raise exception 'runtime manifest is incomplete: received % of % chunks', received, upload.chunk_count;
  end if;
  select string_agg(payload, ''::bytea order by chunk_index) into assembled
    from render_internal.render_job_runtime_upload_chunks
   where render_job_id = p_job_id;
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
  exception when others then
    update render_internal.render_job_runtime_uploads set status = 'failed', updated_at = now() where render_job_id = p_job_id;
    raise exception 'runtime manifest is not valid UTF-8';
  end;
  if left(ltrim(assembled_text), 1) <> '{' or right(rtrim(assembled_text), 1) <> '}' then
    update render_internal.render_job_runtime_uploads set status = 'failed', updated_at = now() where render_job_id = p_job_id;
    raise exception 'runtime manifest must be a JSON object';
  end if;
  if exists (select 1 from public.render_jobs where id = p_job_id and (runtime_json is not null or runtime_manifest_text is not null)) then
    raise exception 'render job already has a committed runtime manifest';
  end if;

  update public.render_jobs set runtime_manifest_text = assembled_text, updated_at = now() where id = p_job_id;
  update render_internal.render_job_runtime_uploads set status = 'committed', updated_at = now() where render_job_id = p_job_id;
  delete from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id;
  return jsonb_build_object('status', 'committed', 'bytes', upload.total_bytes, 'sha256', upload.sha256);
end;
$$;

revoke all on function public.render_job_runtime_upload_commit(uuid) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_commit(uuid) to service_role;
