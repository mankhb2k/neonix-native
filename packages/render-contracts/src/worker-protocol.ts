/**
 * Worker protocol — typed message contracts for main-thread ↔ worker
 * frame production pipeline.
 *
 * §Phase 9 Task 9.2 in core-engine-tasks.md
 *
 * All messages carry a sequence ID for ordering guarantees. Typed arrays
 * (Float32Array, Uint8Array, ImageBitmap, VideoFrame) are transferred
 * zero-copy where available.
 */

// ── Protocol version ──────────────────────────────────────────────────

/** Bump when the message shapes change. */
export const WORKER_PROTOCOL_VERSION = 1 as const;

// ── Sequence & timing ─────────────────────────────────────────────────

export type WorkerSequenceId = number;

export type WorkerTimings = {
  /** Wall-clock ms for the entire produce cycle. */
  totalMs: number;
  /** Time spent evaluating RuntimeProjectV2 into a RuntimeFrameV2. */
  evaluateMs: number;
  /** Time spent building paint commands. */
  paintBuildMs: number;
  /** Time spent in painter (Pixi or equivalent). */
  painterMs: number;
  /** Time to encode/copy the output frame. */
  encodeMs: number;
  /** Clock monotonic when the frame was sent. */
  sentAt: number;
};

// ── Main → Worker messages ────────────────────────────────────────────

export type InitWorkerMsg = {
  type: "init";
  /** Protocol version handshake. */
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  /** Serialized RuntimeProjectV2 (JSON). */
  runtimeJson: string;
  /** Composition dimensions. */
  width: number;
  height: number;
  /** Target FPS. */
  fps: number;
  /** Sequence ID for this project load. */
  sequenceId: WorkerSequenceId;
};

export type SetSourceWorkerMsg = {
  type: "setSource";
  /** New serialized runtime (full re-load). */
  runtimeJson: string;
  /** Bumped sequence to invalidate in-flight frames. */
  sequenceId: WorkerSequenceId;
};

export type PatchSourceWorkerMsg = {
  type: "patchSource";
  /** Incremental patch (object merge, not full re-eval). */
  patch: Record<string, unknown>;
  /** Bumped sequence for this patch. */
  sequenceId: WorkerSequenceId;
};

export type ProduceFrameWorkerMsg = {
  type: "produceFrame";
  /** Composition time to render at. */
  time: number;
  /** Quality tier for this frame. */
  quality: "realtime" | "final";
  /** Request ID for correlating response. */
  requestId: number;
  /** Sequence ID at time of request. */
  sequenceId: WorkerSequenceId;
};

export type ProduceStillWorkerMsg = {
  type: "produceStill";
  time: number;
  /** Optional override width for thumbnail export. */
  width?: number;
  requestId: number;
  sequenceId: WorkerSequenceId;
};

export type PumpVideoFrameWorkerMsg = {
  type: "pumpVideoFrame";
  /** Asset URI the frame belongs to. */
  assetUri: string;
  /** The VideoFrame or ImageBitmap to transfer. */
  frame: VideoFrame | ImageBitmap;
  /** Source frame index. */
  sourceFrame: number;
  sequenceId: WorkerSequenceId;
};

export type DisposeWorkerMsg = {
  type: "dispose";
  sequenceId: WorkerSequenceId;
};

export type MainToWorkerMessage =
  | InitWorkerMsg
  | SetSourceWorkerMsg
  | PatchSourceWorkerMsg
  | ProduceFrameWorkerMsg
  | ProduceStillWorkerMsg
  | PumpVideoFrameWorkerMsg
  | DisposeWorkerMsg;

// ── Worker → Main messages ────────────────────────────────────────────

export type WorkerReadyMsg = {
  type: "ready";
  /** Active backend / renderer. */
  backend: string;
  width: number;
  height: number;
  /** Monotonic clock at worker boot (for time sync). */
  timeOrigin: number;
};

export type FrameReadyMsg = {
  type: "frame";
  /** Composition time of this frame. */
  time: number;
  /** The rendered frame — transferred, not copied. */
  frame: ImageBitmap | VideoFrame;
  /** Request ID from the produce request. */
  requestId: number;
  /** Sequence that produced this frame. */
  sequenceId: WorkerSequenceId;
  /** Detailed timing breakdown. */
  timings: WorkerTimings;
};

export type FrameErrorMessage = {
  type: "frameError";
  time: number;
  requestId: number;
  sequenceId: WorkerSequenceId;
  error: string;
};

export type StillResultMsg = {
  type: "stillResult";
  /** The rendered still — transferred. */
  bitmap: ImageBitmap;
  requestId: number;
  width: number;
  height: number;
};

export type StillErrorMessage = {
  type: "stillError";
  requestId: number;
  error: string;
};

export type VideoFallbackRequestMsg = {
  type: "videoFallbackRequest";
  /** URIs the worker cannot decode. */
  uris: string[];
};

export type WorkerErrorMessage = {
  type: "error";
  message: string;
  sequenceId: WorkerSequenceId;
};

export type WorkerToMainMessage =
  | WorkerReadyMsg
  | FrameReadyMsg
  | FrameErrorMessage
  | StillResultMsg
  | StillErrorMessage
  | VideoFallbackRequestMsg
  | WorkerErrorMessage;

// ── Transferable helpers ──────────────────────────────────────────────

/**
 * Determine the transferable objects for a Worker→Main message.
 * Transferred objects are moved (zero-copy), not cloned.
 */
export function getTransferableForMessage(
  msg: WorkerToMainMessage,
): Transferable[] {
  switch (msg.type) {
    case "frame":
      return msg.frame instanceof ImageBitmap || msg.frame instanceof VideoFrame
        ? [msg.frame]
        : [];
    case "stillResult":
      return [msg.bitmap];
    default:
      return [];
  }
}

/**
 * Determine the transferable objects for a Main→Worker message.
 */
export function getTransferableForMainMessage(
  msg: MainToWorkerMessage,
): Transferable[] {
  if (msg.type === "pumpVideoFrame") {
    return msg.frame instanceof ImageBitmap || msg.frame instanceof VideoFrame
      ? [msg.frame]
      : [];
  }
  return [];
}

// ── Serialization measurement ─────────────────────────────────────────

export type SerializeTimings = {
  /** Time to JSON.stringify the message payload. */
  serializeMs: number;
  /** Time between postMessage and worker onmessage. */
  transferMs: number;
  /** Payload size in bytes. */
  payloadBytes: number;
};

/**
 * Measure serialize + transfer time for a message round-trip marker.
 * Call this before `postMessage` and after receiving the response.
 */
export function measureSerializeStart(): number {
  return performance.now();
}

export function measureSerializeEnd(
  payload: unknown,
  startedAt: number,
  receivedAt?: number,
): SerializeTimings {
  const now = performance.now();
  const json = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(json).byteLength;
  return {
    serializeMs: now - startedAt,
    transferMs: receivedAt ? receivedAt - startedAt : 0,
    payloadBytes,
  };
}
