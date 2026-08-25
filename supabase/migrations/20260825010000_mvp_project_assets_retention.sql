-- Phase 2: project source lifecycle, R2-backed asset metadata, system fonts,
-- and deletion outbox. Binary objects remain in Cloudflare R2, never Postgres.

alter table public.projects
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.projects
  drop constraint if exists projects_lifecycle_check;

alter table public.projects
  add constraint projects_lifecycle_check check (
    (deleted_at is null and purge_after is null)
    or (deleted_at is not null and purge_after is not null and purge_after >= deleted_at)
  );

alter table public.project_revisions
  add column if not exists source_schema_version integer not null default 1 check (source_schema_version >= 1),
  add column if not exists reason text not null default 'manual'
    check (reason in ('manual', 'autosave', 'mcp', 'import', 'restore')),
  add column if not exists byte_size integer;

alter table public.project_revisions
  drop constraint if exists project_revisions_byte_size_check;

alter table public.project_revisions
  add constraint project_revisions_byte_size_check check (byte_size is null or byte_size >= 0);

alter table public.assets
  add column if not exists kind text not null default 'other'
    check (kind in ('image', 'video', 'audio', 'other')),
  add column if not exists status text not null default 'ready'
    check (status in ('uploading', 'ready', 'failed', 'deleting', 'deleted')),
  add column if not exists storage_bucket text not null default 'neonix-user-assets',
  add column if not exists original_filename text,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_json) = 'object'),
  add column if not exists deleted_at timestamptz;

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  variant_kind text not null check (variant_kind in ('thumbnail', 'proxy', 'waveform', 'poster')),
  r2_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  content_hash text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (asset_id, variant_kind)
);

create table if not exists public.project_assets (
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  attached_by uuid not null references auth.users (id) on delete restrict,
  attached_at timestamptz not null default now(),
  primary key (project_id, asset_id)
);

create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  asset_id uuid not null unique references public.assets (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'uploading', 'completed', 'expired', 'failed')),
  expires_at timestamptz not null,
  completed_at timestamptz,
  expected_byte_size bigint check (expected_byte_size is null or expected_byte_size >= 0),
  expected_mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'completed') or completed_at is not null)
);

create table if not exists public.font_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  family_name text not null,
  license text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.font_files (
  id uuid primary key default gen_random_uuid(),
  font_family_id uuid not null references public.font_families (id) on delete cascade,
  version text not null,
  weight integer not null check (weight between 100 and 900),
  style text not null default 'normal' check (style in ('normal', 'italic')),
  format text not null default 'woff2' check (format in ('woff2', 'woff', 'ttf', 'otf')),
  storage_bucket text not null default 'neonix-system-fonts',
  r2_key text not null unique,
  public_url text,
  content_hash text not null,
  byte_size bigint not null check (byte_size >= 0),
  is_default boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (font_family_id, version, weight, style, format)
);

create table if not exists public.object_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null,
  object_key text not null,
  entity_type text not null check (entity_type in ('asset', 'asset_variant', 'project_export', 'upload')),
  entity_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  run_after timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, object_key)
);

create index if not exists projects_active_lifecycle_idx
  on public.projects (last_activity_at asc)
  where deleted_at is null;

create index if not exists projects_workspace_active_idx
  on public.projects (workspace_id, updated_at desc)
  where deleted_at is null;

create index if not exists project_assets_asset_idx
  on public.project_assets (asset_id);

create index if not exists assets_workspace_status_idx
  on public.assets (workspace_id, status, created_at desc)
  where deleted_at is null;

create index if not exists asset_variants_asset_idx
  on public.asset_variants (asset_id);

create index if not exists upload_sessions_expiry_idx
  on public.upload_sessions (expires_at)
  where status in ('pending', 'uploading');

create index if not exists object_deletion_jobs_ready_idx
  on public.object_deletion_jobs (run_after, created_at)
  where status = 'queued';

create or replace function public.touch_project_activity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.title is distinct from old.title then
    new.last_activity_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_touch_activity on public.projects;
create trigger projects_touch_activity
before update on public.projects
for each row execute function public.touch_project_activity();

create or replace function public.set_project_revision_head()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set current_revision_no = greatest(current_revision_no, new.revision_no),
      last_activity_at = now()
  where id = new.project_id and deleted_at is null;
  return new;
end;
$$;

drop trigger if exists project_revisions_set_head on public.project_revisions;
create trigger project_revisions_set_head
after insert on public.project_revisions
for each row execute function public.set_project_revision_head();

drop trigger if exists upload_sessions_touch_updated_at on public.upload_sessions;
create trigger upload_sessions_touch_updated_at
before update on public.upload_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists font_families_touch_updated_at on public.font_families;
create trigger font_families_touch_updated_at
before update on public.font_families
for each row execute function public.touch_updated_at();

drop trigger if exists object_deletion_jobs_touch_updated_at on public.object_deletion_jobs;
create trigger object_deletion_jobs_touch_updated_at
before update on public.object_deletion_jobs
for each row execute function public.touch_updated_at();

