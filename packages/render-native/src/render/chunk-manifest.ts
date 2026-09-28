import type { RuntimeMediaResourceV3, RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { canonicalJson, computeRuntimeHash, sha256Hex } from "../contracts";
import { planFrameRanges, type FrameRange } from "./frame-range-scheduler";

export const RENDER_CHUNK_MANIFEST_VERSION = 1 as const;

export type RenderChunkAssetVersion = {
  mediaId: string;
  streamId?: string;
  resourceId: string;
  role: RuntimeMediaResourceV3["role"];
  uri: string;
  integrity?: string;
  byteSize?: number;
};

export type RenderChunkDescriptor = FrameRange & {
  chunkId: string;
  chunkIndex: number;
  attempt: number;
};

export type RenderChunkManifest = {
  manifestVersion: typeof RENDER_CHUNK_MANIFEST_VERSION;
  runtimeChecksum: string;
  assetVersions: RenderChunkAssetVersion[];
  composition: {
    width: number;
    height: number;
    fps: number;
    durationUs: number;
    totalFrames: number;
  };
  chunkSize: number;
  parallelism: number;
  chunks: RenderChunkDescriptor[];
  checksum: string;
};

export type RenderChunkManifestOptions = {
  chunkSize?: number;
  parallelism?: number;
  attempt?: number;
};

export type RenderJobChunkInsert = {
  render_job_id: string;
  chunk_index: number;
  start_frame: number;
  end_frame_exclusive: number;
  attempt: number;
  status: "queued";
  runtime_checksum: string;
  asset_versions_json: RenderChunkAssetVersion[];
  metrics_json: Record<string, never>;
};

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return value;
}

function resourceVersion(
  mediaId: string,
  resource: RuntimeMediaResourceV3,
  streamId?: string,
): RenderChunkAssetVersion {
  return {
    mediaId,
    ...(streamId ? { streamId } : {}),
    resourceId: resource.resourceId,
    role: resource.role,
    uri: resource.uri,
    ...(resource.integrity ? { integrity: resource.integrity } : {}),
    ...(resource.byteSize !== undefined ? { byteSize: resource.byteSize } : {}),
  };
}

function assetVersions(runtime: RuntimeProjectV3): RenderChunkAssetVersion[] {
  const versions = runtime.mediaCatalog.assets.flatMap((asset) => [
    ...(asset.video ?? []).map((stream) => resourceVersion(asset.mediaId, stream.resource, stream.streamId)),
    ...(asset.audio ?? []).map((stream) => resourceVersion(asset.mediaId, stream.resource, stream.streamId)),
    ...(asset.poster ? [resourceVersion(asset.mediaId, asset.poster)] : []),
  ]);
  return versions.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function totalFramesFor(runtime: RuntimeProjectV3): number {
  const { duration } = runtime.visual.composition;
  const fps = runtime.visual.composition.fps;
  return Math.max(1, Math.ceil((duration ?? runtime.durationUs / 1_000_000) * fps));
}

/**
 * Build the deterministic frame manifest consumed by the future Cloud Run
 * indexed coordinator. It contains no job-specific timestamps or URLs that
 * can change after creation; retries only change the chunk attempt row.
 */
export function buildRenderChunkManifest(
  runtime: RuntimeProjectV3,
  options: RenderChunkManifestOptions = {},
): RenderChunkManifest {
  const chunkSize = positiveInteger(options.chunkSize ?? 300, "chunkSize");
  const parallelism = positiveInteger(options.parallelism ?? 4, "parallelism");
  const attempt = positiveInteger(options.attempt ?? 1, "attempt");
  const totalFrames = totalFramesFor(runtime);
  const ranges = planFrameRanges(totalFrames, chunkSize);
  const chunks = ranges.map((range, chunkIndex) => ({
    ...range,
    chunkId: `chunk-${chunkIndex}`,
    chunkIndex,
    attempt,
  }));
  const manifestWithoutChecksum = {
    manifestVersion: RENDER_CHUNK_MANIFEST_VERSION,
    runtimeChecksum: computeRuntimeHash(runtime as unknown as Record<string, unknown>),
    assetVersions: assetVersions(runtime),
    composition: {
      width: runtime.visual.composition.width,
      height: runtime.visual.composition.height,
      fps: runtime.visual.composition.fps,
      durationUs: runtime.durationUs,
      totalFrames,
    },
    chunkSize,
    parallelism,
    chunks,
  };
  return {
    ...manifestWithoutChecksum,
    checksum: sha256Hex(canonicalJson(manifestWithoutChecksum)),
  };
}

export function toRenderJobChunkRows(
  renderJobId: string,
  manifest: RenderChunkManifest,
): RenderJobChunkInsert[] {
  return manifest.chunks.map((chunk) => ({
    render_job_id: renderJobId,
    chunk_index: chunk.chunkIndex,
    start_frame: chunk.startFrame,
    end_frame_exclusive: chunk.endFrameExclusive,
    attempt: chunk.attempt,
    status: "queued",
    runtime_checksum: manifest.runtimeChecksum,
    asset_versions_json: manifest.assetVersions,
    metrics_json: {},
  }));
}

export function assertContiguousRenderChunkManifest(manifest: RenderChunkManifest): void {
  let cursor = 0;
  for (const [index, chunk] of manifest.chunks.entries()) {
    if (chunk.chunkIndex !== index || chunk.startFrame !== cursor || chunk.endFrameExclusive <= chunk.startFrame) {
      throw new Error("Render chunk manifest contains a gap, overlap, or unstable index.");
    }
    cursor = chunk.endFrameExclusive;
  }
  if (cursor !== manifest.composition.totalFrames) {
    throw new Error("Render chunk manifest does not cover the complete composition.");
  }
}
