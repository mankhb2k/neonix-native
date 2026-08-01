/**
 * Worker-thread entry for journal document validate + hash.
 * Built separately to `dist/main/journal-validate-worker.js` so the Electron
 * main process can offload large autosave payloads without stalling.
 */
import { createHash } from "node:crypto";
import { parentPort, workerData } from "node:worker_threads";
import { validateDesktopDocumentJson } from "../../shared/project-file/validate-document";

type WorkerInput = { documentJson: string };

function run(): void {
  const input = workerData as WorkerInput;
  if (!input || typeof input.documentJson !== "string") {
    parentPort?.postMessage({ ok: false, error: "Missing documentJson." });
    return;
  }
  try {
    validateDesktopDocumentJson(input.documentJson);
    const hash = createHash("sha256")
      .update(input.documentJson)
      .digest("hex");
    parentPort?.postMessage({ ok: true, hash });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Validation failed.",
    });
  }
}

run();
