-- Phase 5.1: atomically initialize the immutable chunk manifest.
-- Only the server-side service role may call this function. End users can
-- inspect chunk state through the RLS policy created in the previous migration.

create or replace function public.render_job_initialize_chunks(
  p_job_id uuid,
  p_manifest jsonb,
  p_manifest_checksum text,
  p_chunk_size integer,
  p_chunk_count integer,
  p_chunk_parallelism integer,
  p_chunks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_checksum text;
  inserted_count integer;
begin
  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object' then
    raise exception 'render chunk manifest must be a JSON object';
  end if;
  if p_manifest_checksum is null or length(trim(p_manifest_checksum)) = 0 then
    raise exception 'render chunk manifest checksum is required';
  end if;
  if p_chunk_size is null or p_chunk_size <= 0 then
    raise exception 'render chunk size must be positive';
  end if;
  if p_chunk_count is null or p_chunk_count <= 0 then
    raise exception 'render chunk count must be positive';
  end if;
  if p_chunk_parallelism is null or p_chunk_parallelism <= 0 then
    raise exception 'render chunk parallelism must be positive';
  end if;
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'render chunks must be a JSON array';
  end if;
  if jsonb_array_length(p_chunks) <> p_chunk_count then
    raise exception 'render chunk count does not match chunk rows';
  end if;

  select chunk_manifest_checksum
    into existing_checksum
    from public.render_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'render job % does not exist', p_job_id;
  end if;

  if existing_checksum is not null then
    if existing_checksum <> p_manifest_checksum then
      raise exception 'render job chunk manifest is immutable';
    end if;
    return jsonb_build_object(
      'initialized', false,
      'checksum', existing_checksum,
      'chunkCount', p_chunk_count
    );
  end if;

  update public.render_jobs
     set chunk_manifest_json = p_manifest,
         chunk_manifest_checksum = p_manifest_checksum,
         chunk_size = p_chunk_size,
         chunk_count = p_chunk_count,
         chunk_parallelism = p_chunk_parallelism,
         updated_at = now()
   where id = p_job_id;

  insert into public.render_job_chunks (
    render_job_id,
    chunk_index,
    start_frame,
    end_frame_exclusive,
    attempt,
    status,
    runtime_checksum,
    asset_versions_json,
    metrics_json
  )
  select
    p_job_id,
    chunk.chunk_index,
    chunk.start_frame,
    chunk.end_frame_exclusive,
    chunk.attempt,
    chunk.status,
    chunk.runtime_checksum,
    chunk.asset_versions_json,
    chunk.metrics_json
  from jsonb_to_recordset(p_chunks) as chunk(
    chunk_index integer,
    start_frame integer,
    end_frame_exclusive integer,
    attempt integer,
    status text,
    runtime_checksum text,
    asset_versions_json jsonb,
    metrics_json jsonb
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> p_chunk_count then
    raise exception 'render chunk insert count does not match manifest';
  end if;

  return jsonb_build_object(
    'initialized', true,
    'checksum', p_manifest_checksum,
    'chunkCount', inserted_count
  );
end;
$$;

revoke all on function public.render_job_initialize_chunks(uuid, jsonb, text, integer, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.render_job_initialize_chunks(uuid, jsonb, text, integer, integer, integer, jsonb) to service_role;
