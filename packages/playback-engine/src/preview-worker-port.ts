/**
 * Preview worker port — main-thread handle for the frame-producer worker.
 * No DOM / Pixi; the host injects postMessage + subscribe.
 */

import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "@motionvideo/render-contracts";

export type PresentMode = "live" | "buffered";

export type PreviewWorkerPort = {
  post(msg: MainToWorkerMessage, transfer?: Transferable[]): void;
  subscribe(handler: (msg: WorkerToMainMessage) => void): () => void;
};

export type ClockDrive = "internal" | "external";
