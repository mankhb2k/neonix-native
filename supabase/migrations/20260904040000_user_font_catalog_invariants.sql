-- Make semantic family lookup deterministic within a workspace and prevent
-- cross-workspace project bindings, including service-role/import paths.

create unique index user_font_families_workspace_name_uidx
  on public.user_font_families (workspace_id, lower(family_name));

create or replace function public.validate_project_user_font_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_workspace_id uuid;
  family_workspace_id uuid;
begin
  select workspace_id into project_workspace_id
  from public.projects
  where id = new.project_id;

  select workspace_id into family_workspace_id
  from public.user_font_families
  where id = new.font_family_id;

  if project_workspace_id is null
    or family_workspace_id is null
    or project_workspace_id <> family_workspace_id then
    raise exception 'Project and user font family must belong to the same workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists project_font_families_validate_workspace on public.project_font_families;
create trigger project_font_families_validate_workspace
before insert or update on public.project_font_families
for each row execute function public.validate_project_user_font_family();

revoke all on function public.validate_project_user_font_family() from public, anon, authenticated;
