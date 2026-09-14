create table if not exists public.api_waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists api_waitlist_signups_email_lower_idx
  on public.api_waitlist_signups (lower(email));

alter table public.api_waitlist_signups enable row level security;

grant insert on table public.api_waitlist_signups to anon, authenticated;

drop policy if exists "Anyone can join the API waitlist" on public.api_waitlist_signups;
create policy "Anyone can join the API waitlist"
  on public.api_waitlist_signups
  for insert
  to anon, authenticated
  with check (
    char_length(email) between 3 and 320
    and email = lower(btrim(email))
  );
