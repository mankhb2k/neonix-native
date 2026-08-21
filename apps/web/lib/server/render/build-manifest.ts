/**
 * Minimal RenderManifest builder for create-job (server-owned URLs).
 */

import {
  CAPABILITY_MANIFEST_VERSION,
  createMatrix4,
  orthographicMatrix2D,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import {
  parseRenderManifest,
  REMOTION_PIN,
  RENDER_PRESET_SPECS,
  type RenderManifest,
  type RenderPresetId,
} from "@motionvideo/render-contracts";

export function buildStubRenderManifest(input: {
  projectId: string;
  projectRevision: number;
  preset: RenderPresetId;
}): RenderManifest {
  const spec = RENDER_PRESET_SPECS[input.preset];
  const serveBase =
    process.env.REMOTION_SERVE_URL ?? "https://example.invalid/remotion-site";
  return parseRenderManifest({
    format: "moticlip-render-manifest",
    manifestVersion: 2,
    projectId: input.projectId,
    projectRevision: input.projectRevision,
    versions: {
      schema: 2,
      compiler: "0.0.1",
      runtime: "0.0.1",
      remotion: REMOTION_PIN,
      capabilityManifest: CAPABILITY_MANIFEST_VERSION,
    },
    contentHash: "0".repeat(64),
    determinism: {
      version: 1,
      frameEpsilon: 1.776e-15,
      geometryEpsilon: 1e-12,
      lengthEpsilon: 1e-9,
      hashAlgorithm: "sha256",
      canonicalJson: true,
    },
    composition: {
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      durationInFrames: Math.max(1, spec.fps * 3),
      background: "#000000",
    },
    runtime: {
      url: `${serveBase}/runtime/${input.projectId}.json`,
      sha256: "pending-server-hash",
    },
    assets: [],
    output: {
      codec: spec.codec,
      pixelFormat: spec.pixelFormat,
      privacy: "private",
    },
  });
}

/**
 * Temporary V2 runtime for the API stub. Real export orchestration will load
 * the compiled RuntimeProjectV2 for the requested project before dispatch.
 */
export function buildStubRuntimeProjectV2(input: {
  projectId: string;
  preset: RenderPresetId;
}): RuntimeProjectV2 {
  const spec = RENDER_PRESET_SPECS[input.preset];
  const projection = orthographicMatrix2D(spec.width, spec.height);
  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: input.projectId,
    composition: {
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      background: "#000000",
      graphId: input.projectId,
    },
    view: {
      viewMatrix: createMatrix4(),
      projectionMatrix: projection,
      viewProjectionMatrix: projection,
    },
    nodes: [],
  };
}
