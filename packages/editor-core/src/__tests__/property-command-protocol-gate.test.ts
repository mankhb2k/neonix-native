/**
 * Contract test cho property command boundary.
 * Khóa 2 điều:
 *   1. Mọi applied property command phải phát ra project hợp lệ protocol V1
 *      (schema-only) + document mới (revision tăng, fingerprint được stamp).
 *   2. resolvePropertyTargets + registry phải nhất quán với protocol (node type
 *      nào mới có style / crop — không còn Math.random() hay drift).
 */
import { describe, expect, it } from "vitest";
import {
  MotionProjectV1Schema,
  parseMotionProjectV1,
  visualLayerAtoms,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  executePropertyCommand,
  getPropertyDefinition,
  packRootLayersToTimeline,
  resolvePropertyTargets,
  selectionClips,
  selectionNode,
  validateTimelineDocument,
  type DocumentPropertyCommand,
  type NodeTargetRef,
  type PropertyContext,
  type TimelineClip,
  type TimelineDocument,
} from "..";
import {
  fixtureMainOnly,
  fixtureMainPlusAudioOverlap,
} from "../testing/fixtures/projects";
import { finalizeDocumentMutation } from "../document/finalize-document-mutation";

// ── Helpers ────────────────────────────────────────────────────────────

function textTarget(project: MotionProject): NodeTargetRef {
  const scene = project.layers[0]!;
  const layerId = scene.type === "group" ? scene.children[0]!.id : scene.id;
  return { rootLayerId: scene.id, layerId };
}

function makeShape(id: string, sceneId: string): MotionLayer {
  return {
    id,
    type: "shape",
    parentLayerId: sceneId,
    zIndex: 1,
    ...visualLayerAtoms({ width: 100, height: 100 }),
    timing: { start: 0, duration: 1 },
    payload: { shape: "rectangle" },
  } as MotionLayer;
}

function makeImage(id: string, sceneId: string, assetId: string): MotionLayer {
  return {
    id,
    type: "image",
    parentLayerId: sceneId,
    zIndex: 1,
    ...visualLayerAtoms({ width: 100, height: 100 }),
    timing: { start: 0, duration: 1 },
    payload: { assetId, fit: "cover" },
  } as MotionLayer;
}

function injectChild(
  doc: TimelineDocument,
  node: MotionLayer,
): { doc: TimelineDocument; target: NodeTargetRef } {
  const scene = doc.project.layers[0]!;
  const next: TimelineDocument = {
    ...doc,
    project: {
      ...doc.project,
      layers: doc.project.layers.map((l) =>
        l.id === scene.id
          ? ({
              ...l,
              type: "group" as const,
              children: [...(l.type === "group" ? l.children : []), node],
            } as MotionLayer)
          : l,
      ),
    },
  };
  return { doc: next, target: { rootLayerId: scene.id, layerId: node.id } };
}

function assertAppliedValid(
  doc: TimelineDocument,
  command: DocumentPropertyCommand,
): TimelineDocument {
  const result = executePropertyCommand(doc, command);
  if (result.status !== "applied") {
    throw new Error(
      `Property command ${command.type} rejected unexpectedly: ${result.message}`,
    );
  }

  // 1. Ranh giới protocol: project phải parse được theo schema V1.
  const parsed = MotionProjectV1Schema.safeParse(result.document.project);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(
      `command ${command.type} produced invalid protocol V1: ${issues}`,
    );
  }

  // 2. Freshness: revision + fingerprint phải được stamp ở core.
  expect(result.document.revision).toBeGreaterThanOrEqual(1);
  expect(result.document.fingerprint).toBeDefined();

  // 3. Document invariants vẫn giữ.
  expect(validateTimelineDocument(result.document).valid).toBe(true);

  return result.document;
}

// ── Gate: mọi applied command → protocol-valid ─────────────────────────

