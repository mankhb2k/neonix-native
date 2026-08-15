/**
 * Browser wrapper around a DedicatedWorker running preview-frame-worker.ts.
 */

import {
  getTransferableForMainMessage,
  type MainToWorkerMessage,
  type WorkerToMainMessage,
} from "@motionvideo/render-contracts";
import type { PreviewWorkerPort } from "@motionvideo/playback-engine";

export function createBrowserPreviewWorker(): PreviewWorkerPort & {
  terminate(): void;
} {
  const worker = new Worker(
    new URL("./preview-frame-worker.ts", import.meta.url),
    { type: "module", name: "moticlip-preview-frame" },
  );
  const listeners = new Set<(msg: WorkerToMainMessage) => void>();
  worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
    for (const listener of listeners) listener(event.data);
  };
  worker.onerror = (event) => {
    const message = event.message || "preview worker error";
    for (const listener of listeners) {
      listener({ type: "error", message, sequenceId: 0 });
    }
  };
  return {
    post(msg: MainToWorkerMessage, transfer?: Transferable[]) {
      const list = transfer ?? getTransferableForMainMessage(msg);
      if (list.length > 0) worker.postMessage(msg, list);
      else worker.postMessage(msg);
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    terminate() {
      listeners.clear();
      worker.terminate();
    },
  };
}
