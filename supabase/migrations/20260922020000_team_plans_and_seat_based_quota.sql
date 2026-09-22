-- Single source of truth for what each plan tier is worth, in bytes/counts.
-- Used by both account_plans (personal) and team_plans (per seat, pooled).
create or replace function public.plan_tier_limits(p_plan text)
returns table(max_active_projects integer, storage_quota_bytes bigint, max_upload_bytes bigint)
language sql
immutable
as $$
  select
    case p_plan when 'pro' then 50 else 10 end,
    case p_plan when 'pro' then 10737418240::bigint else 1073741824::bigint end,
    case p_plan when 'pro' then 2147483648::bigint else 524288000::bigint end;
$$;

-- account_plans: widen check constraints to allow real Pro values, then keep
-- the numeric columns in lockstep with `plan` via a trigger so they can never
-- drift out of sync with each other again.
alter table public.account_plans
  drop constraint if exists account_plans_max_active_projects_check,
  drop constraint if exists account_plans_max_upload_bytes_check;

alter table public.account_plans
  add constraint account_plans_max_active_projects_check check (max_active_projects between 1 and 50),
  add constraint account_plans_max_upload_bytes_check check (max_upload_bytes between 1 and 2147483648),
  add constraint account_plans_storage_quota_check check (storage_quota_bytes between 0 and 10737418240);

create or replace function public.apply_account_plan_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  limits record;
begin
  select * into limits from public.plan_tier_limits(new.plan);
  new.max_active_projects := limits.max_active_projects;
  new.storage_quota_bytes := limits.storage_quota_bytes;
  new.max_upload_bytes := limits.max_upload_bytes;
  return new;
end;
$function$;

drop trigger if exists account_plans_apply_limits on public.account_plans;
create trigger account_plans_apply_limits
before insert or update of plan on public.account_plans
for each row execute function public.apply_account_plan_limits();