describe("property command → protocol contract", () => {
  it("reorder-scene-layers → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const base: TimelineDocument = { project, clips, lanes };
    const shape = makeShape("node.shape", "scene.main.a");
    const { doc } = injectChild(base, shape);
    assertAppliedValid(doc, {
      type: "reorder-scene-layers",
      rootLayerId: "scene.main.a",
      layerIds: ["node.shape", "scene.main.a.title"],
    });
  });

  it("set-node-transform → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-node-transform",
        targets: [textTarget(project)],
        patch: { x: 10, rotation: 5 },
      },
    );
  });

  it("set-node-opacity → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-node-opacity",
        targets: [textTarget(project)],
        opacity: 50,
      },
    );
  });

  it("set-node-metadata → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-node-metadata",
        targets: [textTarget(project)],
        patch: { visible: false },
      },
    );
  });

  it("set-node-style (shape) → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const base: TimelineDocument = { project, clips, lanes };
    const { doc, target } = injectChild(
      base,
      makeShape("node.shape", "scene.main.a"),
    );
    assertAppliedValid(doc, {
      type: "set-node-style",
      targets: [target],
      patch: { fill: "#ff0000", stroke: "#00ff00", strokeWidth: 2 },
    });
  });

  it("set-node-text → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-node-text",
        targets: [textTarget(project)],
        patch: { text: "Hello", fontSize: 42, align: "center" },
      },
    );
  });

  it("set-node-media (image crop) → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    const base: TimelineDocument = { project, clips, lanes };
    const assetId = project.assets[0]!.id;
    const { doc, target } = injectChild(
      base,
      makeImage("node.img", "scene.main", assetId),
    );
    assertAppliedValid(doc, {
      type: "set-node-media",
      targets: [target],
      patch: { crop: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 } },
    });
  });

  it("set-audio-track → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-audio-track",
        audioTrackId: "audio.a",
        patch: { volume: 0.5 },
      },
    );
  });

  it("set-node-effects → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-node-effects",
        targets: [textTarget(project)],
        patch: { op: "upsert-blur", effectId: "b1", radius: 4 },
      },
    );
  });

  it("set-node-timing → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    assertAppliedValid(
      { project, clips, lanes },
      {
        type: "set-node-timing",
        targets: [textTarget(project)],
        timing: { start: 0.5, duration: 1.5 },
      },
    );
  });

  it("set-node-timing reprojects the scene clip (no stale duration)", () => {
    const project = primitiveTextProject();
    const { clips, lanes } = packRootLayersToTimeline(project);
    const base: TimelineDocument = { project, clips, lanes };
    const clip = clips.find((c) => c.kind === "scene");
    expect(clip?.duration).toBe(4);

    const result = executePropertyCommand(base, {
      type: "set-node-timing",
      targets: [{ rootLayerId: "title", layerId: "title" }],
      timing: { start: 1, duration: 2.5 },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const nextClip = result.document.clips.find(
      (c) => c.kind === "scene" && c.sceneId === "title",
    );
    expect(nextClip?.duration).toBe(2.5);
    expect(nextClip?.startTime).toBe(1);
  });

  it("rejects invalid_document when base clips dangle", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const ghost: TimelineClip = {
      kind: "scene",
      id: "clip.ghost",
      sceneId: "scene.missing",
      laneId: "lane.main",
      startTime: 10,
      duration: 1,
      name: "Ghost",
    };
    const result = executePropertyCommand(
      { project, clips: [...clips, ghost], lanes },
      {
        type: "set-node-transform",
        targets: [
          { rootLayerId: "scene.main.a", layerId: "scene.main.a.title" },
        ],
        patch: { x: 1 },
      },
    );
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reason).toBe("invalid_document");
    }
  });

  it("rejects invalid_protocol when project fails schema", () => {
    const project = primitiveTextProject();
    const { clips, lanes } = packRootLayersToTimeline(project);
    const duplicate: MotionLayer = {
      ...project.layers[0]!,
      id: "title.dup",
      name: "Dup",
    };
    const bad: MotionProject = {
      ...project,
      layers: [...project.layers, duplicate],
    };
    const result = finalizeDocumentMutation(bad, { project, clips, lanes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_protocol");
  });

  it("keyframe set/move/delete/easing → protocol-valid", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const base: TimelineDocument = { project, clips, lanes };
    const target = textTarget(project);

    const withKey = assertAppliedValid(base, {
      type: "set-property-keyframe",
      targets: [target],
      property: "transform.translate.x",
      t: 0.5,
      v: 100,
    });
    const withEasing = assertAppliedValid(withKey, {
      type: "set-keyframe-easing",
      targets: [target],
      property: "transform.translate.x",
      t: 0.5,
      easing: "easeOut",
    });
    const moved = assertAppliedValid(withEasing, {
      type: "move-property-keyframe",
      targets: [target],
      property: "transform.translate.x",
      t: 0.5,
      newT: 1,
    });
    assertAppliedValid(moved, {
      type: "delete-property-keyframe",
      targets: [target],
      property: "transform.translate.x",
      t: 1,
    });
  });
});

