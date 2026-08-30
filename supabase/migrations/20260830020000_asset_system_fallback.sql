-- Replace references to a user asset with a compatible static system asset
-- before the user asset is soft-deleted. Project revisions stay immutable by
-- appending an asset_replacement revision.

alter table public.project_revisions
  drop constraint if exists project_revisions_reason_check;

alter table public.project_revisions
  add constraint project_revisions_reason_check
    check (reason in ('manual', 'autosave', 'mcp', 'import', 'restore', 'asset_replacement'));

create or replace function public.replace_json_asset_id(
  input jsonb,
  old_asset_id text,
  replacement_asset_id text
)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  result jsonb;
begin
  if input is null then
    return null;
  end if;

  case jsonb_typeof(input)
    when 'object' then
      select coalesce(
        jsonb_object_agg(key, public.replace_json_asset_id(value, old_asset_id, replacement_asset_id)),
        '{}'::jsonb
      )
      into result
      from jsonb_each(input);
      return result;
    when 'array' then
      select coalesce(
        jsonb_agg(public.replace_json_asset_id(value, old_asset_id, replacement_asset_id)),
        '[]'::jsonb
      )
      into result
      from jsonb_array_elements(input);
      return result;
    when 'string' then
      if input #>> '{}' in (old_asset_id, 'asset-' || old_asset_id) then
        return to_jsonb(replacement_asset_id);
      end if;
      return input;
    else
      return input;
  end case;
end;
$$;

create or replace function public.delete_asset_with_system_fallback(target_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_row public.assets%rowtype;
  fallback_row public.system_assets%rowtype;
  project_row record;
  revision_row record;
  replacement_document jsonb;
  fallback_id text;
  replacement_projects jsonb := '[]'::jsonb;
  replaced_project_count integer := 0;
begin
  select *
  into asset_row
  from public.assets
  where id = target_asset_id
    and created_by = auth.uid()
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Asset not found or access denied';
  end if;

  if asset_row.kind = 'video' then
    fallback_id := 'system:video-placeholder';
  elsif asset_row.kind = 'audio' then
    fallback_id := 'system:audio-silence';
  elsif asset_row.kind = 'image' and asset_row.mime_type = 'image/svg+xml' then
    fallback_id := 'system:svg-placeholder';
  elsif asset_row.kind = 'image' then
    fallback_id := 'system:image-placeholder';
  else
    raise exception 'Asset kind cannot be replaced automatically';
  end if;

  select *
  into fallback_row
  from public.system_assets
  where id = fallback_id
    and parent_id is null
    and variant_kind = 'origin'
    and enabled;

  if not found then
    raise exception 'System fallback asset is not configured: %', fallback_id;
  end if;

  for project_row in
    select distinct p.id, p.title, p.public_ref
    from public.project_assets pa
    join public.projects p on p.id = pa.project_id
    where pa.asset_id = target_asset_id
      and p.deleted_at is null
      and p.workspace_id = asset_row.workspace_id
    order by p.id
  loop
    perform 1
    from public.projects
    where id = project_row.id
    for update;

    select pr.document_json, pr.revision_no
    into revision_row
    from public.project_revisions pr
    where pr.project_id = project_row.id
    order by pr.revision_no desc
    limit 1;

    if found then
      replacement_document := public.replace_json_asset_id(
        revision_row.document_json,
        asset_row.id::text,
        fallback_row.id
      );

      if replacement_document is distinct from revision_row.document_json then
        insert into public.project_revisions (
          project_id,
          revision_no,
          document_json,
          content_hash,
          source_schema_version,
          reason,
          byte_size,
          created_by
        )
        values (
          project_row.id,
          revision_row.revision_no + 1,
          replacement_document,
          encode(extensions.digest(convert_to(replacement_document::text, 'utf8'), 'sha256'), 'hex'),
          2,
          'asset_replacement',
          octet_length(replacement_document::text),
          auth.uid()
        );
      end if;
    end if;

    delete from public.project_assets
    where project_id = project_row.id
      and asset_id = target_asset_id;

    replaced_project_count := replaced_project_count + 1;
    replacement_projects := replacement_projects || jsonb_build_array(
      jsonb_build_object(
        'id', project_row.id,
        'title', project_row.title,
        'publicRef', project_row.public_ref
      )
    );
  end loop;

  delete from public.project_assets where asset_id = target_asset_id;
  delete from public.upload_sessions where asset_id = target_asset_id;

  update public.media_jobs
  set status = 'failed',
      last_error = 'asset_deleted',
      completed_at = coalesce(completed_at, now())
  where asset_id = target_asset_id
    and status in ('queued', 'processing');

  delete from public.asset_variants where asset_id = target_asset_id;

  update public.assets
  set status = 'deleted',
      deleted_at = coalesce(deleted_at, now()),
      preview_status = case when preview_status is null then null else 'failed' end,
      preview_error = 'asset_deleted'
  where id = target_asset_id;

  return jsonb_build_object(
    'assetId', target_asset_id,
    'replacementSystemAssetId', fallback_row.id,
    'replacedProjectCount', replaced_project_count,
    'projects', replacement_projects
  );
end;
$$;

revoke all on function public.replace_json_asset_id(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.delete_asset_with_system_fallback(uuid) from public, anon, authenticated;
grant execute on function public.delete_asset_with_system_fallback(uuid) to authenticated;

