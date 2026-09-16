-- Cleanup must never remove committed upload metadata from a live job. The
-- immutable manifest is retained, but staging metadata is eligible only after
-- the parent is terminal (or the upload itself failed).

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
     select uploads.render_job_id
       from render_internal.render_job_runtime_uploads uploads
       left join public.render_jobs jobs on jobs.id = uploads.render_job_id
      where uploads.status in ('committed', 'failed')
        and uploads.updated_at < now() - make_interval(secs => age_seconds)
        and (uploads.status = 'failed' or jobs.status in ('done', 'failed', 'cancelled'))
      order by uploads.updated_at
      limit row_limit
   ) candidates
   where chunks.render_job_id = candidates.render_job_id;
  get diagnostics chunk_rows = row_count;

  delete from render_internal.render_job_runtime_uploads uploads
   using public.render_jobs jobs
   where jobs.id = uploads.render_job_id
     and uploads.status in ('committed', 'failed')
     and uploads.updated_at < now() - make_interval(secs => age_seconds)
     and (uploads.status = 'failed' or jobs.status in ('done', 'failed', 'cancelled'))
     and uploads.render_job_id in (
       select eligible.render_job_id
         from render_internal.render_job_runtime_uploads eligible
         left join public.render_jobs eligible_jobs on eligible_jobs.id = eligible.render_job_id
        where eligible.status in ('committed', 'failed')
          and eligible.updated_at < now() - make_interval(secs => age_seconds)
          and (eligible.status = 'failed' or eligible_jobs.status in ('done', 'failed', 'cancelled'))
        order by eligible.updated_at
        limit row_limit
     );
  get diagnostics upload_rows = row_count;
  return jsonb_build_object('chunkRowsDeleted', chunk_rows, 'uploadRowsDeleted', upload_rows, 'retentionSeconds', age_seconds);
end;
$$;

revoke all on function public.render_job_runtime_upload_cleanup(integer, integer) from public, anon, authenticated;
grant execute on function public.render_job_runtime_upload_cleanup(integer, integer) to service_role;
