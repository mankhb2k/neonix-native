-- Kiến trúc B (HTML Frame Render) export job tracking — see ARCHITECHTURE.md
-- "Hai kiến trúc render độc lập". Deliberately a separate table from
-- render_jobs: render_jobs.revision_id hard-FKs to project_revisions, which
-- a raw HTML project (Kiến trúc B) never has. Sharing that table would force
-- a fake JSON revision into existence just to satisfy the FK, blurring the
-- architectural boundary between the two render tracks.

create table public.html_render_jobs (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique default ('hrj_' || encode(extensions.gen_random_bytes(10), 'hex')),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  html_revision_no integer not null check (html_revision_no >= 1),
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'failed', 'cancelled')),
  output_key text,
  error_message text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index html_render_jobs_workspace_idx on public.html_render_jobs (workspace_id, created_at desc);
create index html_render_jobs_project_idx on public.html_render_jobs (project_id, created_at desc);

create trigger html_render_jobs_touch_updated_at
before update on public.html_render_jobs
for each row execute function public.touch_updated_at();

alter table public.html_render_jobs enable row level security;

create policy html_render_jobs_select_member on public.html_render_jobs
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy html_render_jobs_insert_editor on public.html_render_jobs
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

-- Status/output/error transitions are written by the server-side render
-- dispatcher (a trusted process acting as the job's own creator), not by an
-- arbitrary workspace editor — mirrors render_jobs_update_owner.
create policy html_render_jobs_update_owner on public.html_render_jobs
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

grant select, insert, update on public.html_render_jobs to authenticated;
