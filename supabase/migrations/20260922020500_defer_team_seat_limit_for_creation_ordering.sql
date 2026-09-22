-- create_team_workspace() inserts the workspace first (which immediately
-- fires handle_new_workspace(), auto-adding the owner to workspace_members)
-- and only creates team_plans afterward, in the same transaction. A BEFORE
-- INSERT trigger on workspace_members would see no team_plans row yet and
-- reject the owner's own membership. Deferring to COMMIT lets the whole
-- transaction finish (team_plans included) before this is checked.
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
    return null;
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

  if v_current_count > v_seats then
    raise exception 'This team has reached its purchased seat limit (%). Buy more seats or remove a member first.', v_seats
      using errcode = 'P0006';
  end if;

  return null;
end;
$function$;

drop trigger if exists workspace_members_enforce_team_seat_limit on public.workspace_members;
create constraint trigger workspace_members_enforce_team_seat_limit
after insert on public.workspace_members
deferrable initially deferred
for each row execute function public.enforce_team_seat_limit();
