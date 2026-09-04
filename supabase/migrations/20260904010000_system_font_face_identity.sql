-- Some fonts legitimately share the same OS/2 weight class (for example
-- Inter Thin and ExtraLight both declare 250). Keep those faces addressable
-- by their PostScript/source identity instead of collapsing them in a CSS
-- weight-only uniqueness key.

alter table public.font_files
  add column if not exists face_key text;

update public.font_files
set face_key = coalesce(nullif(postscript_name, ''), r2_key)
where face_key is null;

alter table public.font_files
  alter column face_key set not null;

alter table public.font_files
  drop constraint if exists font_files_catalog_identity_key,
  drop constraint if exists font_files_face_format_key;

alter table public.font_files
  add constraint font_files_face_format_key
  unique (font_family_id, face_key, format);

create index if not exists font_files_face_lookup_idx
  on public.font_files (font_family_id, face_key)
  where enabled;
