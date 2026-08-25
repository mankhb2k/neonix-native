-- Phase 1: identity, workspace ownership, project revisions and RLS.
-- Media binaries remain outside Postgres (R2 is a later phase).

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique default ('prj_' || encode(gen_random_bytes(10), 'hex')),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null default 'Untitled project' check (char_length(trim(title)) between 1 and 200),
  current_revision_no integer not null default 0 check (current_revision_no >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  revision_no integer not null check (revision_no >= 1),
  document_json jsonb not null check (jsonb_typeof(document_json) = 'object'),
  content_hash text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, revision_no)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  r2_key text not null unique,
  content_hash text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique default ('rnd_' || encode(gen_random_bytes(10), 'hex')),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  revision_id uuid not null references public.project_revisions (id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'failed', 'cancelled')),
  preset_json jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  provider_render_id text,
  output_key text,
  error_code text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_id, idempotency_key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_client_id text,
  action text not null,
  target_type text,
  target_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members (user_id);
create index projects_workspace_idx on public.projects (workspace_id);
create index project_revisions_project_idx on public.project_revisions (project_id, revision_no desc);
create index assets_workspace_idx on public.assets (workspace_id);
create index render_jobs_workspace_idx on public.render_jobs (workspace_id, created_at desc);
create index audit_events_workspace_idx on public.audit_events (workspace_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_workspace_created
after insert on public.workspaces
for each row execute function public.handle_new_workspace();

create or replace function public.has_workspace_role(
  requested_workspace_id uuid,
  minimum_role text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = requested_workspace_id
      and wm.user_id = (select auth.uid())
      and case minimum_role
        when 'owner' then wm.role = 'owner'
        when 'editor' then wm.role in ('owner', 'editor')
        else wm.role in ('owner', 'editor', 'viewer')
      end
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;
alter table public.assets enable row level security;
alter table public.render_jobs enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy workspaces_select_member on public.workspaces
for select to authenticated
using (public.has_workspace_role(id, 'viewer'));

create policy workspaces_insert_self on public.workspaces
for insert to authenticated
with check (created_by = (select auth.uid()));

create policy workspaces_update_editor on public.workspaces
for update to authenticated
using (public.has_workspace_role(id, 'editor'))
with check (public.has_workspace_role(id, 'editor'));

create policy workspace_members_select_member on public.workspace_members
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy workspace_members_insert_owner on public.workspace_members
for insert to authenticated
with check (public.has_workspace_role(workspace_id, 'owner'));

create policy workspace_members_update_owner on public.workspace_members
for update to authenticated
using (public.has_workspace_role(workspace_id, 'owner'))
with check (public.has_workspace_role(workspace_id, 'owner'));

create policy workspace_members_delete_owner on public.workspace_members
for delete to authenticated
using (public.has_workspace_role(workspace_id, 'owner'));

create policy projects_select_member on public.projects
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy projects_insert_editor on public.projects
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

create policy projects_update_editor on public.projects
for update to authenticated
using (public.has_workspace_role(workspace_id, 'editor'))
with check (public.has_workspace_role(workspace_id, 'editor'));

create policy revisions_select_member on public.project_revisions
for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.has_workspace_role(p.workspace_id, 'viewer')
  )
);

create policy revisions_insert_editor on public.project_revisions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_id and public.has_workspace_role(p.workspace_id, 'editor')
  )
);

create policy assets_select_member on public.assets
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy assets_insert_editor on public.assets
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

create policy assets_delete_editor on public.assets
for delete to authenticated
using (public.has_workspace_role(workspace_id, 'editor'));

create policy render_jobs_select_member on public.render_jobs
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy render_jobs_insert_editor on public.render_jobs
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

create policy audit_events_select_member on public.audit_events
for select to authenticated
using (workspace_id is not null and public.has_workspace_role(workspace_id, 'viewer'));

create policy audit_events_insert_self on public.audit_events
for insert to authenticated
with check (actor_user_id = (select auth.uid()));

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert on public.project_revisions to authenticated;
grant select, insert, delete on public.assets to authenticated;
grant select, insert on public.render_jobs to authenticated;
grant select, insert on public.audit_events to authenticated;
