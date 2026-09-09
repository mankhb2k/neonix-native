-- Make Protocol V2 the canonical revision for HTML-authored projects.
-- project_html_revisions remains the optional authoring source and points to
-- the immutable project_revisions row produced by the compiler.

alter table public.project_html_revisions
  add column if not exists protocol_revision_id uuid;

create unique index if not exists project_revisions_id_project_uidx
  on public.project_revisions (id, project_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_html_revisions_protocol_revision_id_fkey'
  ) then
    alter table public.project_html_revisions
      add constraint project_html_revisions_protocol_revision_id_fkey
      foreign key (protocol_revision_id, project_id)
      references public.project_revisions (id, project_id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists project_html_revisions_protocol_revision_uidx
  on public.project_html_revisions (protocol_revision_id)
  where protocol_revision_id is not null;

comment on column public.project_html_revisions.protocol_revision_id is
  'Canonical Protocol V2 revision generated from this HTML authoring source.';

grant select, insert on public.project_html_revisions to authenticated;
