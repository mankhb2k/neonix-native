-- 1. [Critical fix] workspaces_update_editor previously let any editor rewrite
--    created_by (the account whose account_plans quota governs this workspace),
--    hijacking billing ownership or griefing another account's storage quota.
--    Column-level grant: clients may only ever rename a workspace.
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

-- 2. Personal vs team discriminator. Personal = private space auto-created on
--    signup, membership locked to its owner forever. Team = shared workspace,
--    members can be invited. kind is not in the granted column list above, so
--    it can never be changed by a client after creation.
alter table public.workspaces
  add column kind text not null default 'team' check (kind in ('personal', 'team'));

comment on column public.workspaces.kind is 'personal: private single-member space auto-created on signup, membership locked to the owner. team: shared workspace, additional members can be invited.';

-- Backfill: each account's earliest workspace becomes its personal workspace
with earliest as (
  select distinct on (created_by) id
  from public.workspaces
  order by created_by, created_at asc
)
update public.workspaces w
set kind = 'personal'
from earliest e
where w.id = e.id;

create unique index workspaces_one_personal_per_owner
  on public.workspaces (created_by)
  where kind = 'personal';

-- 3. Signup trigger now explicitly provisions the personal workspace as such
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

  insert into public.workspaces (name, created_by, kind)
  select 'Personal workspace', new.id, 'personal'
  where not exists (
    select 1
    from public.workspaces
    where created_by = new.id
      and kind = 'personal'
  );

  return new;
end;
$function$;

-- 4. Lock personal-workspace membership to exactly its owner: no invites, ever
create or replace function public.enforce_personal_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  workspace_kind text;
  workspace_owner uuid;
begin
  select w.kind, w.created_by
  into workspace_kind, workspace_owner
  from public.workspaces w
  where w.id = new.workspace_id;

  if workspace_kind = 'personal' and new.user_id <> workspace_owner then
    raise exception 'Cannot add other members to a personal workspace'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists workspace_members_enforce_personal_lock on public.workspace_members;
create trigger workspace_members_enforce_personal_lock
before insert on public.workspace_members
for each row execute function public.enforce_personal_workspace_membership();

-- 5. Never allow a workspace to end up with zero owners (would permanently
--    freeze membership management, since insert/update on workspace_members
--    requires an existing owner)
create or replace function public.enforce_last_owner_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  remaining_owners integer;
begin
  if old.role <> 'owner' then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  select count(*)
  into remaining_owners
  from public.workspace_members
  where workspace_id = old.workspace_id
    and role = 'owner'
    and user_id <> old.user_id;

  if remaining_owners = 0 then
    raise exception 'A workspace must always have at least one owner'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$function$;

drop trigger if exists workspace_members_enforce_last_owner on public.workspace_members;
create trigger workspace_members_enforce_last_owner
before update or delete on public.workspace_members
for each row execute function public.enforce_last_owner_guard();
