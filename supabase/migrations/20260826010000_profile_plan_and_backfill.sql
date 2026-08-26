-- Auth identities belong to Supabase in auth.users. Application account state
-- lives in public.profiles and starts every account on the Free plan.

alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
    check (plan in ('free', 'pro'));

comment on column public.profiles.plan is
  'Application subscription plan. New accounts default to free; quota columns remain the enforcement source of truth.';

-- The on_auth_user_created trigger only runs for future sign-ups. Backfill
-- identities that existed before the application schema was deployed.
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

create index if not exists profiles_plan_idx
  on public.profiles (plan);
