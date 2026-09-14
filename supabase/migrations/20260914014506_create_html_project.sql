-- Create an HTML-authored project and its first linked Protocol V2 revision
-- atomically. The HTML compiler runs in the application; this function only
-- persists the validated compiler output and authoring source.

alter table public.project_revisions
  drop constraint if exists project_revisions_reason_check;

alter table public.project_revisions
  add constraint project_revisions_reason_check
    check (reason in ('manual', 'autosave', 'mcp', 'import', 'html-import', 'restore', 'asset_replacement'));

alter table public.projects
  add column if not exists create_idempotency_key text,
  add column if not exists create_idempotency_hash text;

create unique index if not exists projects_create_idempotency_uidx
  on public.projects (workspace_id, create_idempotency_key)
  where create_idempotency_key is not null and deleted_at is null;

create or replace function public.create_html_project(
  p_workspace_id uuid,
  p_title text,
  p_document_html text,
  p_document_json jsonb,
  p_composition_json jsonb,
  p_diagnostics_json jsonb,
  p_html_content_hash text,
  p_html_byte_size integer,
  p_json_content_hash text,
  p_json_byte_size integer,
  p_document_schema_version integer,
  p_asset_ids uuid[] default '{}'::uuid[],
  p_idempotency_key text default null,
  p_idempotency_hash text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  project_row public.projects%rowtype;
  protocol_revision_id uuid;
  html_revision_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if not public.has_workspace_role(p_workspace_id, 'editor') then
    raise exception 'Workspace not found or access denied' using errcode = 'P0001';
  end if;

  if p_title is null or char_length(trim(p_title)) = 0 then
    p_title := 'Untitled project';
  end if;

  if p_document_html is null or char_length(trim(p_document_html)) = 0
    or jsonb_typeof(p_document_json) <> 'object'
    or jsonb_typeof(p_composition_json) <> 'object'
    or jsonb_typeof(p_diagnostics_json) <> 'array' then
    raise exception 'Invalid HTML project payload' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as requested(asset_id)
    left join public.assets asset
      on asset.id = requested.asset_id
      and asset.workspace_id = p_workspace_id
      and asset.deleted_at is null
    where asset.id is null
  ) then
    raise exception 'One or more project assets are not available' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into project_row
    from public.projects
    where workspace_id = p_workspace_id
      and create_idempotency_key = p_idempotency_key
      and deleted_at is null;

    if found then
      if p_idempotency_hash is not null and project_row.create_idempotency_hash is distinct from p_idempotency_hash then
        raise exception 'Idempotency key was already used with a different payload' using errcode = 'P0001';
      end if;

      select id into protocol_revision_id
      from public.project_revisions
      where project_id = project_row.id and revision_no = 1;
      select id into html_revision_id
      from public.project_html_revisions
      where project_id = project_row.id and revision_no = 1;
      return jsonb_build_object(
        'projectId', project_row.id,
        'revisionNo', 1,
        'protocolRevisionId', protocol_revision_id,
        'htmlRevisionId', html_revision_id,
        'alreadyCreated', true
      );
    end if;
  end if;

  insert into public.projects (
    workspace_id,
    title,
    created_by,
    current_revision_no,
    source_format,
    create_idempotency_key,
    create_idempotency_hash
  ) values (
    p_workspace_id,
    trim(p_title),
    current_user_id,
    0,
    'html',
    p_idempotency_key,
    p_idempotency_hash
  ) returning * into project_row;

  insert into public.project_revisions (
    project_id,
    revision_no,
    document_json,
    content_hash,
    source_schema_version,
    reason,
    byte_size,
    created_by
  ) values (
    project_row.id,
    1,
    p_document_json,
    p_json_content_hash,
    p_document_schema_version,
    'html-import',
    p_json_byte_size,
    current_user_id
  ) returning id into protocol_revision_id;

  insert into public.project_html_revisions (
    project_id,
    revision_no,
    protocol_revision_id,
    document_html,
    content_hash,
    document_schema_version,
    composition_json,
    diagnostics_json,
    byte_size,
    created_by
  ) values (
    project_row.id,
    1,
    protocol_revision_id,
    p_document_html,
    p_html_content_hash,
    p_document_schema_version,
    p_composition_json,
    p_diagnostics_json,
    p_html_byte_size,
    current_user_id
  ) returning id into html_revision_id;

  insert into public.project_assets (project_id, asset_id, attached_by)
  select project_row.id, requested.asset_id, current_user_id
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as requested(asset_id)
  on conflict (project_id, asset_id) do nothing;

  update public.projects
  set current_revision_no = 1,
      last_activity_at = now(),
      updated_at = now()
  where id = project_row.id;

  return jsonb_build_object(
    'projectId', project_row.id,
    'revisionNo', 1,
    'protocolRevisionId', protocol_revision_id,
    'htmlRevisionId', html_revision_id,
    'alreadyCreated', false
  );
end;
$$;

grant execute on function public.create_html_project(
  uuid, text, text, jsonb, jsonb, jsonb, text, integer, text, integer, integer, uuid[], text, text
) to authenticated;
