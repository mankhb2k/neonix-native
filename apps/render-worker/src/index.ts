import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import type { RenderJobStatus } from "@motionvideo/shared";
import { compileMotionProject } from "./compiler";
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

  const compiled = compileMotionProject(project);
  const framesOrScene = await renderCompiledProject(compiled);
  const files = await encodeOutputs(framesOrScene, project.metadata.aspectRatio, compiled);
  const urls = await uploadOutputs(files);
  return { status: "done", urls };
}

export type { MotionProject };

console.log("[render-worker] ready — run `pnpm e2e` for a real MP4 smoke test");

void processJob;
