-- 1. A member can remove themself from a workspace (leave). Still subject to
--    enforce_last_owner_guard below: the sole owner of a team workspace cannot
--    leave directly, they must delete the whole workspace instead.
create policy workspace_members_delete_self on public.workspace_members
for delete to authenticated
using (user_id = (select auth.uid()));

-- 2. Owner can dissolve a team workspace entirely. Personal workspaces are not
--    client-deletable; they only disappear via the account-deletion cascade below.
grant delete on public.workspaces to authenticated;

create policy workspaces_delete_owner_team on public.workspaces
for delete to authenticated
using (kind = 'team' and has_workspace_role(id, 'owner'));

-- 3. Deleting the owner's auth account cascades away any workspace they own
--    (personal or team). For a team workspace this cascades further into
--    workspace_members/projects/assets/etc, fully dissolving the group.
alter table public.workspaces
  drop constraint workspaces_created_by_fkey,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete cascade;

-- 4. Let FK-cascade deletes (owner deletes the workspace, or the owner's account
--    itself is deleted) bypass the "must always have an owner" rule, which should
--    only block a *direct* attempt to remove/demote the last owner in place.
--    pg_trigger_depth() > 1 means this row is being removed as a side effect of
--    another cascade already in progress (the RI cascade trigger on the parent
--    table is itself depth 1, so our trigger nested inside it is depth 2+).
create or replace function public.enforce_last_owner_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  remaining_owners integer;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

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
    raise exception 'A workspace must always have at least one owner. Delete the workspace instead of leaving it.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$function$;