-- Re-derive existing rows so they match plan_tier_limits exactly (no-op today
-- since every account_plans row is currently 'free', but keeps this correct
-- if that ever isn't true by the time this migration runs again elsewhere).
update public.account_plans set plan = plan;

-- Team plans: one row per team workspace. Not a client-writable table -
-- provisioned only via create_team_workspace() and adjusted only by
-- service_role (future billing integration), same posture as account_plans.
create table public.team_plans (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  seats_purchased integer not null default 2 check (seats_purchased >= 2),
  max_active_projects integer not null,
  storage_quota_bytes bigint not null,
  max_upload_bytes bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.team_plans is 'Per-workspace plan for kind=team workspaces: seats_purchased x pro-tier-per-seat = the pooled quota shared by the whole team. Independent of any member''s personal account_plans.';

alter table public.team_plans enable row level security;

create policy team_plans_select_member on public.team_plans
for select to authenticated
using (public.has_workspace_role(workspace_id, 'viewer'));

create trigger team_plans_touch_updated_at
before update on public.team_plans
for each row execute function public.touch_updated_at();

create or replace function public.enforce_team_plan_workspace_kind()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind text;
begin
  select kind into v_kind from public.workspaces where id = new.workspace_id;
  if v_kind is distinct from 'team' then
    raise exception 'team_plans can only be attached to a kind=team workspace';
  end if;
  return new;
end;
$function$;

create trigger team_plans_enforce_workspace_kind
before insert on public.team_plans
for each row execute function public.enforce_team_plan_workspace_kind();

create or replace function public.apply_team_plan_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  limits record;
begin
  select * into limits from public.plan_tier_limits('pro');
  new.max_active_projects := limits.max_active_projects * new.seats_purchased;
  new.storage_quota_bytes := limits.storage_quota_bytes * new.seats_purchased;
  -- Per-file upload cap is a ceiling, not a pooled resource - it does not
  -- scale with seat count.
  new.max_upload_bytes := limits.max_upload_bytes;
  return new;
end;
$function$;

drop trigger if exists team_plans_apply_limits on public.team_plans;
create trigger team_plans_apply_limits
before insert or update of seats_purchased on public.team_plans
for each row execute function public.apply_team_plan_limits();

-- Team workspace creation is no longer a plain client INSERT: it must go
-- through this function so a workspace can never exist as kind=team without
-- a matching team_plans row (and, later, without going through checkout).
create or replace function public.create_team_workspace(p_name text, p_seats integer default 2)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;
  if p_seats < 2 then
    raise exception 'Team workspaces require at least 2 seats' using errcode = 'P0004';
  end if;

  insert into public.workspaces (name, created_by, kind)
  values (nullif(trim(p_name), ''), v_user_id, 'team')
  returning id into v_workspace_id;

  insert into public.team_plans (workspace_id, seats_purchased)
  values (v_workspace_id, p_seats);

  return v_workspace_id;
end;
$function$;

revoke all on function public.create_team_workspace(text, integer) from public, anon;
grant execute on function public.create_team_workspace(text, integer) to authenticated;

-- Client can no longer insert a kind=team workspace directly; only via the
-- function above (SECURITY DEFINER, bypasses this policy).
drop policy workspaces_insert_self on public.workspaces;
create policy workspaces_insert_self on public.workspaces
for insert to authenticated
with check (created_by = (select auth.uid()) and kind = 'personal');

-- Seats purchased cap how many workspace_members rows a team workspace can
-- have. Reducing seats_purchased below the current member count is allowed
-- (Slack/Notion-style: existing members are grandfathered) - this trigger
-- only blocks *adding new* members while at or over the seat count.
create or replace function public.enforce_team_seat_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind text;
  v_seats integer;
  v_current_count integer;
begin
  select kind into v_kind from public.workspaces where id = new.workspace_id;
  if v_kind is distinct from 'team' then
    return new;
  end if;

  select seats_purchased into v_seats
  from public.team_plans
  where workspace_id = new.workspace_id
  for update;

  if v_seats is null then
    raise exception 'Team workspace has no active plan' using errcode = 'P0005';
  end if;

  select count(*) into v_current_count
  from public.workspace_members
  where workspace_id = new.workspace_id;

  if v_current_count >= v_seats then
    raise exception 'This team has reached its purchased seat limit (%). Buy more seats or remove a member first.', v_seats
      using errcode = 'P0006';
  end if;

  return new;
end;
$function$;

drop trigger if exists workspace_members_enforce_team_seat_limit on public.workspace_members;
create trigger workspace_members_enforce_team_seat_limit
before insert on public.workspace_members
for each row execute function public.enforce_team_seat_limit();

-- Per-workspace (not per-account) storage usage, for the trigger below - a
-- workspace's usage must never be attributed to any *other* workspace the
-- same account happens to own (e.g. their personal space vs a team they're in).
create or replace function public.workspace_storage_used_bytes(target_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(a.byte_size), 0)::bigint
  from public.assets a
  where a.workspace_id = target_workspace_id
    and a.deleted_at is null
    and a.status in ('uploading', 'ready');
$$;

revoke all on function public.workspace_storage_used_bytes(uuid) from public, anon, authenticated;
grant execute on function public.workspace_storage_used_bytes(uuid) to service_role;

-- account_storage_used_bytes backs the account-settings storage display,
-- which is compared against account_plans (the personal-plan quota) - so it
-- must only ever count the account's *personal* workspace, never a team
-- workspace the same account happens to own.
create or replace function public.account_storage_used_bytes(account_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(sum(a.byte_size), 0)::bigint
  from public.assets a
  join public.workspaces w on w.id = a.workspace_id
  where w.created_by = account_id
    and w.kind = 'personal'
    and a.deleted_at is null
    and a.status in ('uploading', 'ready');
$function$;

-- Project-count limit: now resolves the limit from team_plans (pooled) for a
-- team workspace, or account_plans (personal) otherwise, and always counts
-- only within that one workspace - never aggregated across every workspace
-- the account happens to own.
create or replace function public.enforce_project_count_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind text;
  v_owner uuid;
  v_limit integer;
  v_active_count integer;
begin
  if tg_op = 'UPDATE'
    and not (old.deleted_at is not null and new.deleted_at is null) then
    return new;
  end if;

  select w.kind, w.created_by
  into v_kind, v_owner
  from public.workspaces w
  where w.id = new.workspace_id;

  if v_kind is null then
    raise exception 'Workspace not found';
  end if;

  if v_kind = 'team' then
    select tp.max_active_projects
    into v_limit
    from public.team_plans tp
    where tp.workspace_id = new.workspace_id
    for update;
    if v_limit is null then
      raise exception 'Team workspace has no active plan';
    end if;
  else
    select ap.max_active_projects
    into v_limit
    from public.account_plans ap
    where ap.id = v_owner
    for update;
    if v_limit is null then
      raise exception 'Account plan not found';
    end if;
  end if;

  select count(*)
  into v_active_count
  from public.projects pr
  where pr.workspace_id = new.workspace_id
    and pr.deleted_at is null;

  if v_active_count >= v_limit then
    raise exception 'This plan allows at most % active projects', v_limit
      using errcode = 'P0003';
  end if;

  return new;
end;
$function$;

-- Asset storage/upload quota: same kind-based branching, and now scoped to
-- workspace_storage_used_bytes (this workspace only) instead of
-- account_storage_used_bytes (every workspace the account owns).
create or replace function public.enforce_asset_account_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind text;
  v_owner uuid;
  v_storage_quota bigint;
  v_max_upload bigint;
  v_current_used bigint;
  v_old_reserved bigint := 0;
  v_new_reserved bigint := 0;
begin
  select w.kind, w.created_by
  into v_kind, v_owner
  from public.workspaces w
  where w.id = new.workspace_id;

  if v_kind is null then
    raise exception 'Workspace not found';
  end if;

  if v_kind = 'team' then
    select tp.storage_quota_bytes, tp.max_upload_bytes
    into v_storage_quota, v_max_upload
    from public.team_plans tp
    where tp.workspace_id = new.workspace_id
    for update;
    if v_storage_quota is null then
      raise exception 'Team workspace has no active plan';
    end if;
  else
    select ap.storage_quota_bytes, ap.max_upload_bytes
    into v_storage_quota, v_max_upload
    from public.account_plans ap
    where ap.id = v_owner
    for update;
    if v_storage_quota is null then
      raise exception 'Account plan not found';
    end if;
  end if;

  if new.deleted_at is null and new.status in ('uploading', 'ready') then
    v_new_reserved := new.byte_size;
  end if;

  if v_new_reserved > v_max_upload then
    raise exception 'Upload exceeds the % byte file limit', v_max_upload
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and old.workspace_id = new.workspace_id
    and old.deleted_at is null and old.status in ('uploading', 'ready') then
    v_old_reserved := old.byte_size;
  end if;

  select public.workspace_storage_used_bytes(new.workspace_id)
  into v_current_used;

  if v_current_used - v_old_reserved + v_new_reserved > v_storage_quota then
    raise exception 'Account storage quota of % bytes exceeded', v_storage_quota
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;
