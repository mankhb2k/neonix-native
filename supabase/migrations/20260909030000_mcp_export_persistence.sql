-- Hosted MCP exports mirror the renderer job lifecycle in the existing
-- render_jobs table. The MCP principal may update only jobs it created.

drop policy if exists render_jobs_update_owner on public.render_jobs;
create policy render_jobs_update_owner on public.render_jobs
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

grant update on public.render_jobs to authenticated;
