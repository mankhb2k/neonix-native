-- Phase 6: persist large Runtime V3 manifests without sending one oversized
-- PostgREST row insert. The canonical, committed value still lives in
-- public.render_jobs.runtime_json; this private schema is upload staging only.

create extension if not exists pgcrypto;

create schema if not exists render_internal;
revoke all on schema render_internal from public, anon, authenticated;

create table if not exists render_internal.render_job_runtime_uploads (
  render_job_id uuid primary key references public.render_jobs(id) on delete cascade,
  total_bytes bigint not null check (total_bytes > 0 and total_bytes <= 268435456),
  chunk_size integer not null check (chunk_size between 65536 and 1048576),
  chunk_count integer not null check (chunk_count > 0 and chunk_count <= 4096),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploading' check (status in ('uploading', 'committed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists render_internal.render_job_runtime_upload_chunks (
  render_job_id uuid not null references render_internal.render_job_runtime_uploads(render_job_id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0 and chunk_index < 4096),
  payload bytea not null check (octet_length(payload) > 0 and octet_length(payload) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (render_job_id, chunk_index)
);

alter table render_internal.render_job_runtime_uploads enable row level security;
alter table render_internal.render_job_runtime_upload_chunks enable row level security;

drop policy if exists render_job_runtime_uploads_deny_client on render_internal.render_job_runtime_uploads;
create policy render_job_runtime_uploads_deny_client
  on render_internal.render_job_runtime_uploads
  for all to public using (false) with check (false);

drop policy if exists render_job_runtime_upload_chunks_deny_client on render_internal.render_job_runtime_upload_chunks;
create policy render_job_runtime_upload_chunks_deny_client
  on render_internal.render_job_runtime_upload_chunks
  for all to public using (false) with check (false);

create or replace function public.render_job_runtime_upload_begin(
  p_job_id uuid,
  p_total_bytes bigint,
  p_chunk_size integer,
  p_chunk_count integer,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = render_internal, public
as $$
declare
  existing render_internal.render_job_runtime_uploads;
  expected_chunks integer;
begin
  if not exists (select 1 from public.render_jobs where id = p_job_id) then
    raise exception 'render job does not exist';
  end if;
  if p_total_bytes is null or p_total_bytes <= 0 or p_total_bytes > 268435456 then
    raise exception 'runtime manifest size is outside the allowed range';
  end if;
  if p_chunk_size is null or p_chunk_size < 65536 or p_chunk_size > 1048576 then
    raise exception 'runtime manifest chunk size is outside the allowed range';
  end if;
  expected_chunks := ceil(p_total_bytes::numeric / p_chunk_size)::integer;
  if p_chunk_count is null or p_chunk_count <> expected_chunks or p_chunk_count > 4096 then
    raise exception 'runtime manifest chunk count is invalid';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'runtime manifest checksum is invalid';
  end if;

  select * into existing
    from render_internal.render_job_runtime_uploads
   where render_job_id = p_job_id
   for update;

  if found then
    if existing.total_bytes <> p_total_bytes
      or existing.chunk_size <> p_chunk_size
      or existing.chunk_count <> p_chunk_count
      or existing.sha256 <> p_sha256 then
      raise exception 'runtime manifest upload parameters are immutable';
    end if;
    return jsonb_build_object('status', existing.status, 'chunkCount', existing.chunk_count, 'received', (select count(*) from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id));
  end if;

  insert into render_internal.render_job_runtime_uploads(render_job_id, total_bytes, chunk_size, chunk_count, sha256)
  values (p_job_id, p_total_bytes, p_chunk_size, p_chunk_count, p_sha256);
  return jsonb_build_object('status', 'uploading', 'chunkCount', p_chunk_count, 'received', 0);
end;
$$;

create or replace function public.render_job_runtime_upload_put(
  p_job_id uuid,
  p_chunk_index integer,
  p_chunk_base64 text
)
returns jsonb
language plpgsql
security definer
set search_path = render_internal, public
as $$
declare
  upload render_internal.render_job_runtime_uploads;
  decoded bytea;
  existing bytea;
  received integer;
begin
  select * into upload
    from render_internal.render_job_runtime_uploads
   where render_job_id = p_job_id
   for update;
  if not found then raise exception 'runtime manifest upload has not started'; end if;
  if upload.status <> 'uploading' then raise exception 'runtime manifest upload is not writable'; end if;
  if p_chunk_index is null or p_chunk_index < 0 or p_chunk_index >= upload.chunk_count then
    raise exception 'runtime manifest chunk index is invalid';
  end if;
  if p_chunk_base64 is null or length(p_chunk_base64) = 0 then
    raise exception 'runtime manifest chunk is empty';
  end if;
  begin
    decoded := decode(p_chunk_base64, 'base64');
  exception when others then
    raise exception 'runtime manifest chunk is not valid base64';
  end;
  if octet_length(decoded) = 0 or octet_length(decoded) > upload.chunk_size then
    raise exception 'runtime manifest chunk size is invalid';
  end if;

  select payload into existing
    from render_internal.render_job_runtime_upload_chunks
   where render_job_id = p_job_id and chunk_index = p_chunk_index;
  if found and existing <> decoded then
    raise exception 'runtime manifest chunk is immutable';
  end if;
  if not found then
    insert into render_internal.render_job_runtime_upload_chunks(render_job_id, chunk_index, payload)
    values (p_job_id, p_chunk_index, decoded);
  end if;
  update render_internal.render_job_runtime_uploads set updated_at = now() where render_job_id = p_job_id;
  select count(*) into received from render_internal.render_job_runtime_upload_chunks where render_job_id = p_job_id;
  return jsonb_build_object('status', 'uploading', 'chunkIndex', p_chunk_index, 'received', received, 'chunkCount', upload.chunk_count);
end;
$$;

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
  actual_sha256 := encode(digest(assembled, 'sha256'), 'hex');
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

revoke all on function public.render_job_runtime_upload_begin(uuid, bigint, integer, integer, text) from public, anon, authenticated;
revoke all on function public.render_job_runtime_upload_put(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.render_job_runtime_upload_commit(uuid) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_begin(uuid, bigint, integer, integer, text) to service_role;
grant execute on function public.render_job_runtime_upload_put(uuid, integer, text) to service_role;
grant execute on function public.render_job_runtime_upload_commit(uuid) to service_role;
