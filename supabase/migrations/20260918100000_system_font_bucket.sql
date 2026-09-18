-- Keep future system font catalog entries in the dedicated private font bucket.
-- Existing rows are migrated only after the new R2 objects have been uploaded
-- and verified by apps/web/scripts/sync-system-fonts.ts.

alter table system_catalog.font_files
  alter column storage_bucket set default 'neonix-system-fonts';
