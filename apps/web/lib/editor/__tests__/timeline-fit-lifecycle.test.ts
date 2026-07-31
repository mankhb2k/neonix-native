import { describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/editor/editor-store";
import { fitPixelsPerSecond, timelineFitSpanSeconds } from "@/lib/editor/timeline-fit";
import { fixtureMainOnly } from "@/lib/editor/__fixtures__/projects";

describe("Timeline Fit Lifecycle (5s -> Delete -> 12s)", () => {
  it("resets anchor to null on last clip delete, then sets anchor to 12s when adding new clip", () => {
    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    // 1. Initial state with project loaded
    useEditorStore.getState().loadProject(project, overlayScenes, clips, lanes);

    expect(useEditorStore.getState().timelineFitAnchorSeconds).toBe(2);
    expect(useEditorStore.getState().timelineClips.length).toBe(2);

    // 2. Delete all clips
    const allIds = useEditorStore.getState().timelineClips.map((c) => c.id);
    useEditorStore.getState().setSelectedClipIds(allIds);
    useEditorStore.getState().deleteSelectedClips();

    expect(useEditorStore.getState().timelineClips.length).toBe(0);
    expect(useEditorStore.getState().timelineFitAnchorSeconds).toBeNull();
    expect(useEditorStore.getState().timelineZoomMode).toBe("fit");

    // 3. Add a new 12s clip to the empty timeline
    useEditorStore.getState().addClipFromDraft(
      { id: "d12", name: "Clip 12s", duration: 12, text: "12s" },
      { track: "main" },
    );

    expect(useEditorStore.getState().timelineClips.length).toBe(1);
    expect(useEditorStore.getState().timelineFitAnchorSeconds).toBe(12);

    // 4. Verify fit math gives exactly 1/3 ratio for 12s clip
    const anchor = useEditorStore.getState().timelineFitAnchorSeconds;
    const fitSpan = timelineFitSpanSeconds(anchor);
    expect(fitSpan).toBe(36); // 12 * 3 = 36s

    const viewportWidth = 1500;
    const pps = fitPixelsPerSecond(viewportWidth, fitSpan); // 1500 / 36 = 41.666...
    const clip12Width = 12 * pps; // 12 * (1500 / 36) = 500px

    expect(clip12Width / viewportWidth).toBeCloseTo(1 / 3);
  });
});
