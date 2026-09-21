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

  -- Serialize concurrent owner-removal attempts on the same workspace so two
  -- simultaneous "leave" requests can't both read "1 owner remaining" and both
  -- proceed, leaving zero owners once both commit.
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

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$function$;
