import { stdin, stdout } from "node:process";
import { renderFrameRangeToMp4 } from "./render";
import type { FrameRange } from "./frame-range-scheduler";
import type { ExportRenderStats } from "./types";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

type Request = {
  project: RuntimeProjectV3;
  outputPath: string;
  range: FrameRange;
  assetRoot: string;
  ffmpegPath: string;
  ffmpegLogLevel?: "quiet" | "error" | "warning" | "info";
  ffmpegPreset?: string;
  ffmpegCrf?: number;
  ffmpegThreads?: number;
};

let input = "";
for await (const chunk of stdin) input += chunk;

const request = JSON.parse(input) as Request;
const stats: ExportRenderStats = await renderFrameRangeToMp4(
  request.project,
  {
    outputPath: request.outputPath,
    assetRoot: request.assetRoot,
    ffmpegPath: request.ffmpegPath,
    ffmpegLogLevel: request.ffmpegLogLevel,
    ffmpegPreset: request.ffmpegPreset,
    ffmpegCrf: request.ffmpegCrf,
    ffmpegThreads: request.ffmpegThreads,
    renderer: "skia",
    onProgress: (event) => {
      stdout.write(`${JSON.stringify({
        type: "progress",
        completedFrames: event.completedFrames,
        totalFrames: event.totalFrames,
      })}\n`);
    },
  },
  request.range,
  undefined,
);
stdout.write(`${JSON.stringify({ type: "result", stats })}\n`);
