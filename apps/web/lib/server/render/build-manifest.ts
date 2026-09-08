import {
  orthographicProjectionMatrix,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { RENDER_PRESET_SPECS, type RenderPresetId } from "@motionvideo/export-renderer/contracts";

/**
 * Minimal V3 runtime for the API stub. Real export orchestration will load
 * the compiled RuntimeProjectV3 for the requested project before dispatch.
 */
export function buildStubRuntimeProjectV3(input: {
  projectId: string;
  preset: RenderPresetId;
}): RuntimeProjectV3 {
  const spec = RENDER_PRESET_SPECS[input.preset];
  const worldToClipMatrix = orthographicProjectionMatrix(
    spec.width,
    spec.height,
    1,
    1,
    4000,
  );
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: input.projectId,
    durationUs: 0,
    visual: {
      composition: {
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      background: "#000000",
        graphId: input.projectId,
      },
      view: {
        worldToClipMatrix,
      },
      nodes: [],
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48000, tracks: [] },
  };
}
