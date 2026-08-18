/**
 * Shared StageRendererPort contract — DOM vs canvas-experimental (P21/B4).
 * @vitest-environment happy-dom
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildVisualLaneIndex, composeAtTime } from "@motionvideo/editor-core";
import { createDomStageRenderer } from "../stage/stage-renderer-port";
import { createCanvasStageRenderer } from "../stage/canvas-stage-renderer";
import {
  createStageRenderer,
  resolveStageBackend,
} from "../stage/stage-renderer-factory";
import { buildStagePaintFixture } from "../stage/preview-fixtures";

describe("StageRendererPort contract DOM vs canvas-experimental", () => {
  const hosts: HTMLElement[] = [];

  afterEach(() => {
    for (const h of hosts) h.remove();
    hosts.length = 0;
  });

  function host() {
    const el = document.createElement("div");
    el.style.width = "320px";
    el.style.height = "180px";
    Object.defineProperty(el, "clientWidth", {
      value: 320,
      configurable: true,
    });
    Object.defineProperty(el, "clientHeight", {
      value: 180,
      configurable: true,
    });
    document.body.appendChild(el);
    hosts.push(el);
    return el;
  }

  it("both backends accept document and paintFrame without throwing", () => {
    const fixture = buildStagePaintFixture(12);
    const dom = createDomStageRenderer(host());
    const canvas = createCanvasStageRenderer(host());
    dom.setDocument(fixture);
    canvas.setDocument(fixture);
    dom.setBackground("#111");
    canvas.setBackground("#111");
    dom.setScale(0.5);
    canvas.setScale(0.5);
    dom.paintFrame(0);
    canvas.paintFrame(0);
    dom.paintFrame(30);
    canvas.paintFrame(30);
    dom.dispose();
    canvas.dispose();
    dom.dispose();
    canvas.dispose();
  });

  it("sync createStageRenderer rejects canvas-experimental (use lazy)", () => {
    expect(() => createStageRenderer(host(), "canvas-experimental")).toThrow(
      /createStageRendererLazy/,
    );
    expect(resolveStageBackend("pixi")).toBe("canvas-experimental");
    expect(() => createStageRenderer(host(), "pixi")).toThrow(
      /createStageRendererLazy/,
    );
    const dom = createStageRenderer(host(), "dom");
    dom.dispose();
  });

  it("production backend is DOM (Logic-4 honesty)", () => {
    expect(resolveStageBackend("dom")).toBe("dom");
    expect(resolveStageBackend(undefined)).toBe("dom");
  });

  it("canvas paintFrame changes painted node count across frames", () => {
    const fixture = buildStagePaintFixture(8);
    const clips = fixture.clips.map((c, i) =>
      i === 0
        ? { ...c, startTime: 0, duration: 0.5 }
        : { ...c, startTime: 10, duration: 1 },
    );
    const doc = { ...fixture, clips };
    const index = buildVisualLaneIndex(doc.clips, doc.lanes);
    const fps = Math.max(1, Math.round(doc.project.composition.fps));
    expect(composeAtTime(index, 0 / fps).length).toBeGreaterThan(0);
    expect(composeAtTime(index, 60 / fps).length).toBe(0);

    const h = host();
    const canvas = createCanvasStageRenderer(h);
    canvas.setBackground("#111111");
    canvas.setDocument(doc);
    canvas.paintFrame(0);
    expect(canvas.getPaintStats().nodeCount).toBeGreaterThan(0);
    canvas.paintFrame(60);
    expect(canvas.getPaintStats().nodeCount).toBe(0);
    expect(h.querySelector("canvas")).toBeTruthy();
    canvas.dispose();
  });

  it("DOM and canvas both paint the same compose layer ids at t=0", () => {
    const fixture = buildStagePaintFixture(4);
    const index = buildVisualLaneIndex(fixture.clips, fixture.lanes);
    const layers = composeAtTime(index, 0);
    expect(layers.length).toBeGreaterThan(0);

    const domHost = host();
    const canvasHost = host();
    const dom = createDomStageRenderer(domHost);
    const canvas = createCanvasStageRenderer(canvasHost);
    dom.setDocument(fixture);
    canvas.setDocument(fixture);
    dom.paintFrame(0);
    canvas.paintFrame(0);

    expect(domHost.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(canvasHost.querySelector("canvas")).toBeTruthy();

    const graphIds = new Set(layers.map((l) => l.layerId));
    for (const id of graphIds) {
      expect(fixture.project.scenes.some((s) => s.id === id)).toBe(true);
    }

    dom.dispose();
    canvas.dispose();
  });
});