// ── resolvePropertyTargets ─────────────────────────────────────────────

function primitiveTextProject(): MotionProject {
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "proj_prim", name: "Prim", locale: "vi-VN" },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#111111",
      colorSpace: "srgb",
    },
    assets: [],
    components: [],
    layers: [
      {
        id: "title",
        type: "text",
        parentLayerId: null,
        zIndex: 0,
        opacity: 100,
        frame: { width: 200, height: 80 },
        transform: {
          translate: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotate: { z: 0 },
          skew: { x: 0, y: 0 },
          origin: { x: 0.5, y: 0.5 },
        },
        timing: { start: 0, duration: 4 },
        payload: {
          text: "Hello",
          fontSize: 48,
          color: "#ffffff",
          alignment: "center",
        },
      },
    ],
  });
}

describe("resolvePropertyTargets", () => {
  it("resolves a primitive (non-group) root to itself", () => {
    const project = primitiveTextProject();
    const { clips, lanes } = packRootLayersToTimeline(project);
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    expect(targets).toEqual([{ rootLayerId: "title", layerId: "title" }]);
  });

  it("resolves a group root to its first editable child", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    expect(targets).toEqual([
      { rootLayerId: "scene.main.a", layerId: "scene.main.a.title" },
    ]);
  });

  it("resolves a node selection with its rootLayerId derived", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const targets = resolvePropertyTargets(
      selectionNode("scene.main.a.title"),
      project,
      clips,
      lanes,
    );
    expect(targets).toEqual([
      { rootLayerId: "scene.main.a", layerId: "scene.main.a.title" },
    ]);
  });

  it("resolves multi-selection across scene clips deterministically", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const targets = resolvePropertyTargets(
      selectionClips(["clip.main.a", "clip.main.b"]),
      project,
      clips,
      lanes,
    );
    expect(targets).toEqual([
      { rootLayerId: "scene.main.a", layerId: "scene.main.a.title" },
      { rootLayerId: "scene.main.b", layerId: "scene.main.b.title" },
    ]);
  });
});

// ── Registry ↔ protocol symmetry ───────────────────────────────────────

function paintContextForType(type: string): PropertyContext {
  const id = `n.${type}`;
  const node = { id, type } as unknown as MotionLayer;
  const project = { layers: [node] } as unknown as MotionProject;
  return {
    project,
    clips: [],
    lanes: [],
    selection: selectionNode(id),
    targets: [{ rootLayerId: id, layerId: id }],
  };
}

describe("registry ↔ protocol symmetry", () => {
  it("shows fill only where protocol has a style field", () => {
    const fill = getPropertyDefinition("style.fill")!;
    expect(fill.isVisible(paintContextForType("shape"))).toBe(true);
    expect(fill.isVisible(paintContextForType("path"))).toBe(true);
    expect(fill.isVisible(paintContextForType("svg"))).toBe(true);
    expect(fill.isVisible(paintContextForType("text"))).toBe(false);
    expect(fill.isVisible(paintContextForType("image"))).toBe(false);
  });

  it("shows stroke/strokeWidth only for shape/path (svg has fill-only style)", () => {
    const stroke = getPropertyDefinition("style.stroke")!;
    const strokeWidth = getPropertyDefinition("style.strokeWidth")!;
    for (const type of ["shape", "path"]) {
      expect(stroke.isVisible(paintContextForType(type))).toBe(true);
      expect(strokeWidth.isVisible(paintContextForType(type))).toBe(true);
    }
    for (const type of ["svg", "text", "image"]) {
      expect(stroke.isVisible(paintContextForType(type))).toBe(false);
      expect(strokeWidth.isVisible(paintContextForType(type))).toBe(false);
    }
  });

  it("shows cropOrigin only for image and fit only for media types", () => {
    const crop = getPropertyDefinition("media.cropOrigin")!;
    const fit = getPropertyDefinition("media.fit")!;
    expect(crop.isVisible(paintContextForType("image"))).toBe(true);
    for (const type of ["svg", "video", "text", "shape"]) {
      expect(crop.isVisible(paintContextForType(type))).toBe(false);
    }
    for (const type of ["image", "svg", "video"]) {
      expect(fit.isVisible(paintContextForType(type))).toBe(true);
    }
    for (const type of ["text", "shape"]) {
      expect(fit.isVisible(paintContextForType(type))).toBe(false);
    }
  });
});
