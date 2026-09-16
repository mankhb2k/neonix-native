alter table public.render_jobs
  add column if not exists artifact_path text,
  add column if not exists progress numeric not null default 0,
  add column if not exists stage text,
  add column if not exists metrics_json jsonb not null default '{}'::jsonb,
  add column if not exists runtime_json jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.render_jobs
  drop constraint if exists render_jobs_progress_check,
  drop constraint if exists render_jobs_metrics_json_check,
  drop constraint if exists render_jobs_runtime_json_check;

alter table public.render_jobs
  add constraint render_jobs_progress_check
    check (progress >= 0 and progress <= 1),
  add constraint render_jobs_metrics_json_check
    check (jsonb_typeof(metrics_json) = 'object'),
  add constraint render_jobs_runtime_json_check
    check (runtime_json is null or jsonb_typeof(runtime_json) = 'object');

create index if not exists render_jobs_status_idx
  on public.render_jobs (status, updated_at);

drop trigger if exists render_jobs_touch_updated_at on public.render_jobs;
create trigger render_jobs_touch_updated_at
before update on public.render_jobs
for each row execute function public.touch_updated_at();
