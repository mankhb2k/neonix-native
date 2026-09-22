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
  -- MVP guard: there is no payment/billing verification wired up yet, so
  -- seats_purchased is presently client-supplied and trusted as-is. Cap it
  -- to a sane ceiling to bound the blast radius of the missing billing
  -- check. Raise this (or replace it with real payment verification) once
  -- checkout is built.
  if p_seats > 50 then
    raise exception 'Team workspaces above 50 seats require a manual sales process' using errcode = 'P0007';
  end if;

  insert into public.workspaces (name, created_by, kind)
  values (nullif(trim(p_name), ''), v_user_id, 'team')
  returning id into v_workspace_id;

  insert into public.team_plans (workspace_id, seats_purchased)
  values (v_workspace_id, p_seats);

  return v_workspace_id;
end;
$function$;
