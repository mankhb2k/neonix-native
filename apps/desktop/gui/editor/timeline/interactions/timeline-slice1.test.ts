import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import { loadTimelineFromDocumentJson } from "../../document/load-envelope";
import { useEditorUiSession } from "../../session/editor-ui-session";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../session/timeline-session";
import { capCutRulerScale } from "../timeline-scale";
import {
  computeViewportLayout,
  selectionNone,
  sliderValueToZoomScale,
} from "@motionvideo/editor-core";

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

describe("editor ui zoom/fit (ui session)", () => {
  it("set zoom switches to manual mode", () => {
    useEditorUiSession.getState().resetForProject(null);
    useEditorUiSession.getState().setZoom(75);
    const s = useEditorUiSession.getState();
    expect(s.timelineZoomMode).toBe("manual");
    expect(s.timelineZoom).toBe(75);
    expect(s.timelineZoomScale).toBe(sliderValueToZoomScale(75));
  });

  it("fit resets scale to 1 and bumps revision", () => {
    useEditorUiSession.getState().resetForProject(null);
    const rev = useEditorUiSession.getState().timelineFitRevision;
    useEditorUiSession.getState().setZoom(80);
    useEditorUiSession.getState().fitTimeline([]);
    const s = useEditorUiSession.getState();
    expect(s.timelineZoom).toBe(50);
    expect(s.timelineZoomScale).toBe(1);
    expect(s.timelineZoomMode).toBe("fit");
    expect(s.timelineFitRevision).toBe(rev + 1);
  });

  it("fit with multiple clips anchors so content leaves ~1/3 empty", () => {
    useEditorUiSession.getState().resetForProject(null);
    useEditorUiSession.getState().fitTimeline([
      {
        id: "a",
        kind: "scene",
        sceneId: "s1",
        laneId: "lane",
        startTime: 0,
        duration: 4,
        name: "A",
      },
      {
        id: "b",
        kind: "scene",
        sceneId: "s2",
        laneId: "lane",
        startTime: 4,
        duration: 6,
        name: "B",
      },
    ]);
    expect(useEditorUiSession.getState().timelineFitAnchorSeconds).toBe(5);
    expect(useEditorUiSession.getState().timelineZoomMode).toBe("fit");
  });

  it("REPLACE_DOCUMENT resets ui via reduce patch", () => {
    useEditorUiSession.getState().setZoom(90);
    let state = createInitialTimelineSession();
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_z` });
    const result = reduceTimelineSession(state, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });
    state = result.state;
    expect(state.projectId).toBeTruthy();
    expect(result.ui?.timelineZoomMode).toBe("fit");
    expect(result.ui?.selection).toEqual(selectionNone());
    if (result.ui) useEditorUiSession.getState().applyPatch(result.ui);
    expect(useEditorUiSession.getState().timelineZoom).toBe(50);
  });
});

describe("capCutRulerScale", () => {
  it("returns positive tick/label steps", () => {
    const scale = capCutRulerScale(50, 30);
    expect(scale.tickEveryFrames).toBeGreaterThan(0);
    expect(scale.labelEveryFrames).toBeGreaterThanOrEqual(
      scale.tickEveryFrames,
    );
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

  it("pads multi-clip extent by ~1/3 of the visible board (CapCut end empty)", () => {
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
      {
        id: "c2",
        kind: "scene" as const,
        sceneId: "s2",
        laneId: "lane",
        startTime: 4,
        duration: 6,
        name: "B",
      },
    ];
    const layout = computeViewportLayout({
      clips,
      trackViewWidth: 900,
      timelineZoomScale: 1,
      timelineFitAnchorSeconds: 4,
    });
    expect(layout.contentEnd).toBe(10);
    expect(layout.extentSeconds).toBeCloseTo(14, 5);
    expect(
      (layout.extentSeconds - layout.contentEnd) / layout.fitSpan,
    ).toBeCloseTo(1 / 3, 5);
  });
});
