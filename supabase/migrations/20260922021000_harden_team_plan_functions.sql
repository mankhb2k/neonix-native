create or replace function public.plan_tier_limits(p_plan text)
returns table(max_active_projects integer, storage_quota_bytes bigint, max_upload_bytes bigint)
language sql
immutable
set search_path to 'public'
as $$
  select
    case p_plan when 'pro' then 50 else 10 end,
    case p_plan when 'pro' then 10737418240::bigint else 1073741824::bigint end,
    case p_plan when 'pro' then 2147483648::bigint else 524288000::bigint end;
$$;

revoke all on function public.apply_account_plan_limits() from public, anon, authenticated;
revoke all on function public.apply_team_plan_limits() from public, anon, authenticated;
revoke all on function public.enforce_team_plan_workspace_kind() from public, anon, authenticated;
revoke all on function public.enforce_team_seat_limit() from public, anon, authenticated;
