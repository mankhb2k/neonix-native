-- Requeue an archived PGMQ message without deleting its DLQ audit record.
-- This is intentionally service-role-only and requires an explicit operator
-- message id; the consumer still applies the normal terminal/idempotency guard.

create or replace function public.render_queue_replay_archived(
  p_message_id bigint,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public
as $$
declare
  archived_message jsonb;
  replay_message_id bigint;
begin
  select message
    into archived_message
    from pgmq.a_render_jobs
   where msg_id = p_message_id;

  if archived_message is null then
    raise exception 'Archived render queue message % was not found', p_message_id;
  end if;

  select pgmq.send('render_jobs', archived_message, greatest(coalesce(p_delay_seconds, 0), 0))
    into replay_message_id;
  return replay_message_id;
end;
$$;

revoke all on function public.render_queue_replay_archived(bigint, integer) from public, anon, authenticated;
grant execute on function public.render_queue_replay_archived(bigint, integer) to service_role;
