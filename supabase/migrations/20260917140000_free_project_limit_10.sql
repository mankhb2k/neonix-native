-- Increase the Free plan's active project limit from 5 to 10.
-- The trigger in 20260826000000_free_storage_quotas.sql reads this column,
-- so update the database source of truth as well as the UI counter.

alter table public.profiles
  drop constraint if exists profiles_max_active_projects_free_check;

alter table public.profiles
  alter column max_active_projects set default 10;

alter table public.profiles
  add constraint profiles_max_active_projects_free_check
    check (max_active_projects between 1 and 10);

update public.profiles
set max_active_projects = 10
where plan = 'free';

comment on column public.profiles.max_active_projects is
  'Maximum non-deleted projects for all workspaces owned by this account. Free: 10.';
