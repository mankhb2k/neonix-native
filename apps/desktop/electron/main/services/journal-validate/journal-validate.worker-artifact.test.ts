import { visualLayerAtoms } from "@motionvideo/motion-protocol";
/**
 * Requires `pnpm build:main` so dist/main/journal-validate.worker.js exists.
 * Asserts packaged-bound worker path can validate a >1MB document via worker.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import {
  JOURNAL_VALIDATE_OFFLOAD_BYTES,
  validateAndHashDocument,
} from "./journal-document.validator";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const workerDist = path.join(
  desktopRoot,
  "dist",
  "main",
  "journal-validate.worker.js",
);

function inflateToBytes(base: string, targetBytes: number): string {
  const envelope = JSON.parse(base) as {
    project: {
      scenes: Array<Record<string, unknown>>;
      timeline: {
        visualTracks: unknown[];
        audioTracks: unknown[];
        captionTracks: unknown[];
      };
    };
  };
  const id = "scene_artifact";
  const node = {
    id: "node_artifact",
    type: "text",
    parentLayerId: null,
    zIndex: 0,
    ...visualLayerAtoms({ x: 1, y: 1, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
    payload: {
      content: { kind: "plain", text: "" },
      fontSize: 12,
      color: "#000000",
      alignment: "left",
    },
  };
  envelope.project.scenes = [
    { id, name: "Artifact", duration: 1, layers: [node], clips: [] },
  ];
  envelope.project.timeline.visualTracks = [
    {
      id: "main-track",
      role: "main",
      order: 0,
      clips: [
        {
          id: "clip_artifact",
          source: { kind: "scene", sceneId: id },
          start: 0,
          duration: 1,
        },
      ],
    },
  ];
  let json = JSON.stringify(envelope);
  const deficit = targetBytes - Buffer.byteLength(json, "utf8");
  if (deficit > 0) {
    (node.payload as { content: { text: string } }).content.text = "x".repeat(
      deficit,
    );
    json = JSON.stringify(envelope);
  }
  return json;
}

describe("journal validate worker artifact", () => {
  it("loads dist worker for documents ≥1MB with via===worker", async () => {
    expect(fs.existsSync(workerDist)).toBe(true);
    const blank = buildBlankDesktopProject({ name: "Artifact" });
    const doc = inflateToBytes(
      blank.documentJson,
      JOURNAL_VALIDATE_OFFLOAD_BYTES + 64_000,
    );
    expect(Buffer.byteLength(doc, "utf8")).toBeGreaterThan(
      JOURNAL_VALIDATE_OFFLOAD_BYTES,
    );

    const result = await validateAndHashDocument(doc, {
      workerPath: workerDist,
      offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.via).toBe("worker");
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  }, 60_000);
});
