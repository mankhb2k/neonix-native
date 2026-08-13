import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { validateMotionProjectPresets } from "@motionvideo/motion-compiler";
import type { RenderJobStatus } from "@motionvideo/render-contracts";
import { compileProject } from "./compiler";
import { compositionAspectRatio } from "./aspect";
import { encodeOutputs } from "./ffmpeg";
import { renderCompiledProject } from "./runtime";
import { uploadOutputs } from "./upload";

export async function processJob(rawProject: unknown): Promise<{
  status: RenderJobStatus;
  urls?: string[];
  error?: string;
}> {
  const project = parseMotionProject(rawProject);
  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    const detail = presetCheck.unknown
      .map((u) => `${u.sceneId}/${u.nodeId}:${u.preset}`)
      .join(", ");
    return {
      status: "failed",
      error: `Unknown animation presets: ${detail}`,
    };
  }

  const compiled = compileProject(project);

  // Blank-video guard: a canonical project always carries an explicit
  // timeline.duration, but an empty draft derives `0`. MP4 export cannot
  // produce a zero-length file unless blank videos are intentionally
  // supported by the product.
  if ((compiled.timeline.duration ?? 0) <= 0) {
    return {
      status: "failed",
      error: "Cannot export: timeline has no content (derived duration is 0).",
    };
  }

  const framesOrScene = await renderCompiledProject(compiled);
  const files = await encodeOutputs(
    framesOrScene,
    compositionAspectRatio(project),
    compiled,
  );
  const urls = await uploadOutputs(files);
  return { status: "done", urls };
}

export type { MotionProject };

console.log("[render-worker] ready — run `pnpm e2e` for a real MP4 smoke test");

void processJob;
