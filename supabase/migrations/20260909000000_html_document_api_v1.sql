-- HTML-first source revisions for the versioned Web API.
-- Protocol V2 editor revisions remain unchanged and continue to use
-- public.project_revisions.document_json.

alter table public.projects
  add column if not exists source_format text not null default 'protocol-v2';

alter table public.projects
  drop constraint if exists projects_source_format_check;

alter table public.projects
  add constraint projects_source_format_check
  check (source_format in ('protocol-v2', 'html'));

create table if not exists public.project_html_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  revision_no integer not null check (revision_no >= 1),
  document_html text not null check (char_length(document_html) > 0),
  content_hash text not null,
  document_schema_version integer not null default 2 check (document_schema_version >= 1),
  composition_json jsonb not null check (jsonb_typeof(composition_json) = 'object'),
  diagnostics_json jsonb not null default '[]'::jsonb check (jsonb_typeof(diagnostics_json) = 'array'),
  byte_size integer not null check (byte_size > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, revision_no)
);

create index if not exists project_html_revisions_project_idx
  on public.project_html_revisions (project_id, revision_no desc);

alter table public.project_html_revisions enable row level security;

drop policy if exists project_html_revisions_select_member on public.project_html_revisions;
create policy project_html_revisions_select_member on public.project_html_revisions
for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.has_workspace_role(p.workspace_id, 'viewer')
  )
);

drop policy if exists project_html_revisions_insert_editor on public.project_html_revisions;
create policy project_html_revisions_insert_editor on public.project_html_revisions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_id and public.has_workspace_role(p.workspace_id, 'editor')
  )
);

grant select, insert on public.project_html_revisions to authenticated;
