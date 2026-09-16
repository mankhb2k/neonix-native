import { createClient } from "@supabase/supabase-js";

export const RENDER_QUEUE_NAME = "render_jobs";

export type RenderQueueMessage = {
  schemaVersion: 2;
  jobId: string;
};

export type RenderQueueMessageRow = {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: RenderQueueMessage;
  headers: Record<string, unknown> | null;
};

export function isRenderQueueEnabled(): boolean {
  return process.env.RENDER_QUEUE_ENABLED?.trim().toLowerCase() === "true";
}

function createQueueAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function enqueueRenderJob(input: {
  jobId: string;
  delaySeconds?: number;
}): Promise<number> {
  const manifest = await createQueueAdminClient().from("render_jobs").select("runtime_json, runtime_manifest_chunk_count").eq("public_ref", input.jobId).maybeSingle();
  if (manifest.error) throw new Error(`render queue manifest lookup failed: ${manifest.error.message}`);
  if (!manifest.data?.runtime_json && !manifest.data?.runtime_manifest_chunk_count) throw new Error(`render job ${input.jobId} has no persisted runtime manifest`);
  const client = createQueueAdminClient();
  const message: RenderQueueMessage = {
    schemaVersion: 2,
    jobId: input.jobId,
  };
  const result = await client.rpc("render_queue_send", {
    message,
    delay_seconds: input.delaySeconds ?? 0,
  });
  if (result.error) throw new Error(`render queue enqueue failed: ${result.error.message}`);
  const id = Number(result.data);
  if (!Number.isSafeInteger(id)) throw new Error("render queue enqueue returned an invalid message id");
  return id;
}

export async function readRenderQueue(input?: {
  visibilityTimeoutSeconds?: number;
  batchSize?: number;
}): Promise<RenderQueueMessageRow[]> {
  const client = createQueueAdminClient();
  const result = await client.rpc("render_queue_read", {
    visibility_timeout_seconds: input?.visibilityTimeoutSeconds ?? 900,
    batch_size: input?.batchSize ?? 1,
  });
  if (result.error) throw new Error(`render queue read failed: ${result.error.message}`);
  return (result.data ?? []) as RenderQueueMessageRow[];
}

export async function deleteRenderQueueMessage(messageId: number): Promise<void> {
  const result = await createQueueAdminClient().rpc("render_queue_delete", {
    message_id: messageId,
  });
  if (result.error) throw new Error(`render queue delete failed: ${result.error.message}`);
}

export async function archiveRenderQueueMessage(messageId: number): Promise<void> {
  const result = await createQueueAdminClient().rpc("render_queue_archive", {
    message_id: messageId,
  });
  if (result.error) throw new Error(`render queue archive failed: ${result.error.message}`);
}
