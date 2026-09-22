-- Drains the object_deletion_jobs outbox that was designed in the original
-- retention migration but never had a producer or consumer. Also gives
-- soft-deleted projects a real purge path once their 7-day window elapses.

create or replace function public.purge_expired_projects()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project record;
  v_count integer := 0;
begin
  for v_project in
    select id from public.projects
    where deleted_at is not null and purge_after <= now()
    for update skip locked
  loop
    -- Render exports are the only R2 objects a project directly owns;
    -- assets/asset_variants belong to the workspace and keep their own
    -- independent deletion lifecycle (deleteAsset), so they are not touched
    -- here even though project_assets links cascade away with the project.
    insert into public.object_deletion_jobs (storage_bucket, object_key, entity_type, entity_id)
    select 'neonix-user-exports', rj.output_key, 'project_export', rj.id
    from public.render_jobs rj
    where rj.project_id = v_project.id and rj.output_key is not null
    on conflict (storage_bucket, object_key) do nothing;

    delete from public.projects where id = v_project.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.reap_expired_upload_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select us.id as session_id, a.id as asset_id, a.r2_key, a.storage_bucket, a.status as asset_status
    from public.upload_sessions us
    join public.assets a on a.id = us.asset_id
    where us.status = 'pending' and us.expires_at < now()
    for update of us skip locked
  loop
    if v_row.asset_status = 'uploading' and v_row.r2_key is not null then
      insert into public.object_deletion_jobs (storage_bucket, object_key, entity_type, entity_id)
      values (v_row.storage_bucket, v_row.r2_key, 'upload', v_row.asset_id)
      on conflict (storage_bucket, object_key) do nothing;

      update public.assets set status = 'failed' where id = v_row.asset_id;
    end if;

    update public.upload_sessions set status = 'expired' where id = v_row.session_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.claim_object_deletion_jobs(p_limit integer default 25)
returns setof public.object_deletion_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.object_deletion_jobs
    set status = 'running', locked_at = now()
    where id in (
      select id from public.object_deletion_jobs
      where status = 'queued' and run_after <= now()
      order by created_at
      limit greatest(1, p_limit)
      for update skip locked
    )
    returning *;
end;
$$;

create or replace function public.complete_object_deletion_job(p_id uuid, p_success boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt integer;
begin
  if p_success then
    update public.object_deletion_jobs
    set status = 'succeeded', completed_at = now(), last_error = null
    where id = p_id;
    return;
  end if;

  update public.object_deletion_jobs
  set attempt_count = attempt_count + 1
  where id = p_id
  returning attempt_count into v_attempt;

  if v_attempt is null then
    return;
  end if;

  if v_attempt >= 5 then
    update public.object_deletion_jobs
    set status = 'failed', last_error = p_error
    where id = p_id;
  else
    update public.object_deletion_jobs
    set status = 'queued', run_after = now() + (power(2, v_attempt) || ' minutes')::interval, last_error = p_error
    where id = p_id;
  end if;
end;
$$;

revoke execute on function public.purge_expired_projects() from anon, authenticated;
revoke execute on function public.reap_expired_upload_sessions() from anon, authenticated;
revoke execute on function public.claim_object_deletion_jobs(integer) from anon, authenticated;
revoke execute on function public.complete_object_deletion_job(uuid, boolean, text) from anon, authenticated;
