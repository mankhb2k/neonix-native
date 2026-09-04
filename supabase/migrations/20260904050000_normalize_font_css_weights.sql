-- Catalog `weight` is the CSS selection weight. Keep the original OS/2 value
-- as metadata so font matching never conflates binary metadata with CSS API
-- semantics (for example Inter Thin and ExtraLight may both report 250).
update system_catalog.font_files
set metadata_json = coalesce(metadata_json, '{}'::jsonb)
  || jsonb_build_object('os2WeightClass', weight)
where not (coalesce(metadata_json, '{}'::jsonb) ? 'os2WeightClass');

update system_catalog.font_files
set weight = case
  when lower(coalesce(subfamily_name, '')) ~ '(hairline|thin)' then 100
  when lower(coalesce(subfamily_name, '')) ~ '(extra.?light|ultra.?light)' then 200
  when lower(coalesce(subfamily_name, '')) ~ 'light' then 300
  when lower(coalesce(subfamily_name, '')) ~ '(regular|book|normal)' then 400
  when lower(coalesce(subfamily_name, '')) ~ 'medium' then 500
  when lower(coalesce(subfamily_name, '')) ~ '(semi.?bold|demi.?bold)' then 600
  when lower(coalesce(subfamily_name, '')) ~ '(extra.?bold|ultra.?bold)' then 800
  when lower(coalesce(subfamily_name, '')) ~ 'bold' then 700
  when lower(coalesce(subfamily_name, '')) ~ '(black|heavy)' then 900
  else greatest(1, least(1000, round(weight / 100.0) * 100))
end;
