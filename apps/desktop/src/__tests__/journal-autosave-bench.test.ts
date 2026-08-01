/**
 * Engineering bench: validate + hash cost for large autosave payloads.
 * Soft ceiling only — does not claim UI 60fps or block CI on slow machines.
 * When this grows past ~50ms median on target hardware, move parse/hash
 * off the Electron main thread (utility process / worker).
 */
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import { validateDesktopDocumentJson } from "../shared/project-file/validate-document";
import { hashDocumentJson } from "../main/services/project-journal-service";

function inflateDocumentJson(base: string, copies: number): string {
  const envelope = JSON.parse(base) as {
    project: {
      scenes: Array<Record<string, unknown>>;
      timeline: { sceneOrder: string[]; audioTracks: unknown[] };
    };
  };

  const pad = "x".repeat(2_000);
  for (let i = 0; i < copies; i += 1) {
    const id = `scene_bench_${i}`;
    envelope.project.scenes.push({
      id,
      name: `Bench ${i}`,
      duration: 3,
      nodes: [
        {
          id: `node_bench_${i}`,
          type: "text",
          parentId: null,
          zIndex: 0,
          transform: {
            x: 100,
            y: 100,
            width: 400,
            height: 80,
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
          payload: {
            text: pad,
            fontSize: 64,
            fontWeight: 600,
            align: "center",
          },
        },
      ],
      clips: [],
    });
    envelope.project.timeline.sceneOrder.push(id);
  }
  return JSON.stringify(envelope);
}

function medianMs(samples: number[]): number {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

describe("journal autosave size bench", () => {
  it("validate+hash stays under soft ceiling for multi-scene docs", () => {
    const blank = buildBlankDesktopProject({ name: "Bench" });
    const inflated = inflateDocumentJson(blank.documentJson, 40);
    const bytes = Buffer.byteLength(inflated, "utf8");
    expect(bytes).toBeGreaterThan(50_000);

    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = performance.now();
      validateDesktopDocumentJson(inflated);
      hashDocumentJson(inflated);
      samples.push(performance.now() - t0);
    }
    const med = medianMs(samples);
    // Soft engineering signal — not a product FPS claim.
    expect(med).toBeLessThan(2_000);
  });
});
