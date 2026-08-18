import { beforeEach, describe, expect, it } from "vitest";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import { useEditorStore } from "@/lib/editor/editor-store";

/** Public actions locked before store file split — presence only, no random IDs. */
const REQUIRED_ACTIONS = [
  "loadProject",
  "moveClip",
  "addClipFromDraft",
  "addAudioClipFromLibrary",
  "copySelectedClips",
  "cutSelectedClips",
  "pasteClips",
  "deleteSelectedClips",
  "duplicateSelectedClips",
  "splitSelectedClipsAt",
] as const;

function assertTimelineProjectInvariants() {
  const { project, timelineClips, timelineLanes } = useEditorStore.getState();
  expect(project).not.toBeNull();
  if (!project) return;

  const sceneIds = new Set(project.layers.map((s) => s.id));
  const laneIds = new Set(timelineLanes.map((l) => l.id));

  expect(
    timelineLanes.some((l) => l.kind === "visual" && l.role === "base"),
  ).toBe(true);

  for (const clip of timelineClips) {
    expect(laneIds.has(clip.laneId)).toBe(true);
    if (clip.kind === "scene") {
      expect(sceneIds.has(clip.sceneId)).toBe(true);
    }
  }
}

describe("editor-store contract", () => {
  it("exposes required public actions", () => {
    const state = useEditorStore.getState() as Record<string, unknown>;
    for (const name of REQUIRED_ACTIONS) {
      expect(typeof state[name], name).toBe("function");
    }
  });
});

describe("editor-store timeline invariants", () => {
  beforeEach(() => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(project, [], clips, lanes);
  });

  it("loadProject keeps clips/lanes/scenes aligned", () => {
    assertTimelineProjectInvariants();
  });

  it("moveClip to overlay keeps invariants", () => {
    useEditorStore.getState().moveClip("clip.overlay", {
      track: "overlay",
      startTime: 0.5,
      laneId: "lane.overlay.0",
    });
    assertTimelineProjectInvariants();
  });

  it("paste keeps invariants", () => {
    const store = useEditorStore.getState();
    store.selectClip("clip.overlay");
    store.copySelectedClips();
    store.pasteClips(3);
    assertTimelineProjectInvariants();
  });
});
