import { describe, expect, it } from "vitest";
import {
  parseMotionProjectV1,
  MotionProjectV1Schema,
  visualLayerAtoms,
  type MotionLayer,
} from "@motionvideo/motion-protocol";
import {
  collectLayerIds,
  validateTimelineDocument,
  type TimelineDocument,
} from "../document/document";
import { resolveGroupPath } from "../document/group-path";
import {
  projectToTimelineDocument,
  rederiveDocument,
  isDocumentFresh,
  validateStableIds,
} from "../document/canonical-projection";
import { syncProjectProtocolContract } from "../document/sync-project-protocol-contract";

const ATOMS = visualLayerAtoms({ width: 1920, height: 1080 });

const VIDEO_ASSET = {
  id: "asset.video",
  uri: "./clip.mp4",
  assetType: "video",
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  duration: 12,
  fps: 30,
};
const AUDIO_A = {
  id: "asset.audio.a",
  uri: "./a.mp3",
  assetType: "audio",
  mimeType: "audio/mpeg",
  duration: 8,
};
const AUDIO_B = {
  id: "asset.audio.b",
  uri: "./b.mp3",
  assetType: "audio",
  mimeType: "audio/mpeg",
  duration: 8,
};

function videoLayer(
  id: string,
  z: number,
  start: number,
  duration: number,
): MotionLayer {
  return {
    id,
    type: "video",
    parentLayerId: null,
    name: id,
    zIndex: z,
    timing: { start, duration },
    ...ATOMS,
    payload: { assetId: VIDEO_ASSET.id, trimStart: 0 },
  } as MotionLayer;
}

function solidLayer(
  id: string,
  parentId: string | null,
  z: number,
  start: number,
  duration: number,
): MotionLayer {
  return {
    id,
    type: "solid",
    parentLayerId: parentId,
    zIndex: z,
    timing: { start, duration },
    ...ATOMS,
    payload: { color: "#4A90D9" },
  } as MotionLayer;
}

function textLayer(
  id: string,
  parentId: string,
  z: number,
  start: number,
  duration: number,
  text: string,
): MotionLayer {
  return {
    id,
    type: "text",
    parentLayerId: parentId,
    name: text,
    zIndex: z,
    timing: { start, duration },
    ...visualLayerAtoms({ width: 200, height: 40 }),
    payload: { text, fontSize: 24, color: "#111111", alignment: "left" },
  } as MotionLayer;
}

function audioLayer(
  id: string,
  z: number,
  start: number,
  duration: number,
  assetId: string,
): MotionLayer {
  return {
    id,
    type: "audio",
    parentLayerId: null,
    zIndex: z,
    timing: { start, duration },
    payload: {
      assetId,
      trimStart: 0,
      playbackRate: 1,
      volume: 100,
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
      muted: false,
    },
  } as MotionLayer;
}

/**
 * Project phong phú: nested groups 2 tầng + audio thật + assets + tokens +
 * variables. timeline.duration = 8 bao phủ mọi root layer.
 */
function richProjectInput() {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "rich", name: "Rich", locale: "vi-VN" },
    composition: { width: 1920, height: 1080, fps: 30 },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {
      colors: { brand: "#1A5D3A" },
      fonts: { display: "Be Vietnam Pro" },
      spacing: { s1: 4 },
    },
    variables: [
      { id: "var.title", type: "string", value: "Hello" },
      { id: "var.brand", type: "color", value: "#1A5D3A" },
    ],
    assets: [VIDEO_ASSET, AUDIO_A, AUDIO_B],
    components: [],
    timeline: { duration: 8 },
    bindings: [],
    layers: [
      videoLayer("video.main", 0, 0, 8),
      {
        id: "group.hero",
        type: "group",
        parentLayerId: null,
        name: "Hero",
        zIndex: 1,
        timing: { start: 2, duration: 4 },
        ...ATOMS,
        children: [
          {
            id: "group.inner",
            type: "group",
            parentLayerId: "group.hero",
            name: "Inner",
            zIndex: 0,
            timing: { start: 1, duration: 3 },
            ...ATOMS,
            children: [
              textLayer("text.title", "group.inner", 0, 0, 3, "Title"),
              solidLayer("shape.logo", "group.inner", 1, 1, 2),
            ],
          },
        ],
      },
      audioLayer("audio.music", -1, 0, 8, AUDIO_A.id),
      audioLayer("audio.vo", -2, 1, 3, AUDIO_B.id),
    ],
  };
}

