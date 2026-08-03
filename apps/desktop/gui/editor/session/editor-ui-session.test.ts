import { beforeEach, describe, expect, it } from "vitest";
import { selectionClips, sliderValueToZoomScale } from "@motionvideo/editor-core";
import { useEditorUiSession } from "./editor-ui-session";

describe("editor-ui-session", () => {
  beforeEach(() => {
    useEditorUiSession.getState().resetForProject(null);
  });

  it("setZoom clamps and switches to manual mode", () => {
    const { setZoom } = useEditorUiSession.getState();
    setZoom(75);
    const s = useEditorUiSession.getState();
    expect(s.timelineZoom).toBe(75);
    expect(s.timelineZoomScale).toBe(sliderValueToZoomScale(75));
    expect(s.timelineZoomMode).toBe("manual");

    setZoom(200);
    expect(useEditorUiSession.getState().timelineZoom).toBe(100);
    setZoom(-10);
    expect(useEditorUiSession.getState().timelineZoom).toBe(0);
  });

  it("fitTimeline resets scale and bumps revision", () => {
    const ui = useEditorUiSession.getState();
    ui.setZoom(80);
    const rev = useEditorUiSession.getState().timelineFitRevision;
    ui.fitTimeline([
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
    const next = useEditorUiSession.getState();
    expect(next.timelineZoom).toBe(50);
    expect(next.timelineZoomScale).toBe(1);
    expect(next.timelineZoomMode).toBe("fit");
    expect(next.timelineFitRevision).toBe(rev + 1);
    // contentEnd=10 → anchor=5
    expect(next.timelineFitAnchorSeconds).toBe(5);
  });

  it("setSelection and resetForProject clear chrome", () => {
    useEditorUiSession.getState().setSelection(selectionClips(["c1"]));
    useEditorUiSession.getState().setClipboard([]);
    expect(useEditorUiSession.getState().selection.kind).toBe("clips");
    useEditorUiSession.getState().setClipboard([
      {
        kind: "overlay",
        name: "x",
        duration: 1,
        offsetStart: 0,
      },
    ]);
    expect(useEditorUiSession.getState().clipboard).toHaveLength(1);
    useEditorUiSession.getState().resetForProject(2);
    const s = useEditorUiSession.getState();
    expect(s.selection.kind).toBe("none");
    expect(s.clipboard).toEqual([]);
    expect(s.timelineFitAnchorSeconds).toBe(2);
    expect(s.timelineZoomMode).toBe("fit");
  });
});
