/**
 * Sync vs worker-thread validate+hash for journal autosave.
 * Soft main-thread budget is ~50–100ms; docs at/above OFFLOAD_BYTES use a worker
 * when the bundled worker file is available.
 *
 * Worker infrastructure failures fall back to sync so large projects keep autosaving.
 * Per coalesceKey: latest-wins — a newer request cancels the prior in-flight worker.
 */
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { validateDesktopDocumentJson } from "../../shared/project-file/validate-document";
import { hashDocumentJson } from "./project-journal-hash";

/** Soft engineering budget for main-thread validate+hash (not a UI FPS claim). */
export const JOURNAL_VALIDATE_SOFT_BUDGET_MS = 100;

/** Offload validate+hash off the Electron main thread at/above this size. */
export const JOURNAL_VALIDATE_OFFLOAD_BYTES = 1_000_000;

/** Worker hang / no-message budget. */
export const JOURNAL_VALIDATE_WORKER_TIMEOUT_MS = 20_000;

export type JournalValidateFailureKind =
  | "invalid_document"
  | "worker_failure"
  | "timeout"
  | "superseded";

export type JournalValidateHashResult =
  | {
      ok: true;
      hash: string;
      via: "sync" | "worker";
      /** Set when sync recovered after a worker infrastructure failure. */
      fallbackFrom?: Exclude<JournalValidateFailureKind, "invalid_document" | "superseded">;
    }
  | {
      ok: false;
      error: string;
      via: "sync" | "worker";
      kind: JournalValidateFailureKind;
    };

export type ValidateAndHashDocumentOptions = {
  offloadBytes?: number;
  syncOnly?: boolean;
  workerPath?: string | null;
  timeoutMs?: number;
  /** Latest-wins coalesce key (typically journal key / projectId). */
  coalesceKey?: string;
  /** Test hook — observe diagnostics. */
  onDiagnostic?: (message: string, detail?: unknown) => void;
};

type CoalesceSlot = {
  revision: number;
  worker: Worker | null;
};

const coalesceSlots = new Map<string, CoalesceSlot>();

export function resolveJournalValidateWorkerPath(
  existsSync: (p: string) => boolean = fs.existsSync,
): string | null {
  const besideMain = path.join(__dirname, "journal-validate-worker.js");
  const candidates = [
    besideMain,
    path.join(__dirname, "journal-validate-worker.cjs"),
    // Electron asarUnpack: app.asar → app.asar.unpacked
    besideMain.includes(`${path.sep}app.asar${path.sep}`)
      ? besideMain.replace(
          `${path.sep}app.asar${path.sep}`,
          `${path.sep}app.asar.unpacked${path.sep}`,
        )
      : null,
    besideMain.includes("/app.asar/")
      ? besideMain.replace("/app.asar/", "/app.asar.unpacked/")
      : null,
    // Vitest runs TypeScript from src/; production bundle lives in dist/main.
    path.join(__dirname, "../../../dist/main/journal-validate-worker.js"),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

export function validateAndHashDocumentSync(
  documentJson: string,
): JournalValidateHashResult {
  try {
    validateDesktopDocumentJson(documentJson);
    return { ok: true, hash: hashDocumentJson(documentJson), via: "sync" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Validation failed.",
      via: "sync",
      kind: "invalid_document",
    };
  }
}

function isCurrent(slotKey: string | undefined, revision: number): boolean {
  if (!slotKey) return true;
  return coalesceSlots.get(slotKey)?.revision === revision;
}

function safeDiagnostic(
  onDiagnostic: ((message: string, detail?: unknown) => void) | undefined,
  message: string,
  detail?: unknown,
): void {
  if (!onDiagnostic) return;
  try {
    onDiagnostic(message, detail);
  } catch {
    /* diagnostics must never break autosave / recovery */
  }
}

function terminateSlotWorker(slotKey: string | undefined): void {
  if (!slotKey) return;
  const slot = coalesceSlots.get(slotKey);
  if (!slot?.worker) return;
  const worker = slot.worker;
  coalesceSlots.set(slotKey, { revision: slot.revision, worker: null });
  void worker.terminate();
}

function validateAndHashInWorker(
  documentJson: string,
  workerPath: string,
  options: {
    timeoutMs: number;
    coalesceKey?: string;
    revision: number;
    onDiagnostic?: (message: string, detail?: unknown) => void;
  },
): Promise<JournalValidateHashResult> {
  return new Promise((resolve) => {
    let settled = false;
    let worker: Worker;
    try {
      worker = new Worker(workerPath, {
        workerData: { documentJson },
      });
    } catch (error) {
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : "Worker spawn failed.",
        via: "worker",
        kind: "worker_failure",
      });
      return;
    }

    if (options.coalesceKey) {
      const slot = coalesceSlots.get(options.coalesceKey);
      if (slot && slot.revision === options.revision) {
        coalesceSlots.set(options.coalesceKey, {
          revision: slot.revision,
          worker,
        });
      }
    }

    const cleanup = () => {
      if (options.coalesceKey) {
        const slot = coalesceSlots.get(options.coalesceKey);
        if (slot?.worker === worker) {
          coalesceSlots.set(options.coalesceKey, {
            revision: slot.revision,
            worker: null,
          });
        }
      }
      void worker.terminate();
    };

    const finish = (result: JournalValidateHashResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (
        options.coalesceKey &&
        !isCurrent(options.coalesceKey, options.revision)
      ) {
        resolve({
          ok: false,
          error: "Validation superseded by a newer autosave.",
          via: "worker",
          kind: "superseded",
        });
        return;
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      safeDiagnostic(options.onDiagnostic, "journal-validate worker timeout", {
        timeoutMs: options.timeoutMs,
      });
      finish({
        ok: false,
        error: `Worker timed out after ${options.timeoutMs}ms.`,
        via: "worker",
        kind: "timeout",
      });
    }, options.timeoutMs);

    worker.once("message", (msg: unknown) => {
      if (
        msg &&
        typeof msg === "object" &&
        (msg as { ok?: unknown }).ok === true &&
        typeof (msg as { hash?: unknown }).hash === "string"
      ) {
        finish({
          ok: true,
          hash: (msg as { hash: string }).hash,
          via: "worker",
        });
        return;
      }
      // Worker reported document invalid (or malformed reply treated as invalid).
      const error =
        msg &&
        typeof msg === "object" &&
        typeof (msg as { error?: unknown }).error === "string"
          ? (msg as { error: string }).error
          : "Worker validation failed.";
      const invalid =
        msg &&
        typeof msg === "object" &&
        (msg as { ok?: unknown }).ok === false;
      finish({
        ok: false,
        error,
        via: "worker",
        kind: invalid ? "invalid_document" : "worker_failure",
      });
    });
    worker.once("error", (error) => {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "Worker error.",
        via: "worker",
        kind: "worker_failure",
      });
    });
    worker.once("exit", (code) => {
      // Any exit before a message settles is a failure (including exit 0).
      finish({
        ok: false,
        error: `Worker exited before result (code ${code}).`,
        via: "worker",
        kind: "worker_failure",
      });
    });
  });
}

