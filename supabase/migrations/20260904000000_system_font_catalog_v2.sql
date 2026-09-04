-- System font catalog v2.
-- Font binaries stay in the private Cloudflare R2 system-assets bucket;
-- Postgres stores the searchable, compiler-facing catalog and font metadata.

alter table public.font_families
  add column if not exists source text not null default 'system';

alter table public.font_families
  drop constraint if exists font_families_source_check;

alter table public.font_families
  add constraint font_families_source_check
  check (source in ('system', 'user'));

alter table public.font_files
  add column if not exists subfamily_name text,
  add column if not exists postscript_name text,
  add column if not exists width_class text not null default 'normal',
  add column if not exists axes_json jsonb not null default '{}'::jsonb,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

alter table public.font_files
  alter column storage_bucket set default 'neonix-system-assets';

update public.font_files
set storage_bucket = 'neonix-system-assets'
where storage_bucket = 'neonix-system-fonts';

alter table public.font_files
  drop constraint if exists font_files_weight_check,
  drop constraint if exists font_files_style_check,
  drop constraint if exists font_files_font_family_id_version_weight_style_format_key,
  drop constraint if exists font_files_width_class_check,
  drop constraint if exists font_files_axes_json_object_check,
  drop constraint if exists font_files_metadata_json_object_check;

alter table public.font_files
  add constraint font_files_weight_check
    check (weight between 1 and 1000),
  add constraint font_files_style_check
    check (style in ('normal', 'italic', 'oblique')),
  add constraint font_files_width_class_check
    check (width_class in (
      'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
      'normal',
      'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'
    )),
  add constraint font_files_axes_json_object_check
    check (jsonb_typeof(axes_json) = 'object'),
  add constraint font_files_metadata_json_object_check
    check (jsonb_typeof(metadata_json) = 'object'),
  add constraint font_files_catalog_identity_key
    unique (font_family_id, version, weight, style, width_class, format);

create index if not exists font_families_enabled_source_idx
  on public.font_families (source, family_name)
  where enabled;

create index if not exists font_files_enabled_lookup_idx
  on public.font_files (font_family_id, width_class, weight, style)
  where enabled;

grant select on public.font_families, public.font_files to authenticated;
