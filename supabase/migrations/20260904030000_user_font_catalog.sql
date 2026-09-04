-- User-owned font catalog.
-- The binary is an ordinary workspace asset in neonix-user-assets; these
-- tables add font-family/face semantics without mixing them with system_catalog.

alter table public.assets
  drop constraint if exists assets_kind_check;

alter table public.assets
  add constraint assets_kind_check
  check (kind in ('image', 'video', 'audio', 'font', 'other'));

create table public.user_font_families (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  family_name text not null check (length(trim(family_name)) between 1 and 160),
  license text,
  metadata_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_json) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.user_font_faces (
  id uuid primary key default gen_random_uuid(),
  font_family_id uuid not null references public.user_font_families (id) on delete cascade,
  asset_id uuid not null unique references public.assets (id) on delete cascade,
  face_key text not null,
  version text not null default 'default',
  weight integer not null check (weight between 1 and 1000),
  style text not null default 'normal'
    check (style in ('normal', 'italic', 'oblique')),
  width_class text not null default 'normal'
    check (width_class in (
      'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
      'normal',
      'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'
    )),
  format text not null check (format in ('woff2', 'woff', 'ttf', 'otf')),
  subfamily_name text,
  postscript_name text,
  axes_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(axes_json) = 'object'),
  metadata_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_json) = 'object'),
  is_default boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (font_family_id, face_key, format)
);

create table public.project_font_families (
  project_id uuid not null references public.projects (id) on delete cascade,
  font_family_id uuid not null references public.user_font_families (id) on delete cascade,
  alias text check (alias is null or length(trim(alias)) between 1 and 160),
  enabled boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (project_id, font_family_id)
);

create or replace function public.validate_user_font_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  family_workspace_id uuid;
  asset_workspace_id uuid;
begin
  select workspace_id into family_workspace_id
  from public.user_font_families
  where id = new.font_family_id;

  select workspace_id into asset_workspace_id
  from public.assets
  where id = new.asset_id
    and kind = 'font'
    and storage_bucket = 'neonix-user-assets'
    and deleted_at is null;

  if family_workspace_id is null or asset_workspace_id is null or family_workspace_id <> asset_workspace_id then
    raise exception 'User font face must reference a live font asset in the same workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists user_font_faces_validate_asset on public.user_font_faces;
create trigger user_font_faces_validate_asset
before insert or update on public.user_font_faces
for each row execute function public.validate_user_font_asset();

drop trigger if exists user_font_families_touch_updated_at on public.user_font_families;
create trigger user_font_families_touch_updated_at
before update on public.user_font_families
for each row execute function public.touch_updated_at();

create index user_font_families_workspace_idx
  on public.user_font_families (workspace_id, family_name)
  where enabled;

create index user_font_faces_lookup_idx
  on public.user_font_faces (font_family_id, width_class, weight, style)
  where enabled;

create index project_font_families_project_idx
  on public.project_font_families (project_id)
  where enabled;

alter table public.user_font_families enable row level security;
alter table public.user_font_faces enable row level security;
alter table public.project_font_families enable row level security;

create policy user_font_families_select_member on public.user_font_families
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create policy user_font_families_insert_editor on public.user_font_families
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, 'editor')
);

create policy user_font_families_update_editor on public.user_font_families
for update to authenticated
using (public.has_workspace_role(workspace_id, 'editor'))
with check (public.has_workspace_role(workspace_id, 'editor'));

create policy user_font_families_delete_editor on public.user_font_families
for delete to authenticated
using (public.has_workspace_role(workspace_id, 'editor'));

create policy user_font_faces_select_member on public.user_font_faces
for select to authenticated
using (
  exists (
    select 1
    from public.user_font_families family
    where family.id = font_family_id
      and public.has_workspace_role(family.workspace_id, 'viewer')
  )
);

create policy user_font_faces_insert_editor on public.user_font_faces
for insert to authenticated
with check (
  exists (
    select 1
    from public.user_font_families family
    where family.id = font_family_id
      and public.has_workspace_role(family.workspace_id, 'editor')
  )
);

create policy user_font_faces_update_editor on public.user_font_faces
for update to authenticated
using (
  exists (
    select 1
    from public.user_font_families family
    where family.id = font_family_id
      and public.has_workspace_role(family.workspace_id, 'editor')
  )
)
with check (
  exists (
    select 1
    from public.user_font_families family
    where family.id = font_family_id
      and public.has_workspace_role(family.workspace_id, 'editor')
  )
);

create policy user_font_faces_delete_editor on public.user_font_faces
for delete to authenticated
using (
  exists (
    select 1
    from public.user_font_families family
    where family.id = font_family_id
      and public.has_workspace_role(family.workspace_id, 'editor')
  )
);

create policy project_font_families_select_member on public.project_font_families
for select to authenticated
using (
  exists (
    select 1 from public.projects project
    where project.id = project_id
      and public.has_workspace_role(project.workspace_id, 'viewer')
  )
);

create policy project_font_families_insert_editor on public.project_font_families
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.projects project
    join public.user_font_families family on family.id = font_family_id
    where project.id = project_id
      and project.workspace_id = family.workspace_id
      and public.has_workspace_role(project.workspace_id, 'editor')
  )
);

create policy project_font_families_delete_editor on public.project_font_families
for delete to authenticated
using (
  exists (
    select 1
    from public.projects project
    join public.user_font_families family on family.id = font_family_id
    where project.id = project_id
      and project.workspace_id = family.workspace_id
      and public.has_workspace_role(project.workspace_id, 'editor')
  )
);

grant select, insert, update, delete
on public.user_font_families, public.user_font_faces, public.project_font_families
to authenticated;

revoke all on function public.validate_user_font_asset() from public, anon, authenticated;
