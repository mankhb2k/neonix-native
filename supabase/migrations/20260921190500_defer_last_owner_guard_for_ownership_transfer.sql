-- Switch to a deferred constraint trigger so a same-transaction "demote old
-- owner, promote new owner" (2 statements) nets out correctly at COMMIT
-- instead of being rejected after the first statement, when no other owner
-- exists yet. Also replace the pg_trigger_depth() cascade-bypass with a
-- direct "does the workspace still exist" check: this is equivalent for the
-- cascade case (a transaction always sees its own earlier deletes) but also
-- correctly covers the deferred-to-commit timing.
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
    return null;
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    return null;
  end if;

  -- The workspace itself no longer exists (deleted directly, or cascaded
  -- from its owner's account being deleted) - nothing to enforce.
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return null;
  end if;

  perform 1 from public.workspaces where id = old.workspace_id for update;

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

  return null;
end;
$function$;

drop trigger if exists workspace_members_enforce_last_owner on public.workspace_members;

create constraint trigger workspace_members_enforce_last_owner
after update or delete on public.workspace_members
deferrable initially deferred
for each row execute function public.enforce_last_owner_guard();
