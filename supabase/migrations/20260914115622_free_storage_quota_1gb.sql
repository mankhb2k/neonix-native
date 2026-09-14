alter table public.profiles
  alter column storage_quota_bytes set default 1073741824;

alter table public.profiles
  drop constraint if exists profiles_storage_quota_free_check;

update public.profiles
set storage_quota_bytes = 1073741824
where plan = 'free'
  and storage_quota_bytes > 1073741824;

alter table public.profiles
  add constraint profiles_storage_quota_free_check
    check (
      storage_quota_bytes between 0 and 2147483648
      and (plan <> 'free' or storage_quota_bytes <= 1073741824)
    );

comment on column public.profiles.storage_quota_bytes is
  'Maximum R2-backed asset storage for all workspaces owned by this account. Free: 1 GiB.';