describe("collectLayerIds", () => {
  it("collects ids across nested groups recursively", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const ids = collectLayerIds(project.layers);
    expect(ids.has("video.main")).toBe(true);
    expect(ids.has("group.hero")).toBe(true);
    expect(ids.has("group.inner")).toBe(true);
    expect(ids.has("text.title")).toBe(true);
    expect(ids.has("shape.logo")).toBe(true);
  });

  it("excludes audio layers", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const ids = collectLayerIds(project.layers);
    expect(ids.has("audio.music")).toBe(false);
    expect(ids.has("audio.vo")).toBe(false);
  });
});

describe("validateStableIds deep nested media", () => {
  it("catches a media layer buried in nested groups referencing a missing asset", () => {
    const parsed = parseMotionProjectV1(richProjectInput());
    const deepVideo = {
      ...videoLayer("video.deep", 0, 0, 2),
      parentLayerId: "group.deeper",
      payload: { assetId: "asset.missing", trimStart: 0 },
    } as MotionLayer;
    const deeperGroup = {
      id: "group.deeper",
      type: "group",
      parentLayerId: "group.deep",
      name: "Deeper",
      zIndex: 0,
      timing: { start: 0, duration: 8 },
      ...ATOMS,
      children: [deepVideo],
    } as MotionLayer;
    const deepGroup = {
      id: "group.deep",
      type: "group",
      parentLayerId: null,
      name: "Deep",
      zIndex: 2,
      timing: { start: 0, duration: 8 },
      ...ATOMS,
      children: [deeperGroup],
    } as MotionLayer;

    const doc: TimelineDocument = {
      project: { ...parsed, layers: [...parsed.layers, deepGroup] },
      lanes: [],
      clips: [],
    };

    const violations = validateStableIds(doc);
    expect(
      violations.some(
        (v) => v.kind === "dangling_asset" && v.refId === "asset.missing",
      ),
    ).toBe(true);
  });
});

describe("resolveGroupPath deep drill-down", () => {
  it("accumulates timeOffset across nested groups", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const resolved = resolveGroupPath(project.layers, [
      "group.hero",
      "group.inner",
    ]);
    expect(resolved.crumbs.map((c) => c.id)).toEqual([
      "group.hero",
      "group.inner",
    ]);
    expect(resolved.timeOffset).toBe(3); // hero.start(2) + inner.start(1)
    expect(resolved.layers.map((l) => l.id).sort()).toEqual([
      "shape.logo",
      "text.title",
    ]);
  });

  it("returns root layers when path is empty", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const resolved = resolveGroupPath(project.layers, []);
    expect(resolved.timeOffset).toBe(0);
    expect(resolved.crumbs).toEqual([]);
    expect(resolved.layers).toHaveLength(4); // video.main + group.hero + 2 audio
  });
});

describe("projectToTimelineDocument rich project", () => {
  it("projects nested groups + audio into a valid document", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const doc = projectToTimelineDocument(project);
    expect(validateTimelineDocument(doc)).toEqual({ valid: true });

    const sceneClips = doc.clips.filter((c) => c.kind === "scene");
    expect(sceneClips.map((c) => c.id).sort()).toEqual([
      "group.hero",
      "video.main",
    ]);

    const audioClips = doc.clips.filter((c) => c.kind === "audio");
    expect(audioClips.map((c) => c.id).sort()).toEqual([
      "audio.music",
      "audio.vo",
    ]);
  });

  it("groupPath projection yields a one-child-per-row surface", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const doc = projectToTimelineDocument(project, undefined, [
      "group.hero",
      "group.inner",
    ]);
    expect(doc.clips.every((c) => c.kind === "scene")).toBe(true);
    expect(doc.clips.map((c) => c.id).sort()).toEqual([
      "shape.logo",
      "text.title",
    ]);
    expect(doc.lanes.some((l) => l.kind === "audio")).toBe(false);
  });
});

