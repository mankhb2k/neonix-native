-- Give the free-plan project-count limit its own SQLSTATE (P0003), distinct
-- from the generic P0001 used by many other raised exceptions across this
-- schema, and from P0002 (revision conflict). Without a distinct code, the
-- application layer could not tell "you hit your project limit" apart from
-- any other database error and fell back to a generic, unhelpful message.
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
      using errcode = 'P0003';
  end if;

  return new;
end;
$function$;
