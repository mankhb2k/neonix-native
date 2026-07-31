import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import { loadTimelineFromDocumentJson } from "../../renderer/src/editor/document/load-envelope";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../renderer/src/editor/session/timeline-session";
import { capCutRulerScale } from "../../renderer/src/editor/timeline/timeline-scale";
import { computeViewportLayout } from "../../renderer/src/editor/timeline/viewport-layout";
import { sliderValueToZoomScale } from "@motionvideo/editor-core";

describe("loadTimelineFromDocumentJson", () => {
  it("hydrates blank envelope with base lane", () => {
    const blank = buildBlankDesktopProject({
      name: "Slice1",
      createId: (p) => `${p}_s1`,
    });
    const loaded = loadTimelineFromDocumentJson(blank.documentJson);
    expect(loaded.projectName).toBe("Slice1");
    expect(loaded.fps).toBe(30);
    expect(loaded.lanes.length).toBeGreaterThanOrEqual(1);
    expect(loaded.lanes.some((l) => l.role === "base")).toBe(true);
  });
});

describe("timeline session zoom/fit", () => {
  it("set zoom switches to manual mode", () => {
    let state = createInitialTimelineSession();
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_z` });
    state = reduceTimelineSession(state, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });
    expect(state.timelineZoomMode).toBe("fit");

    state = reduceTimelineSession(state, { type: "SET_ZOOM", zoom: 75 });
    expect(state.timelineZoomMode).toBe("manual");
    expect(state.timelineZoom).toBe(75);
    expect(state.timelineZoomScale).toBe(sliderValueToZoomScale(75));
  });

  it("fit resets scale to 1 and bumps revision", () => {
    let state = createInitialTimelineSession();
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_f` });
    state = reduceTimelineSession(state, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });
    const rev = state.timelineFitRevision;
    state = reduceTimelineSession(state, { type: "SET_ZOOM", zoom: 80 });
    state = reduceTimelineSession(state, { type: "FIT_TIMELINE" });
    expect(state.timelineZoom).toBe(50);
    expect(state.timelineZoomScale).toBe(1);
    expect(state.timelineZoomMode).toBe("fit");
    expect(state.timelineFitRevision).toBe(rev + 1);
  });
});

describe("capCutRulerScale", () => {
  it("returns positive tick/label steps", () => {
    const scale = capCutRulerScale(50, 30);
    expect(scale.tickEveryFrames).toBeGreaterThan(0);
    expect(scale.labelEveryFrames).toBeGreaterThanOrEqual(scale.tickEveryFrames);
    expect(scale.pixelsPerFrame).toBeCloseTo(50 / 30, 5);
  });
});

describe("computeViewportLayout", () => {
  it("derives pps from fit baseline × zoom scale", () => {
    const clips = [
      {
        id: "c1",
        kind: "scene" as const,
        sceneId: "s1",
        laneId: "lane",
        startTime: 0,
        duration: 4,
        name: "A",
      },
    ];
    const layout = computeViewportLayout({
      clips,
      trackViewWidth: 600,
      timelineZoomScale: 2,
      timelineFitAnchorSeconds: 4,
    });
    expect(layout.fitPps).toBeGreaterThan(0);
    expect(layout.pixelsPerSecond).toBeCloseTo(layout.fitPps * 2, 5);
    expect(layout.canvasWidth).toBeGreaterThanOrEqual(600);
  });
});
