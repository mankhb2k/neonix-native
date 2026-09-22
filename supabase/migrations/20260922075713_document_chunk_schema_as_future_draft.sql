comment on table public.render_job_chunks is
  'Draft coordinator contract for the future indexed chunk-render feature. Not part of the current MVP render flow: the app always creates and renders a single Cloud Run job. Only populated when RENDER_CHUNK_EXECUTION_ENABLED=true, which is false in every environment as of 2026-09-22. Expect the chunking design to change before this is turned on.';

comment on column public.render_jobs.chunk_manifest_json is
  'Draft chunk-render field, currently unused. See comment on public.render_job_chunks.';
comment on column public.render_jobs.chunk_manifest_checksum is
  'Draft chunk-render field, currently unused. See comment on public.render_job_chunks.';
comment on column public.render_jobs.chunk_size is
  'Draft chunk-render field, currently unused. See comment on public.render_job_chunks.';
comment on column public.render_jobs.chunk_count is
  'Draft chunk-render field, currently unused. See comment on public.render_job_chunks.';
comment on column public.render_jobs.chunk_parallelism is
  'Draft chunk-render field, currently unused. See comment on public.render_job_chunks.';
