create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues()
    where queue_name = 'render_jobs'
  ) then
    perform pgmq.create('render_jobs');
  end if;
end
$$;