async function runValidateAndHash(
  documentJson: string,
  options: ValidateAndHashDocumentOptions,
  coalesceKey: string | undefined,
  revision: number,
): Promise<JournalValidateHashResult> {
  const offloadBytes = options.offloadBytes ?? JOURNAL_VALIDATE_OFFLOAD_BYTES;
  const bytes = Buffer.byteLength(documentJson, "utf8");
  const workerPath =
    options.workerPath === undefined
      ? resolveJournalValidateWorkerPath()
      : options.workerPath;
  const timeoutMs = options.timeoutMs ?? JOURNAL_VALIDATE_WORKER_TIMEOUT_MS;

  if (!options.syncOnly && workerPath && bytes >= offloadBytes) {
    if (!isCurrent(coalesceKey, revision)) {
      return {
        ok: false,
        error: "Validation superseded by a newer autosave.",
        via: "worker",
        kind: "superseded",
      };
    }
    const workerResult = await validateAndHashInWorker(documentJson, workerPath, {
      timeoutMs,
      coalesceKey,
      revision,
      onDiagnostic: options.onDiagnostic,
    });
    if (!isCurrent(coalesceKey, revision)) {
      return {
        ok: false,
        error: "Validation superseded by a newer autosave.",
        via: "worker",
        kind: "superseded",
      };
    }
    if (workerResult.ok) return workerResult;
    if (workerResult.kind === "invalid_document" || workerResult.kind === "superseded") {
      return workerResult;
    }
    // worker_failure / timeout → sync fallback so large projects keep autosaving.
    safeDiagnostic(
      options.onDiagnostic,
      `journal-validate falling back to sync after ${workerResult.kind}`,
      { error: workerResult.error },
    );
    const syncResult = validateAndHashDocumentSync(documentJson);
    if (!syncResult.ok) return syncResult;
    if (!isCurrent(coalesceKey, revision)) {
      return {
        ok: false,
        error: "Validation superseded by a newer autosave.",
        via: "sync",
        kind: "superseded",
      };
    }
    return {
      ok: true,
      hash: syncResult.hash,
      via: "sync",
      fallbackFrom: workerResult.kind,
    };
  }

  if (!isCurrent(coalesceKey, revision)) {
    return {
      ok: false,
      error: "Validation superseded by a newer autosave.",
      via: "sync",
      kind: "superseded",
    };
  }
  return validateAndHashDocumentSync(documentJson);
}

export async function validateAndHashDocument(
  documentJson: string,
  options: ValidateAndHashDocumentOptions = {},
): Promise<JournalValidateHashResult> {
  const coalesceKey = options.coalesceKey;
  let revision = 0;
  if (coalesceKey) {
    const prev = coalesceSlots.get(coalesceKey);
    revision = (prev?.revision ?? 0) + 1;
    terminateSlotWorker(coalesceKey);
    coalesceSlots.set(coalesceKey, { revision, worker: null });
  }

  try {
    return await runValidateAndHash(documentJson, options, coalesceKey, revision);
  } finally {
    if (coalesceKey) {
      const slot = coalesceSlots.get(coalesceKey);
      if (slot?.revision === revision) {
        terminateSlotWorker(coalesceKey);
        coalesceSlots.delete(coalesceKey);
      }
    }
  }
}

/** Test helper — clear coalesce state between cases. */
export function resetJournalValidateCoalesceForTests(): void {
  for (const key of [...coalesceSlots.keys()]) {
    terminateSlotWorker(key);
  }
  coalesceSlots.clear();
}

/** Test helper — map size after cleanup. */
export function journalValidateCoalesceSizeForTests(): number {
  return coalesceSlots.size;
}
