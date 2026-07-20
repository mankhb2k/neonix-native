import { parseMotionProject } from "@motionvideo/motion-schema";
import type { RenderJobStatus } from "@motionvideo/shared";
import { compileMotionProject } from "./compiler";
import { encodeOutputs } from "./ffmpeg";
import { renderCompiledProject } from "./runtime";
import { uploadOutputs } from "./upload";

async function processJob(rawProject: unknown): Promise<{
  status: RenderJobStatus;
  urls?: string[];
}> {
  const project = parseMotionProject(rawProject);
  const compiled = compileMotionProject(project);
  const framesOrScene = await renderCompiledProject(compiled);
  const files = await encodeOutputs(framesOrScene, project.aspectRatio);
  const urls = await uploadOutputs(files);
  return { status: "done", urls };
}

console.log("[render-worker] stub ready — queue wiring comes next");

// Keep import graph alive for typecheck / future queue consumer
void processJob;
