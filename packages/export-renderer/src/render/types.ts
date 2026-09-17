import type { PaintCommandBuffer, RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type ExportRenderOptions = {
  outputPath: string;
  /** Encode only this many frames when running a local smoke test. */
  frameCount?: number;
  ffmpegPath?: string;
  ffmpegLogLevel?: "quiet" | "error" | "warning" | "info";
  /** H.264 preset; defaults to veryfast for the quality/speed baseline. */
  ffmpegPreset?: string;
  /** H.264 CRF; defaults to FFmpeg's codec default when omitted. */
  ffmpegCrf?: number;
  /** H.264 encoder threads; defaults to 1 for byte-stable output. */
  ffmpegThreads?: number;
  /** Filesystem root containing the web app's public directory. */
  assetRoot?: string;
  /** Native Skia is the only MP4 export backend; SVG is preview-only and rejected for export. */
  renderer?: "skia-native" | "skia" | "svg";
  /** Number of isolated renderer processes to use for video-only exports. */
  parallelism?: number;
  /** Frame range size for parallel segment rendering. */
  chunkSize?: number;
  /** Number of retries allowed for an individual failed chunk. */
  chunkRetries?: number;
  signal?: AbortSignal;
  onProgress?: (event: ExportRenderProgress) => void;
  /** Optional benchmark hook invoked with each physical RGBA readback. */
  onFrameReadback?: (pixels: Uint8Array, frame: number) => void;
};

export type ExportRenderProgress = {
  stage: "rendering" | "encoding";
  completedFrames: number;
  totalFrames: number;
};

export type ExportRenderStats = {
  projectId: string;
  /** Actual renderer identity; never infer this from the requested mode. */
  backendIdentity?: {
    requestedBackend: "raster" | "skia-gpu" | "svg";
    actualBackend: string;
    adapterName?: string;
    driverVersion?: string;
    surfaceKind: "raster" | "vulkan" | "webgl" | "unknown";
    softwareRenderer: boolean;
    fallbackReason?: string;
  };
  width: number;
  height: number;
  fps: number;
  frames: number;
  durationSeconds: number;
  outputPath: string;
  outputBytes: number;
  renderMilliseconds: number;
  encodeMilliseconds: number;
  encodeBreakdown?: {
    framesSubmitted: number;
    pipeWriteMilliseconds: number;
    backpressureWaitMilliseconds: number;
    finalizeMilliseconds: number;
  };
  renderBreakdown?: {
    evaluateMilliseconds: number;
    assetMilliseconds: number;
    paintAndReadbackMilliseconds: number;
    replayMilliseconds: number;
    flushMilliseconds: number;
    readbackMilliseconds: number;
    drawCalls: number;
    textMilliseconds: number;
    layerMilliseconds: number;
    endLayerMilliseconds: number;
    pathMilliseconds: number;
    shapeMilliseconds: number;
    offscreenSurfaceCreates: number;
    offscreenSurfaceReuses: number;
    filterCacheHits: number;
    maskCacheHits: number;
    audioPreparationMilliseconds?: number;
  };
  scheduler?: {
    strategy: "sequential" | "parallel-segments";
    requestedParallelism: number;
    actualParallelism: number;
    chunkSize: number;
    chunkCount: number;
    retryCount: number;
    chunkChecksums?: Record<string, string>;
    fallbackReason?: "audio" | "renderer";
  };
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
