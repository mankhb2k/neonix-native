drop policy workspace_members_delete_owner on public.workspace_members;
drop policy workspace_members_delete_self on public.workspace_members;

create policy workspace_members_delete_self_or_owner on public.workspace_members
for delete to authenticated
using (
  user_id = (select auth.uid())
  or has_workspace_role(workspace_id, 'owner')
);
