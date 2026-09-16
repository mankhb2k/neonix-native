import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { loadRuntimeManifest } from "../src/runtime-manifest";

function databaseForChunks(chunks: Buffer[]): SupabaseClient {
  return {
    rpc: async (_name: string, args: { p_chunk_index: number }) => ({
      data: [{ payload_base64: chunks[args.p_chunk_index]?.toString("base64") }],
      error: null,
    }),
  } as unknown as SupabaseClient;
}

describe("runtime manifest integrity", () => {
  it("reassembles bounded chunks and verifies the manifest SHA-256", async () => {
    const runtime = { version: 3, name: "integrity-fixture", layers: [] } as unknown as RuntimeProjectV3;
    const payload = Buffer.from(JSON.stringify(runtime), "utf8");
    const chunks = [payload.subarray(0, 11), payload.subarray(11)];
    const sha256 = createHash("sha256").update(payload).digest("hex");

    await expect(loadRuntimeManifest(databaseForChunks(chunks), {
      id: "job-integrity",
      runtime_manifest_chunk_count: chunks.length,
      runtime_manifest_sha256: sha256,
    })).resolves.toEqual(runtime);
  });

  it("fails closed when a committed chunk set has a checksum mismatch", async () => {
    const payload = Buffer.from('{"version":3,"name":"tampered"}', "utf8");

    await expect(loadRuntimeManifest(databaseForChunks([payload]), {
      id: "job-tampered",
      runtime_manifest_chunk_count: 1,
      runtime_manifest_sha256: "0".repeat(64),
    })).rejects.toThrow("RUNTIME_MANIFEST_CHECKSUM_MISMATCH");
  });

  it("keeps legacy rows compatible when no checksum is present", async () => {
    const runtime = { version: 3, name: "legacy-fixture", layers: [] } as unknown as RuntimeProjectV3;
    const payload = Buffer.from(JSON.stringify(runtime), "utf8");

    await expect(loadRuntimeManifest(databaseForChunks([payload]), {
      id: "job-legacy",
      runtime_manifest_chunk_count: 1,
    })).resolves.toEqual(runtime);
  });
});
