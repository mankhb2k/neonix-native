-- Free plan limits. Project documents stay in Postgres and are intentionally
-- excluded from storage quotas; only R2-backed assets reserve storage.

alter table public.profiles
  add column if not exists max_active_projects integer not null default 5,
  add column if not exists storage_quota_bytes bigint not null default 2147483648,
  add column if not exists max_upload_bytes bigint not null default 524288000;

alter table public.profiles
  drop constraint if exists profiles_max_active_projects_free_check,
  drop constraint if exists profiles_storage_quota_free_check,
  drop constraint if exists profiles_max_upload_free_check;

alter table public.profiles
  add constraint profiles_max_active_projects_free_check
    check (max_active_projects between 1 and 5),
  add constraint profiles_storage_quota_free_check
    check (storage_quota_bytes between 0 and 2147483648),
  add constraint profiles_max_upload_free_check
    check (max_upload_bytes between 1 and 524288000);

alter table public.projects
  add column if not exists storage_quota_bytes bigint not null default 1073741824;

alter table public.projects
  drop constraint if exists projects_storage_quota_free_check;

alter table public.projects
  add constraint projects_storage_quota_free_check
    check (storage_quota_bytes between 0 and 1073741824);

comment on column public.profiles.storage_quota_bytes is
  'Maximum R2-backed asset storage for all workspaces owned by this account. Free: 2 GiB.';
comment on column public.profiles.max_upload_bytes is
  'Maximum byte size for one R2-backed asset upload. Free: 500 MiB.';
comment on column public.profiles.max_active_projects is
  'Maximum non-deleted projects for all workspaces owned by this account. Free: 5.';
comment on column public.projects.storage_quota_bytes is
  'Maximum R2-backed asset storage attached to this project. Free: 1 GiB.';

create or replace function public.account_storage_used_bytes(account_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(a.byte_size), 0)::bigint
  from public.assets a
  join public.workspaces w on w.id = a.workspace_id
  where w.created_by = account_id
    and a.deleted_at is null
    and a.status in ('uploading', 'ready');
$$;

create or replace function public.project_storage_used_bytes(target_project_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(a.byte_size), 0)::bigint
  from public.project_assets pa
  join public.assets a on a.id = pa.asset_id
  where pa.project_id = target_project_id
    and a.deleted_at is null
    and a.status in ('uploading', 'ready');
$$;

create or replace function public.enforce_project_count_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid;
  project_limit integer;
  active_project_count integer;
begin
  if tg_op = 'UPDATE'
    and not (old.deleted_at is not null and new.deleted_at is null) then
    return new;
  end if;

  select w.created_by
  into account_id
  from public.workspaces w
  where w.id = new.workspace_id;

  if account_id is null then
    raise exception 'Workspace not found';
  end if;

  select p.max_active_projects
  into project_limit
  from public.profiles p
  where p.id = account_id
  for update;

  if project_limit is null then
    raise exception 'Account profile not found';
  end if;

  select count(*)
  into active_project_count
  from public.projects pr
  join public.workspaces w on w.id = pr.workspace_id
  where w.created_by = account_id
    and pr.deleted_at is null;

  if active_project_count >= project_limit then
    raise exception 'Free plan allows at most % active projects', project_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_enforce_project_count_limit on public.projects;
create trigger projects_enforce_project_count_limit
before insert or update of deleted_at on public.projects
for each row execute function public.enforce_project_count_limit();

create or replace function public.enforce_asset_account_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid;
  storage_quota bigint;
  max_upload bigint;
  current_used bigint;
  old_reserved bigint := 0;
  new_reserved bigint := 0;
begin
  select w.created_by
  into account_id
  from public.workspaces w
  where w.id = new.workspace_id;

  if account_id is null then
    raise exception 'Workspace not found';
  end if;

  select p.storage_quota_bytes, p.max_upload_bytes
  into storage_quota, max_upload
  from public.profiles p
  where p.id = account_id
  for update;

  if storage_quota is null or max_upload is null then
    raise exception 'Account profile not found';
  end if;

  if new.deleted_at is null and new.status in ('uploading', 'ready') then
    new_reserved := new.byte_size;
  end if;

  if new_reserved > max_upload then
    raise exception 'Upload exceeds the % byte file limit', max_upload
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and old.workspace_id = new.workspace_id
    and old.deleted_at is null and old.status in ('uploading', 'ready') then
    old_reserved := old.byte_size;
  end if;

  select public.account_storage_used_bytes(account_id)
  into current_used;

  if current_used - old_reserved + new_reserved > storage_quota then
    raise exception 'Account storage quota of % bytes exceeded', storage_quota
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_enforce_account_storage_quota on public.assets;
create trigger assets_enforce_account_storage_quota
before insert or update of byte_size, status, deleted_at, workspace_id on public.assets
for each row execute function public.enforce_asset_account_quota();

create or replace function public.enforce_attached_project_quotas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  current_used bigint;
  old_reserved bigint := 0;
  new_reserved bigint := 0;
begin
  if new.deleted_at is null and new.status in ('uploading', 'ready') then
    new_reserved := new.byte_size;
  end if;

  if old.deleted_at is null and old.status in ('uploading', 'ready') then
    old_reserved := old.byte_size;
  end if;

  for target in
    select pr.id, pr.storage_quota_bytes
    from public.projects pr
    join public.project_assets pa on pa.project_id = pr.id
    where pa.asset_id = new.id
  loop
    perform 1
    from public.projects pr
    where pr.id = target.id
    for update;

    select public.project_storage_used_bytes(target.id)
    into current_used;

    if current_used - old_reserved + new_reserved > target.storage_quota_bytes then
      raise exception 'Project storage quota of % bytes exceeded', target.storage_quota_bytes
        using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists assets_enforce_project_storage_quota on public.assets;
create trigger assets_enforce_project_storage_quota
before update of byte_size, status, deleted_at on public.assets
for each row execute function public.enforce_attached_project_quotas();

create or replace function public.enforce_project_asset_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  storage_quota bigint;
  current_used bigint;
  old_reserved bigint := 0;
  new_reserved bigint := 0;
begin
  select pr.storage_quota_bytes
  into storage_quota
  from public.projects pr
  where pr.id = new.project_id
  for update;

  if storage_quota is null then
    raise exception 'Project not found';
  end if;

  select case
    when a.deleted_at is null and a.status in ('uploading', 'ready') then a.byte_size
    else 0
  end
  into new_reserved
  from public.assets a
  where a.id = new.asset_id;

  if new_reserved is null then
    raise exception 'Asset not found';
  end if;

  if tg_op = 'UPDATE' and old.project_id = new.project_id then
    select case
      when a.deleted_at is null and a.status in ('uploading', 'ready') then a.byte_size
      else 0
    end
    into old_reserved
    from public.assets a
    where a.id = old.asset_id;
  end if;

  select public.project_storage_used_bytes(new.project_id)
  into current_used;

  if current_used - old_reserved + new_reserved > storage_quota then
    raise exception 'Project storage quota of % bytes exceeded', storage_quota
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists project_assets_enforce_project_storage_quota on public.project_assets;
create trigger project_assets_enforce_project_storage_quota
before insert or update of project_id, asset_id on public.project_assets
for each row execute function public.enforce_project_asset_quota();

revoke all on function public.account_storage_used_bytes(uuid) from public, anon, authenticated;
revoke all on function public.project_storage_used_bytes(uuid) from public, anon, authenticated;
grant execute on function public.account_storage_used_bytes(uuid) to service_role;
grant execute on function public.project_storage_used_bytes(uuid) to service_role;
