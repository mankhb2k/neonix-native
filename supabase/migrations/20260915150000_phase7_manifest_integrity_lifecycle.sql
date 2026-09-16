-- Phase 7: make the runtime manifest immutable after commit and retain only
-- the metadata needed for audit. The worker verifies the whole payload while
-- reading bounded chunks; SQL never concatenates a large manifest.

alter table public.render_jobs
  add column if not exists runtime_manifest_sha256 text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'render_jobs_runtime_manifest_sha256_check'
       and conrelid = 'public.render_jobs'::regclass
  ) then
    alter table public.render_jobs
      add constraint render_jobs_runtime_manifest_sha256_check
      check (runtime_manifest_sha256 is null or runtime_manifest_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;

-- Repair manifests committed by the earlier RPC: promote their staging rows
-- before changing the reader, then remove the duplicate staging payloads.
insert into render_internal.render_job_runtime_manifest_chunks
  (render_job_id, chunk_index, chunk_count, payload)
select uploads.render_job_id, chunks.chunk_index, uploads.chunk_count, chunks.payload
  from render_internal.render_job_runtime_uploads uploads
  join render_internal.render_job_runtime_upload_chunks chunks
    on chunks.render_job_id = uploads.render_job_id
 where uploads.status = 'committed'
on conflict (render_job_id, chunk_index) do nothing;

update public.render_jobs jobs
   set runtime_manifest_chunk_count = uploads.chunk_count,
       runtime_manifest_sha256 = coalesce(jobs.runtime_manifest_sha256, uploads.sha256),
       updated_at = now()
  from render_internal.render_job_runtime_uploads uploads
 where uploads.render_job_id = jobs.id
   and uploads.status = 'committed'
   and jobs.runtime_json is null;

delete from render_internal.render_job_runtime_upload_chunks chunks
 using render_internal.render_job_runtime_uploads uploads
 where uploads.render_job_id = chunks.render_job_id
   and uploads.status = 'committed';

create or replace function public.render_job_runtime_manifest_get_chunk(p_job_id uuid, p_chunk_index integer)
returns table(payload_base64 text)
language sql security definer set search_path = render_internal, public
as $$
  select encode(payload, 'base64')
    from render_internal.render_job_runtime_manifest_chunks
   where render_job_id = p_job_id
     and chunk_index = p_chunk_index;
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

-- Removes staging payloads and old upload metadata after the retention window.
-- The committed manifest and its SHA remain on render_jobs/manifest_chunks.
create or replace function public.render_job_runtime_upload_cleanup(p_older_than_seconds integer default 604800, p_limit integer default 500)
returns jsonb
language plpgsql security definer set search_path = render_internal, public
as $$
declare
  age_seconds integer := greatest(0, least(p_older_than_seconds, 2592000));
  row_limit integer := greatest(1, least(p_limit, 5000));
  chunk_rows integer := 0;
  upload_rows integer := 0;
begin
  delete from render_internal.render_job_runtime_upload_chunks chunks
   using (
     select render_job_id
       from render_internal.render_job_runtime_uploads
      where status in ('committed', 'failed')
        and updated_at < now() - make_interval(secs => age_seconds)
      order by updated_at
      limit row_limit
   ) candidates
   where chunks.render_job_id = candidates.render_job_id;
  get diagnostics chunk_rows = row_count;

  delete from render_internal.render_job_runtime_uploads uploads
   where uploads.status in ('committed', 'failed')
     and uploads.updated_at < now() - make_interval(secs => age_seconds)
     and uploads.render_job_id in (
       select render_job_id
         from render_internal.render_job_runtime_uploads
        where status in ('committed', 'failed')
          and updated_at < now() - make_interval(secs => age_seconds)
        order by updated_at
        limit row_limit
     );
  get diagnostics upload_rows = row_count;
  return jsonb_build_object('chunkRowsDeleted', chunk_rows, 'uploadRowsDeleted', upload_rows, 'retentionSeconds', age_seconds);
end;
$$;

revoke all on function public.render_job_runtime_upload_cleanup(integer, integer) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_cleanup(integer, integer) to service_role;
