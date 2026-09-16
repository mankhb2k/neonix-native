alter table public.render_jobs
  drop constraint if exists render_jobs_status_check;

alter table public.render_jobs
  add constraint render_jobs_status_check
  check (status in ('queued', 'planning', 'rendering', 'encoding', 'muxing', 'publishing', 'done', 'failed', 'cancelled'));

create or replace function public.render_queue_send(
  message jsonb,
  delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public
as $$
declare
  queued_message_id bigint;
begin
  select pgmq.send('render_jobs', message, delay_seconds)
    into queued_message_id;
  return queued_message_id;
end
$$;

create or replace function public.render_queue_read(
  visibility_timeout_seconds integer default 900,
  batch_size integer default 1
)
returns table(
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb,
  headers jsonb
)
language sql
security definer
set search_path = pgmq, public
as $$
  select msg_id, read_ct, enqueued_at, vt, message, headers
  from pgmq.read('render_jobs', visibility_timeout_seconds, batch_size, null::jsonb);
$$;

create or replace function public.render_queue_delete(message_id bigint)
returns boolean
language sql
security definer
set search_path = pgmq, public
as $$
  select pgmq.delete('render_jobs', message_id);
$$;

create or replace function public.render_queue_archive(message_id bigint)
returns boolean
language sql
security definer
set search_path = pgmq, public
as $$
  select pgmq.archive('render_jobs', message_id);
$$;

revoke all on function public.render_queue_send(jsonb, integer) from public, anon, authenticated;
revoke all on function public.render_queue_read(integer, integer) from public, anon, authenticated;
revoke all on function public.render_queue_delete(bigint) from public, anon, authenticated;
revoke all on function public.render_queue_archive(bigint) from public, anon, authenticated;

grant execute on function public.render_queue_send(jsonb, integer) to service_role;
grant execute on function public.render_queue_read(integer, integer) to service_role;
grant execute on function public.render_queue_delete(bigint) to service_role;
grant execute on function public.render_queue_archive(bigint) to service_role;