describe("protocol → document pipeline", () => {
  it("parse → project → validate → rederive stays valid", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const doc = projectToTimelineDocument(project);
    expect(validateTimelineDocument(doc)).toEqual({ valid: true });

    const doc2 = rederiveDocument(doc);
    expect(doc2.revision).toBe((doc.revision ?? 0) + 1);
    expect(isDocumentFresh(doc2)).toBe(true);
    expect(validateTimelineDocument(doc2)).toEqual({ valid: true });
  });

  it("rederive recomputes clips after a project mutation", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const doc = projectToTimelineDocument(project);
    const before = doc.clips.find((c) => c.id === "video.main");
    expect(before?.startTime).toBe(0);

    // Mutate the shared project: move video.main to [3, 8].
    project.layers = project.layers.map((l) =>
      l.id === "video.main" ? { ...l, timing: { start: 3, duration: 5 } } : l,
    );
    const doc2 = rederiveDocument(doc);
    const after = doc2.clips.find((c) => c.id === "video.main");
    expect(after?.startTime).toBe(3);
    expect(doc2.revision).toBe((doc.revision ?? 0) + 1);
  });
});

describe("field preservation through document pipeline", () => {
  it("projectToTimelineDocument keeps project by reference", () => {
    const project = parseMotionProjectV1(richProjectInput());
    const doc = projectToTimelineDocument(project);
    expect(doc.project).toBe(project);
  });

  it("rederiveDocument keeps project by reference", () => {
    const doc = projectToTimelineDocument(
      parseMotionProjectV1(richProjectInput()),
    );
    expect(rederiveDocument(doc).project).toBe(doc.project);
  });
});

describe("syncProjectProtocolContract preserves non-layer fields", () => {
  function fullSurfaceProject() {
    return MotionProjectV1Schema.parse({
      format: "motion-project",
      formatVersion: 1,
      metadata: { id: "full-surface", name: "Full", locale: "vi-VN" },
      composition: { width: 1920, height: 1080, fps: 30 },
      capabilities: {},
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: { colors: { brand: "#111111" } },
      variables: [{ id: "var.title", type: "string", value: "Hi" }],
      assets: [VIDEO_ASSET],
      components: [
        {
          id: "comp.badge",
          version: "1.0.0",
          integrity: "sha256-comp-badge",
          props: [{ id: "label", kind: "string", default: "Hi" }],
          variants: [],
          propBindings: [],
          layers: [solidLayer("comp.layer", null, 0, 0, 1)],
        },
      ],
      timeline: { duration: 1 },
      bindings: [
        {
          id: "bind.title",
          source: { kind: "variable", variableId: "var.title" },
          target: { type: "prop", layerId: "video.main", propId: "opacity" },
        },
      ],
      layers: [videoLayer("video.main", 0, 0, 1)],
      extensions: {},
    });
  }

  it("keeps variables/assets/components/bindings/timeline/composition by reference", () => {
    const project = fullSurfaceProject();
    const next = syncProjectProtocolContract(project);
    expect(next.variables).toBe(project.variables);
    expect(next.assets).toBe(project.assets);
    expect(next.components).toBe(project.components);
    expect(next.bindings).toBe(project.bindings);
    expect(next.timeline).toBe(project.timeline);
    expect(next.composition).toBe(project.composition);
    expect(next.dependencies).toBe(project.dependencies);
    expect(next.tokens?.colors).toEqual(project.tokens?.colors);
  });
});