create or replace function public.request_project_deletion(requested_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_workspace_id uuid;
begin
  select workspace_id into requested_workspace_id
  from public.projects
  where id = requested_project_id and deleted_at is null;

  if requested_workspace_id is null
    or not public.has_workspace_role(requested_workspace_id, 'editor') then
    raise exception 'Project not found or access denied';
  end if;

  update public.projects
  set deleted_at = now(),
      purge_after = now() + interval '7 days',
      deleted_by = auth.uid(),
      deletion_reason = 'user_requested'
  where id = requested_project_id;
end;
$$;

create or replace function public.restore_project(requested_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_workspace_id uuid;
begin
  select workspace_id into requested_workspace_id
  from public.projects
  where id = requested_project_id
    and deleted_at is not null
    and purge_after > now();

  if requested_workspace_id is null
    or not public.has_workspace_role(requested_workspace_id, 'editor') then
    raise exception 'Project cannot be restored';
  end if;

  update public.projects
  set deleted_at = null,
      purge_after = null,
      deleted_by = null,
      deletion_reason = null,
      last_activity_at = now()
  where id = requested_project_id;
end;
$$;

alter table public.asset_variants enable row level security;
alter table public.project_assets enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.font_families enable row level security;
alter table public.font_files enable row level security;
alter table public.object_deletion_jobs enable row level security;

drop policy if exists projects_update_editor on public.projects;
create policy projects_update_editor on public.projects
for update to authenticated
using (deleted_at is null and public.has_workspace_role(workspace_id, 'editor'))
with check (deleted_at is null and public.has_workspace_role(workspace_id, 'editor'));

drop policy if exists revisions_select_member on public.project_revisions;
create policy revisions_select_member on public.project_revisions
for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.deleted_at is null
      and public.has_workspace_role(p.workspace_id, 'viewer')
  )
);

drop policy if exists revisions_insert_editor on public.project_revisions;
create policy revisions_insert_editor on public.project_revisions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.deleted_at is null
      and public.has_workspace_role(p.workspace_id, 'editor')
  )
);

drop policy if exists assets_select_member on public.assets;
create policy assets_select_member on public.assets
for select to authenticated
using (deleted_at is null and public.has_workspace_role(workspace_id, 'viewer'));

drop policy if exists assets_insert_editor on public.assets;
create policy assets_insert_editor on public.assets
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

drop policy if exists assets_delete_editor on public.assets;
create policy assets_delete_editor on public.assets
for delete to authenticated
using (public.has_workspace_role(workspace_id, 'editor'));

create policy assets_update_editor on public.assets
for update to authenticated
using (deleted_at is null and public.has_workspace_role(workspace_id, 'editor'))
with check (deleted_at is null and public.has_workspace_role(workspace_id, 'editor'));

create policy asset_variants_select_member on public.asset_variants
for select to authenticated
using (
  exists (
    select 1 from public.assets a
    where a.id = asset_id
      and a.deleted_at is null
      and public.has_workspace_role(a.workspace_id, 'viewer')
  )
);

create policy asset_variants_insert_editor on public.asset_variants
for insert to authenticated
with check (
  exists (
    select 1 from public.assets a
    where a.id = asset_id
      and a.deleted_at is null
      and public.has_workspace_role(a.workspace_id, 'editor')
  )
);

create policy asset_variants_delete_editor on public.asset_variants
for delete to authenticated
using (
  exists (
    select 1 from public.assets a
    where a.id = asset_id
      and public.has_workspace_role(a.workspace_id, 'editor')
  )
);

create policy project_assets_select_member on public.project_assets
for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.deleted_at is null
      and public.has_workspace_role(p.workspace_id, 'viewer')
  )
);

create policy project_assets_insert_editor on public.project_assets
for insert to authenticated
with check (
  attached_by = (select auth.uid())
  and exists (
    select 1
    from public.projects p
    join public.assets a on a.id = asset_id
    where p.id = project_id
      and p.deleted_at is null
      and a.workspace_id = p.workspace_id
      and a.deleted_at is null
      and public.has_workspace_role(p.workspace_id, 'editor')
  )
);

create policy project_assets_delete_editor on public.project_assets
for delete to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and public.has_workspace_role(p.workspace_id, 'editor')
  )
);

create policy upload_sessions_select_member on public.upload_sessions
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy upload_sessions_insert_editor on public.upload_sessions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

create policy upload_sessions_update_editor on public.upload_sessions
for update to authenticated
using (public.has_workspace_role(workspace_id, 'editor'))
with check (public.has_workspace_role(workspace_id, 'editor'));

create policy font_families_read_enabled on public.font_families
for select to authenticated using (enabled);

create policy font_files_read_enabled on public.font_files
for select to authenticated
using (
  enabled
  and exists (
    select 1 from public.font_families ff
    where ff.id = font_family_id and ff.enabled
  )
);

grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, delete on public.asset_variants to authenticated;
grant select, insert, delete on public.project_assets to authenticated;
grant select, insert, update on public.upload_sessions to authenticated;
grant select on public.font_families, public.font_files to authenticated;
grant execute on function public.request_project_deletion(uuid) to authenticated;
grant execute on function public.restore_project(uuid) to authenticated;

revoke all on public.object_deletion_jobs from anon, authenticated;
