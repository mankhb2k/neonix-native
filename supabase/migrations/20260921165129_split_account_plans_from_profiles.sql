-- 1. New table: per-account plan & quota, split out of profiles
create table public.account_plans (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan = any (array['free'::text, 'pro'::text])),
  max_active_projects integer not null default 10 check (max_active_projects >= 1 and max_active_projects <= 10),
  storage_quota_bytes bigint not null default 1073741824,
  max_upload_bytes bigint not null default 524288000 check (max_upload_bytes >= 1 and max_upload_bytes <= 524288000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.account_plans is 'Per-account subscription plan and usage quotas. Writable only by service_role; authenticated users may only read their own row.';
comment on column public.account_plans.max_active_projects is 'Maximum non-deleted projects for all workspaces owned by this account. Free: 10.';
comment on column public.account_plans.storage_quota_bytes is 'Maximum R2-backed asset storage for all workspaces owned by this account. Free: 1 GiB.';
comment on column public.account_plans.max_upload_bytes is 'Maximum byte size for one R2-backed asset upload. Free: 500 MiB.';
comment on column public.account_plans.plan is 'Application subscription plan. New accounts default to free; quota columns remain the enforcement source of truth.';

-- 2. Backfill from existing profiles data
insert into public.account_plans (id, plan, max_active_projects, storage_quota_bytes, max_upload_bytes, created_at, updated_at)
select id, plan, max_active_projects, storage_quota_bytes, max_upload_bytes, created_at, updated_at
from public.profiles;

-- 3. RLS: read-only for the account owner, no self-service write policy
--    (this is the fix: profiles previously allowed authenticated users to UPDATE
--     their own plan/quota columns via profiles_update_own with no column restriction)
alter table public.account_plans enable row level security;

create policy account_plans_select_own on public.account_plans
  for select
  to authenticated
  using (id = (select auth.uid()));

-- 4. Provision account_plans row on signup, alongside profiles/workspaces
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.account_plans (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.workspaces (name, created_by)
  select 'Personal workspace', new.id
  where not exists (
    select 1
    from public.workspaces
    where created_by = new.id
  );

  return new;
end;
$function$;

-- 5. Quota-enforcement triggers now read from account_plans instead of profiles
create or replace function public.enforce_project_count_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  select ap.max_active_projects
  into project_limit
  from public.account_plans ap
  where ap.id = account_id
  for update;

  if project_limit is null then
    raise exception 'Account plan not found';
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
$function$;

create or replace function public.enforce_asset_account_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  select ap.storage_quota_bytes, ap.max_upload_bytes
  into storage_quota, max_upload
  from public.account_plans ap
  where ap.id = account_id
  for update;

  if storage_quota is null or max_upload is null then
    raise exception 'Account plan not found';
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
$function$;

-- 6. Drop the now-duplicated columns from profiles (their check constraints
--    and the plan index are dropped automatically along with the columns)
alter table public.profiles
  drop column plan,
  drop column max_active_projects,
  drop column storage_quota_bytes,
  drop column max_upload_bytes;
