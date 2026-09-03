import type { PaintCommandBuffer, RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type ExportRenderOptions = {
  outputPath: string;
  /** Encode only this many frames when running a local smoke test. */
  frameCount?: number;
  ffmpegPath?: string;
  ffmpegLogLevel?: "quiet" | "error" | "warning" | "info";
  /** Filesystem root containing the web app's public directory. */
  assetRoot?: string;
  /** Skia is the Phase 9 visual export backend; SVG remains available only for legacy helpers. */
  renderer?: "skia" | "svg";
};

export type ExportRenderStats = {
  projectId: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  durationSeconds: number;
  outputPath: string;
  outputBytes: number;
  renderMilliseconds: number;
  encodeMilliseconds: number;
};

export type RenderedFrame = {
  frame: number;
  commands: PaintCommandBuffer;
  svg: string;
};

export type RuntimeFrameEvaluator = (
  project: RuntimeProjectV3,
  frame: number,
) => PaintCommandBuffer;
