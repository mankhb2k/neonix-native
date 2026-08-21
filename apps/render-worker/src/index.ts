import { encodeOutputs } from "./ffmpeg";
import { uploadOutputs } from "./upload";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import type { RenderJobStatus } from "./job-status";
import {
  renderRuntimeProjectV2,
  runtimeProjectV2Aspect,
} from "./runtime/render-v2";

export async function processJob(rawProject: unknown): Promise<{
  status: RenderJobStatus;
  urls?: string[];
  error?: string;
}> {
  try {
    const protocol = MotionProtocolV2Schema.parse(rawProject);
    const runtime = compileProtocolV2(protocol);
    const rendered = await renderRuntimeProjectV2(runtime, {
      outDir: process.env.MOTIONVIDEO_RENDER_OUT_DIR ?? `tmp/frames/${runtime.id}`,
    });
    const files = await encodeOutputs(rendered, runtimeProjectV2Aspect(runtime));
    const urls = await uploadOutputs(files);
    return { status: "done", urls };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

console.log("[render-worker] Protocol V2 worker ready");

void processJob;
