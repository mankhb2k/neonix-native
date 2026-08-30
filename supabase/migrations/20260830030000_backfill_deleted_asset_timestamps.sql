-- Normalize assets deleted by the previous endpoint implementation. Those
-- rows already had status=deleted but were missing the lifecycle timestamp.

update public.assets
set deleted_at = coalesce(deleted_at, now())
where status = 'deleted'
  and deleted_at is null;

