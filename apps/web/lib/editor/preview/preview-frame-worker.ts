/**
 * Preview frame worker — evaluate + Canvas2D replay → transferable ImageBitmap.
 * Isolated from the main-thread DOM tsconfig (no webworker lib reference).
 */

import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";
import type { Canvas2DReplayContext } from "@motionvideo/motion-runtime";
import {
  WORKER_PROTOCOL_VERSION,
  getTransferableForMessage,
  type MainToWorkerMessage,
  type WorkerToMainMessage,
} from "@motionvideo/render-contracts";
import {
  evaluatePreviewFrame,
  paintUrisFromFrame,
  replayEvaluatedPreview,
} from "./produce-preview-frame";

const workerSelf = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<MainToWorkerMessage>) => void) | null;
};

const MAX_CACHED_IMAGES = 32;

let runtime: MotionRuntimeProject | null = null;
let canvas: OffscreenCanvas | null = null;
let width = 1920;
let height = 1080;
let fps = 30;
let disposed = false;
const imageCache = new Map<string, ImageBitmap>();
let handleChain: Promise<void> = Promise.resolve();

function send(message: WorkerToMainMessage, transfer: Transferable[] = []): void {
  workerSelf.postMessage(message, transfer);
}

function sendError(
  err: unknown,
  extra?: { time?: number; requestId?: number; sequenceId?: number },
): void {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (extra && extra.requestId != null && extra.time != null && extra.sequenceId != null) {
    send({
      type: "frameError",
      time: extra.time,
      requestId: extra.requestId,
      sequenceId: extra.sequenceId,
      error: message,
    });
    return;
  }
  send({ type: "error", message, sequenceId: extra?.sequenceId ?? 0 });
}

function compositionSize(next: MotionRuntimeProject): {
  width: number;
  height: number;
} {
  const w = next.composition?.width;
  const h = next.composition?.height;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    return { width: w, height: h };
  }
  if (next.metadata.aspectRatio === "9:16") {
    return { width: 1080, height: 1920 };
  }
  return { width: 1920, height: 1080 };
}

function applyRuntime(next: MotionRuntimeProject): void {
  runtime = next;
  if (typeof next.metadata.fps === "number" && next.metadata.fps > 0) {
    fps = Math.max(1, next.metadata.fps);
  }
  const size = compositionSize(next);
  if (!canvas || canvas.width !== size.width || canvas.height !== size.height) {
    canvas = new OffscreenCanvas(size.width, size.height);
  }
  width = size.width;
  height = size.height;
}

function cacheImage(uri: string, bmp: ImageBitmap): void {
  const hit = imageCache.get(uri);
  if (hit) {
    imageCache.delete(uri);
    imageCache.set(uri, hit);
    if (hit !== bmp) {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
    return;
  }
  while (imageCache.size >= MAX_CACHED_IMAGES) {
    const oldest = imageCache.keys().next().value;
    if (typeof oldest !== "string") break;
    const evicted = imageCache.get(oldest);
    imageCache.delete(oldest);
    try {
      evicted?.close();
    } catch {
      /* ignore */
    }
  }
  imageCache.set(uri, bmp);
}

async function ensureImage(uri: string): Promise<ImageBitmap | null> {
  const hit = imageCache.get(uri);
  if (hit) {
    imageCache.delete(uri);
    imageCache.set(uri, hit);
    return hit;
  }
  try {
    const res = await fetch(uri);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    cacheImage(uri, bmp);
    return bmp;
  } catch {
    return null;
  }
}

async function captureBitmap(target: OffscreenCanvas): Promise<ImageBitmap> {
  return createImageBitmap(target);
}

async function produce(time: number, requestId: number, sequenceId: number): Promise<void> {
  if (disposed || !runtime || !canvas) {
    sendError("worker not initialized", { time, requestId, sequenceId });
    return;
  }
  const t0 = performance.now();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    sendError("OffscreenCanvas 2d context unavailable", {
      time,
      requestId,
      sequenceId,
    });
    return;
  }
  const replayCtx = ctx as unknown as Canvas2DReplayContext;
  const painted = evaluatePreviewFrame({
    runtime,
    time,
    fps,
    width,
    height,
  });
  if (!painted) {
    sendError("evaluate returned null", { time, requestId, sequenceId });
    return;
  }
  const uris = paintUrisFromFrame(painted.evaluated);
  if (uris.length > 0) {
    await Promise.all(uris.map((uri) => ensureImage(uri)));
  }
  const painterMs = replayEvaluatedPreview(
    replayCtx,
    painted.evaluated,
    (uri) => imageCache.get(uri) ?? null,
  );
  const encodeT0 = performance.now();
  const bitmap = await captureBitmap(canvas);
  const encodeMs = performance.now() - encodeT0;
  const msg: WorkerToMainMessage = {
    type: "frame",
    time,
    frame: bitmap,
    requestId,
    sequenceId,
    timings: {
      totalMs: performance.now() - t0,
      evaluateMs: painted.evaluateMs,
      paintBuildMs: 0,
      painterMs,
      encodeMs,
      sentAt: performance.now(),
    },
  };
  send(msg, getTransferableForMessage(msg));
}

async function handle(msg: MainToWorkerMessage): Promise<void> {
  if (disposed && msg.type !== "init") return;
  if (msg.type === "init") {
    if (msg.protocolVersion !== WORKER_PROTOCOL_VERSION) {
      sendError(`protocol mismatch: ${msg.protocolVersion}`);
      return;
    }
    applyRuntime(JSON.parse(msg.runtimeJson) as MotionRuntimeProject);
    width = msg.width;
    height = msg.height;
    fps = Math.max(1, msg.fps);
    canvas = new OffscreenCanvas(width, height);
    disposed = false;
    send({
      type: "ready",
      backend: "canvas-2d",
      width,
      height,
      timeOrigin: performance.timeOrigin,
    });
    return;
  }
  if (msg.type === "setSource") {
    applyRuntime(JSON.parse(msg.runtimeJson) as MotionRuntimeProject);
    return;
  }
  if (msg.type === "produceFrame") {
    await produce(msg.time, msg.requestId, msg.sequenceId);
    return;
  }
  if (msg.type === "dispose") {
    disposed = true;
    for (const bmp of imageCache.values()) {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
    imageCache.clear();
    runtime = null;
    canvas = null;
  }
}

workerSelf.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  handleChain = handleChain
    .then(() => handle(event.data))
    .catch((err) => sendError(err));
};
