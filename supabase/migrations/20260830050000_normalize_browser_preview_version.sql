-- Browser-generated video posters use preview contract version 3.
-- Older rows may have been overwritten with the media pipeline version by the
-- callback; normalize active assets that already have a persisted poster.

update public.assets
set preview_version = 3
where mime_type like 'video/%'
  and preview_key is not null
  and preview_status = 'ready'
  and status <> 'deleted';
