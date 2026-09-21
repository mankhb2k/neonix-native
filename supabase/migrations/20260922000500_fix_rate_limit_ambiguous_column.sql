create or replace function public.check_and_increment_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_cutoff timestamptz;
  v_current_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_cutoff := v_window_start - (p_window_seconds * 3) * interval '1 second';

  delete from public.playground_rate_limits t
  where t.bucket_key = p_bucket_key
    and t.window_start < v_cutoff;

  insert into public.playground_rate_limits (bucket_key, window_start, request_count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set request_count = playground_rate_limits.request_count + 1
  returning request_count into v_current_count;

  return v_current_count <= p_max_requests;
end;
$$;
