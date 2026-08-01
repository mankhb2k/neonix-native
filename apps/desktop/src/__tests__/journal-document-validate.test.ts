import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import {
  JOURNAL_VALIDATE_OFFLOAD_BYTES,
  journalValidateCoalesceSizeForTests,
  resetJournalValidateCoalesceForTests,
  resolveJournalValidateWorkerPath,
  validateAndHashDocument,
  validateAndHashDocumentSync,
} from "../main/services/journal-document-validate";

function inflateToBytes(base: string, targetBytes: number): string {
  const envelope = JSON.parse(base) as {
    project: {
      scenes: Array<Record<string, unknown>>;
      timeline: { sceneOrder: string[]; audioTracks: unknown[] };
    };
  };
  const id = "scene_pad";
  const node = {
    id: "node_pad",
    type: "text",
    parentId: null,
    zIndex: 0,
    transform: {
      x: 1,
      y: 1,
      width: 10,
      height: 10,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      opacity: 1,
      visible: true,
      flipX: false,
      flipY: false,
    },
    payload: { text: "", fontSize: 12, fontWeight: 400, align: "left" },
  };
  envelope.project.scenes = [
    { id, name: "Pad", duration: 1, nodes: [node], clips: [] },
  ];
  envelope.project.timeline.sceneOrder = [id];
  let json = JSON.stringify(envelope);
  const deficit = targetBytes - Buffer.byteLength(json, "utf8");
  if (deficit > 0) {
    (node.payload as { text: string }).text = "x".repeat(deficit);
    json = JSON.stringify(envelope);
  }
  return json;
}

afterEach(() => {
  resetJournalValidateCoalesceForTests();
});

describe("journal-document-validate", () => {
  it("falls back to sync when worker path is unusable", async () => {
    const blank = buildBlankDesktopProject({ name: "Fallback" });
    const doc = inflateToBytes(blank.documentJson, JOURNAL_VALIDATE_OFFLOAD_BYTES);
    const diagnostics: string[] = [];
    const result = await validateAndHashDocument(doc, {
      workerPath: path.join(os.tmpdir(), "missing-journal-worker.js"),
      offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
      onDiagnostic: (message) => diagnostics.push(message),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.via).toBe("sync");
    expect(result.fallbackFrom).toBe("worker_failure");
    expect(diagnostics.some((d) => d.includes("falling back to sync"))).toBe(
      true,
    );
  });

  it("rejects invalid documents without sync fallback", async () => {
    const result = await validateAndHashDocument("{not-json", {
      syncOnly: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("invalid_document");
  });

  it("latest-wins coalesce supersedes an older in-flight validation", async () => {
    const a = inflateToBytes(
      buildBlankDesktopProject({ name: "A" }).documentJson,
      JOURNAL_VALIDATE_OFFLOAD_BYTES,
    );
    const b = inflateToBytes(
      buildBlankDesktopProject({ name: "B" }).documentJson,
      JOURNAL_VALIDATE_OFFLOAD_BYTES,
    );
    const workerPath = resolveJournalValidateWorkerPath();
    const expectedB = validateAndHashDocumentSync(b);
    expect(expectedB.ok).toBe(true);
    if (!expectedB.ok) return;

    const first = validateAndHashDocument(a, {
      coalesceKey: "project-coalesce",
      workerPath: workerPath ?? undefined,
      syncOnly: !workerPath,
      offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
    });
    const second = await validateAndHashDocument(b, {
      coalesceKey: "project-coalesce",
      workerPath: workerPath ?? undefined,
      syncOnly: !workerPath,
      offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.hash).toBe(expectedB.hash);
    }
    const firstResult = await first;
    // Sync path may finish first before supersede; worker path should supersede.
    if (!firstResult.ok) {
      expect(firstResult.kind).toBe("superseded");
    }
  });

  it("times out a hung worker and falls back to sync", async () => {
    const hangWorker = path.join(
      os.tmpdir(),
      `mv-hang-worker-${process.pid}.cjs`,
    );
    fs.writeFileSync(
      hangWorker,
      `
const { parentPort } = require("worker_threads");
setInterval(() => {}, 1 << 30);
`,
      "utf8",
    );
    try {
      const blank = buildBlankDesktopProject({ name: "Hang" });
      const doc = inflateToBytes(blank.documentJson, JOURNAL_VALIDATE_OFFLOAD_BYTES);
      const result = await validateAndHashDocument(doc, {
        workerPath: hangWorker,
        offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
        timeoutMs: 50,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.via).toBe("sync");
      expect(result.fallbackFrom).toBe("timeout");
    } finally {
      try {
        fs.unlinkSync(hangWorker);
      } catch {
        /* ignore */
      }
    }
  });

  it("deletes coalesce slot after successful validation", async () => {
    await validateAndHashDocument(
      buildBlankDesktopProject({ name: "Cleanup" }).documentJson,
      { coalesceKey: "cleanup-key", syncOnly: true },
    );
    expect(journalValidateCoalesceSizeForTests()).toBe(0);
  });

  it("keeps autosave validate path when diagnostic callback throws", async () => {
    const blank = buildBlankDesktopProject({ name: "DiagThrow" });
    const doc = inflateToBytes(blank.documentJson, JOURNAL_VALIDATE_OFFLOAD_BYTES);
    const result = await validateAndHashDocument(doc, {
      workerPath: path.join(os.tmpdir(), "missing-journal-worker.js"),
      offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
      onDiagnostic: () => {
        throw new Error("logger boom");
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.via).toBe("sync");
    expect(result.fallbackFrom).toBe("worker_failure");
  });
});
