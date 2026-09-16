-- Explicitly remove PostgREST's default role grants from internal lifecycle RPCs.

revoke all on function public.claim_media_job(uuid, text, integer) from anon;
revoke all on function public.recover_stale_media_jobs(integer) from anon;
revoke all on function public.recover_stale_media_jobs(integer) from authenticated;

grant execute on function public.claim_media_job(uuid, text, integer) to authenticated;
grant execute on function public.claim_media_job(uuid, text, integer) to service_role;
grant execute on function public.recover_stale_media_jobs(integer) to service_role;
