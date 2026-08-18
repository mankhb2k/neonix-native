import { describe, expect, it } from "vitest";
import {
  parseMotionProjectV1,
  visualLayerAtoms,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  selectionClips,
  selectionNone,
  selectionNode,
  selectedClipIdsFrom,
  selectedNodeIdFrom,
  selectedOverlayIdFrom,
  selectedRootLayerIdFrom,
} from "../selection/editor-selection";
import { selectSelectedNodeId } from "../selection/editor-selectors";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../timeline/timeline-clips";
import { fixtureMainOnly } from "../testing/fixtures/projects";

const lanes: TimelineLane[] = [
  {
    id: "base",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "ov",
    kind: "visual",
    role: "overlay",
    order: 0,
    name: "Lớp 1",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
];

const clips: TimelineClip[] = [
  {
    id: "c1",
    kind: "scene",
    sceneId: "s1",
    laneId: "base",
    startTime: 0,
    duration: 2,
    name: "A",
  },
  {
    id: "c2",
    kind: "scene",
    sceneId: "s2",
    laneId: "ov",
    startTime: 0,
    duration: 1,
    name: "B",
  },
];

describe("EditorSelection", () => {
  it("selectionClips dedupes and picks primary", () => {
    const sel = selectionClips(["a", "a", "b"], "a");
    expect(sel).toEqual({ kind: "clips", ids: ["a", "b"], primaryId: "a" });
    expect(selectionClips([])).toEqual(selectionNone());
  });

  it("derives rootLayerId from base clip selection", () => {
    const sel = selectionClips(["c1"]);
    expect(selectedRootLayerIdFrom(sel, clips)).toBe("s1");
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBeNull();
  });

  it("derives overlay id and rootLayerId from overlay clip selection", () => {
    const sel = selectionClips(["c2"]);
    expect(selectedRootLayerIdFrom(sel, clips)).toBe("s2");
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBe("c2");
  });

  it("node selection is a pure layerId (no root layer)", () => {
    const sel = selectionNode("n1");
    expect(sel).toEqual({ kind: "node", layerId: "n1" });
    expect(selectedNodeIdFrom(sel)).toBe("n1");
    expect(selectedRootLayerIdFrom(sel, clips)).toBeNull();
    expect(selectedClipIdsFrom(sel)).toEqual([]);
  });
});

function primitiveRootProject(): MotionProject {
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "proj.prim", name: "Prim", locale: "vi-VN" },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#111111",
      colorSpace: "srgb",
    },
    capabilities: { required: [] },
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: { colors: { brand: "#111111" }, fonts: { display: "Inter" } },
    variables: [],
    assets: [],
    components: [],
    layers: [
      {
        id: "title",
        type: "text",
        name: "Title",
        parentLayerId: null,
        zIndex: 0,
        ...visualLayerAtoms({ width: 200, height: 80 }),
        timing: { start: 0, duration: 4 },
        payload: {
          text: "Hello",
          fontSize: 48,
          color: "#ffffff",
          alignment: "center",
        },
      },
    ],
    timeline: { duration: 4 },
    bindings: [],
  });
}

const primitiveClips: TimelineClip[] = [
  {
    id: "clip.title",
    kind: "scene",
    sceneId: "title",
    laneId: "base",
    startTime: 0,
    duration: 4,
    name: "Title",
  },
];

const audioLane: TimelineLane = {
  id: "lane.audio",
  kind: "audio",
  role: "audio",
  order: -1,
  name: "Audio",
};

describe("EditorSelection selectors (root-layer canonical)", () => {
  it("selectSelectedNodeId focuses a primitive root to itself", () => {
    const project = primitiveRootProject();
    expect(
      selectSelectedNodeId(
        selectionClips(["clip.title"]),
        primitiveClips,
        project,
      ),
    ).toBe("title");
  });

  it("selectSelectedNodeId focuses the first editable child of a group root", () => {
    const { project, clips: fixtureClips } = fixtureMainOnly();
    expect(
      selectSelectedNodeId(
        selectionClips(["clip.main.a"]),
        fixtureClips,
        project,
      ),
    ).toBe("scene.main.a.title");
  });

  it("multi-clip selection keeps explicit primaryId", () => {
    const sel = selectionClips(["clip.main.a", "clip.main.b"], "clip.main.b");
    expect(sel).toEqual({
      kind: "clips",
      ids: ["clip.main.a", "clip.main.b"],
      primaryId: "clip.main.b",
    });
    expect(selectedClipIdsFrom(sel)).toEqual(["clip.main.a", "clip.main.b"]);
  });

  it("audio clip selection yields no root layer and no overlay", () => {
    const audioClip: TimelineClip = {
      id: "clip.audio",
      kind: "audio",
      audioTrackId: "audio.a",
      assetId: "asset.a",
      laneId: "lane.audio",
      startTime: 0,
      duration: 4,
      name: "BGM",
    };
    const sel = selectionClips(["clip.audio"]);
    expect(selectedRootLayerIdFrom(sel, [audioClip])).toBeNull();
    expect(selectedOverlayIdFrom(sel, [audioClip], [audioLane])).toBeNull();
  });

  it("stale clip id / missing lane yields null", () => {
    const sel = selectionClips(["clip.missing"]);
    expect(selectedRootLayerIdFrom(sel, clips)).toBeNull();
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBeNull();
  });

  it("selectSelectedNodeId returns explicit node id without a project", () => {
    expect(selectSelectedNodeId(selectionNode("n1"), [], null)).toBe("n1");
  });
});
