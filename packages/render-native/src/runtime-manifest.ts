import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type RuntimeManifestRow = {
  id?: string;
  runtime_json?: RuntimeProjectV3 | null;
  runtime_manifest_text?: string | null;
  runtime_manifest_chunk_count?: number | null;
  runtime_manifest_sha256?: string | null;
};

/**
 * Loads the immutable runtime without asking PostgREST to serialize a large
 * manifest column in one response. Finalized manifests are fetched one 1 MiB
 * chunk at a time through a service-role-only RPC.
 */
export async function loadRuntimeManifest(
  database: SupabaseClient,
  row: RuntimeManifestRow,
): Promise<RuntimeProjectV3 | null> {
  if (row.runtime_json) return row.runtime_json;

  const chunkCount = Number(row.runtime_manifest_chunk_count ?? 0);
  if (Number.isInteger(chunkCount) && chunkCount > 0) {
    if (!row.id) throw new Error("Runtime manifest chunk row is missing job id");
    if (chunkCount > 4096) throw new Error(`Runtime manifest has too many chunks: ${chunkCount}`);
    const chunks: Buffer[] = [];
    const digest = createHash("sha256");
    for (let index = 0; index < chunkCount; index += 1) {
      const result = await database.rpc("render_job_runtime_manifest_get_chunk", {
        p_job_id: row.id,
        p_chunk_index: index,
      });
      if (result.error) throw new Error(`Unable to load runtime manifest chunk ${index}: ${result.error.message}`);
      const item = Array.isArray(result.data) ? result.data[0] : result.data;
      const payload = item && typeof item === "object" ? (item as { payload_base64?: unknown }).payload_base64 : undefined;
      if (typeof payload !== "string") throw new Error(`Runtime manifest chunk ${index} is missing payload`);
      const chunk = Buffer.from(payload, "base64");
      digest.update(chunk);
      chunks.push(chunk);
    }
    const expectedSha256 = row.runtime_manifest_sha256?.trim().toLowerCase();
    if (expectedSha256) {
      const actualSha256 = digest.digest("hex");
      if (actualSha256 !== expectedSha256) {
        throw new Error(`RUNTIME_MANIFEST_CHECKSUM_MISMATCH: ${actualSha256}/${expectedSha256}`);
      }
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as RuntimeProjectV3;
    } catch {
      return null;
    }
  }

  if (!row.runtime_manifest_text) return null;
  try {
    return JSON.parse(row.runtime_manifest_text) as RuntimeProjectV3;
  } catch {
    return null;
  }
}
