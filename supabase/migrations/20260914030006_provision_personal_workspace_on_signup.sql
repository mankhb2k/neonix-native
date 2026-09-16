-- Keep the account invariant in the database: every auth user owns a
-- personal workspace, and every personal workspace has an owner membership.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
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
$$;

-- Repair an owned workspace that was created without its owner membership.
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
join auth.users u on u.id = w.created_by
where not exists (
  select 1
  from public.workspace_members wm
  where wm.workspace_id = w.id
    and wm.user_id = w.created_by
)
on conflict (workspace_id, user_id) do update
set role = 'owner';

-- Create a personal workspace for every existing account that does not own
-- one. The existing on_workspace_created trigger creates its owner membership.
insert into public.workspaces (name, created_by)
select 'Personal workspace', u.id
from auth.users u
where not exists (
  select 1
  from public.workspaces w
  where w.created_by = u.id
);

-- The final repair is intentionally idempotent and also covers deployments
-- where the workspace trigger was temporarily absent or misconfigured.
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
join auth.users u on u.id = w.created_by
where not exists (
  select 1
  from public.workspace_members wm
  where wm.workspace_id = w.id
    and wm.user_id = w.created_by
)
on conflict (workspace_id, user_id) do update
set role = 'owner';
