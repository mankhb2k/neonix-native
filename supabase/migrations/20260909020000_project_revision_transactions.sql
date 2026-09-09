-- Atomic persistence for HTML authoring revisions.
-- The compiler runs in the application; this function commits the resulting
-- Protocol V2 JSON and its HTML source in one database transaction.

create or replace function public.commit_html_revision(
  p_project_id uuid,
  p_document_html text,
  p_document_json jsonb,
  p_composition_json jsonb,
  p_diagnostics_json jsonb,
  p_html_content_hash text,
  p_html_byte_size integer,
  p_json_content_hash text,
  p_json_byte_size integer,
  p_document_schema_version integer,
  p_expected_protocol_revision_no integer default null,
  p_expected_html_revision_no integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  project_row public.projects%rowtype;
  latest_html_revision_no integer;
  next_revision_no integer;
  protocol_revision_id uuid;
  html_revision_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_document_json) <> 'object'
    or jsonb_typeof(p_composition_json) <> 'object'
    or jsonb_typeof(p_diagnostics_json) <> 'array' then
    raise exception 'Invalid revision payload' using errcode = 'P0001';
  end if;

  select * into project_row
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found or not public.has_workspace_role(project_row.workspace_id, 'editor') then
    raise exception 'Project not found or access denied' using errcode = 'P0001';
  end if;

  if p_expected_protocol_revision_no is not null
    and project_row.current_revision_no <> p_expected_protocol_revision_no then
    raise exception 'Project revision conflict' using errcode = 'P0002';
  end if;

  select coalesce(max(revision_no), 0)
    into latest_html_revision_no
  from public.project_html_revisions
  where project_id = p_project_id;

  if p_expected_html_revision_no is not null
    and latest_html_revision_no <> p_expected_html_revision_no then
    raise exception 'HTML revision conflict' using errcode = 'P0002';
  end if;

  next_revision_no := project_row.current_revision_no + 1;

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
    p_project_id,
    next_revision_no,
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
    p_project_id,
    next_revision_no,
    protocol_revision_id,
    p_document_html,
    p_html_content_hash,
    p_document_schema_version,
    p_composition_json,
    p_diagnostics_json,
    p_html_byte_size,
    current_user_id
  ) returning id into html_revision_id;

  update public.projects
  set current_revision_no = next_revision_no,
      source_format = 'html',
      last_activity_at = now(),
      updated_at = now()
  where id = p_project_id;

  return jsonb_build_object(
    'projectId', p_project_id,
    'revisionNo', next_revision_no,
    'protocolRevisionId', protocol_revision_id,
    'htmlRevisionId', html_revision_id
  );
end;
$$;

grant execute on function public.commit_html_revision(
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  integer,
  text,
  integer,
  integer,
  integer,
  integer
) to authenticated;

