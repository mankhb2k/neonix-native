import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { getR2ProviderForBucketName } from "@/lib/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeletionJob = {
  id: string;
  storage_bucket: string;
  object_key: string;
};

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function drainDeletionJobs(client: ReturnType<typeof createSupabaseAdminClient>, maxBatches = 10, batchSize = 25) {
  let processed = 0;
  let failed = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const claimed = await client.rpc("claim_object_deletion_jobs", { p_limit: batchSize });
    if (claimed.error) throw new Error(`claim_object_deletion_jobs failed: ${claimed.error.message}`);
    const jobs = (claimed.data ?? []) as DeletionJob[];
    if (jobs.length === 0) break;

    await Promise.all(jobs.map(async (job) => {
      const provider = getR2ProviderForBucketName(job.storage_bucket);
      try {
        if (!provider) throw new Error(`Unknown storage bucket: ${job.storage_bucket}`);
        await provider.deleteObject(job.object_key);
        await client.rpc("complete_object_deletion_job", { p_id: job.id, p_success: true });
        processed += 1;
      } catch (error) {
        failed += 1;
        await client.rpc("complete_object_deletion_job", {
          p_id: job.id,
          p_success: false,
          p_error: error instanceof Error ? error.message : String(error),
        });
      }
    }));

    if (jobs.length < batchSize) break;
  }
  return { processed, failed };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const client = createSupabaseAdminClient();

  const purged = await client.rpc("purge_expired_projects");
  if (purged.error) return Response.json({ error: purged.error.message }, { status: 500 });

  const reaped = await client.rpc("reap_expired_upload_sessions");
  if (reaped.error) return Response.json({ error: reaped.error.message }, { status: 500 });

  const drained = await drainDeletionJobs(client);

  return Response.json({
    projectsPurged: purged.data ?? 0,
    uploadSessionsReaped: reaped.data ?? 0,
    deletionJobsProcessed: drained.processed,
    deletionJobsFailed: drained.failed,
  });
}
