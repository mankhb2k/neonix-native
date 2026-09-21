-- At most one 'owner' row per workspace. Combined with enforce_last_owner_guard
-- (at least one owner), this makes every workspace have exactly one owner.
create unique index workspace_members_one_owner_per_workspace
  on public.workspace_members (workspace_id)
  where role = 'owner';
