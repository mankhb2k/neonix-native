import { describe, expect, it } from "vitest";
import {
  MOTION_PROTOCOL_LIMITS,
  getTextPayloadPlain,
  parseMotionProject,
  visualLayerAtoms,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  createHistoryState,
  executePropertyCommand,
  PROPERTY_REGISTRY,
  readUniform,
  replaceOrPushHistory,
  resolvePropertyTargets,
  selectionClips,
  type HistoryEntry,
  type PropertyContext,
  type TimelineDocument,
} from "..";
import { getPropertyDefinition } from "../properties/registry";
import {
  fixtureMainOnly,
  fixtureMainPlusAudioOverlap,
} from "../testing/fixtures/projects";

function firstChild(project: MotionProject): MotionLayer | undefined {
  const scene = project.layers[0];
  return scene?.type === "group" ? scene.children[0] : undefined;
}

function firstChildStyle(
  project: MotionProject,
): Record<string, unknown> | undefined {
  const node = firstChild(project);
  if (!node || !("style" in node) || !node.style) return undefined;
  return node.style as Record<string, unknown>;
}

function setFirstChildX(project: MotionProject, x: number): MotionProject {
  const layers = project.layers.map((scene, i) => {
    if (i !== 0 || scene.type !== "group") return scene;
    const children = scene.children.map((n, j) => {
      if (j !== 0 || !("transform" in n)) return n;
      return {
        ...n,
        transform: {
          ...n.transform,
          translate: { ...n.transform.translate, x },
        },
      };
    });
    return { ...scene, children };
  });
  return { ...project, layers };
}

describe("property commands", () => {
  it("applies transform.x to focused scene node", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    expect(targets.length).toBeGreaterThan(0);

    const result = executePropertyCommand(doc, {
      type: "set-node-transform",
      targets,
      patch: { x: 120 },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = result.document.project.layers[0];
    const title = node && node.type === "group" ? node.children[0] : undefined;
    expect(
      title && "transform" in title ? title.transform.translate.x : undefined,
    ).toBe(120);
  });

  it("clamps opacity to 0..100", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-opacity",
      targets,
      opacity: 250,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const root = result.document.project.layers[0];
    const title = root && root.type === "group" ? root.children[0] : undefined;
    expect(
      title && "appearance" in title ? title.appearance.opacity : undefined,
    ).toBe(100);
  });

  it("applies set-node-timing for layer mode in/out", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-timing",
      targets,
      timing: { start: 0.5, duration: 1.25 },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const child = firstChild(result.document.project);
    expect(child?.timing).toEqual({ start: 0.5, duration: 1.25 });
  });

  it("reorders scene layers top-to-bottom via zIndex", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const scene = project.layers[0]!;
    const base = scene.type === "group" ? scene.children[0]! : null;
    const layers = [
      { ...base!, id: "n-top", zIndex: 2 },
      {
        ...base!,
        id: "n-mid",
        zIndex: 1,
        type: "shape" as const,
        payload: { shape: "rectangle" as const },
      },
      {
        ...base!,
        id: "n-bot",
        zIndex: 0,
        type: "shape" as const,
        payload: { shape: "rectangle" as const },
      },
    ] as MotionLayer[];
    const doc: TimelineDocument = {
      project: {
        ...project,
        layers: [
          { ...scene, type: "group" as const, children: layers } as MotionLayer,
        ],
      },
      clips,
      lanes,
    };
    const result = executePropertyCommand(doc, {
      type: "reorder-scene-layers",
      sceneId: scene.id,
      layerIds: ["n-mid", "n-top", "n-bot"],
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const nextScene = result.document.project.layers[0];
    const next = nextScene?.type === "group" ? nextScene.children : [];
    expect(next.map((n) => n.id)).toEqual(["n-mid", "n-top", "n-bot"]);
    expect(next.map((n) => n.zIndex)).toEqual([2, 1, 0]);
  });

  it("updates metadata name and visible", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-metadata",
      targets,
      patch: { name: "Hero", visible: false },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = firstChild(result.document.project);
    expect(node?.name).toBe("Hero");
    expect(
      node && "appearance" in node ? node.appearance.visible : undefined,
    ).toBe(false);
  });
});

describe("mixed + registry", () => {
  it("readUniform returns mixed for unequal values", () => {
    expect(readUniform([1, 2])).toEqual({ mixed: true });
    expect(readUniform([3, 3])).toBe(3);
  });

  it("registry read/createCommand for transform.x", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const selection = selectionClips([clips[0]!.id]);
    const targets = resolvePropertyTargets(selection, project, clips, lanes);
    const ctx: PropertyContext = {
      project,
      clips,
      lanes,
      selection,
      targets,
    };
    const prop = getPropertyDefinition("transform.translate.x")!;
    expect(prop.read(ctx)).toBe(40);
    const cmd = prop.createCommand(99, ctx);
    expect(cmd.type).toBe("set-node-transform");
    expect(PROPERTY_REGISTRY.length).toBeGreaterThanOrEqual(8);
  });
});

describe("Logic-2 property domain depth", () => {
  it("locks aspect when scaling uniformly", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-transform",
      targets,
      patch: { scaleX: 2.5, lockAspect: true },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = firstChild(result.document.project);
    expect(
      node && "transform" in node ? node.transform.scale.x : undefined,
    ).toBe(2.5);
    expect(
      node && "transform" in node ? node.transform.scale.y : undefined,
    ).toBe(2.5);
  });

  it("sets fill/stroke style on text layers", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-style",
      targets,
      patch: { fill: "#ff0000", stroke: "#00ff00", strokeWidth: 2 },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = firstChild(result.document.project);
    expect(node?.type).toBe("text");
    if (!node || node.type !== "text") return;
    const style = firstChildStyle(result.document.project);
    expect(style?.fill).toBe("#ff0000");
    expect(style?.stroke).toBe("#00ff00");
    expect(style?.strokeWidth).toBe(2);
  });

  it("updates typography payload", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-text",
      targets,
      patch: { text: "Hello", fontSize: 42, align: "center" },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = firstChild(result.document.project);
    expect(node?.type).toBe("text");
    if (!node || node.type !== "text") return;
    expect(getTextPayloadPlain(node.payload)).toBe("Hello");
    expect(node.payload.fontSize).toBe(42);
    expect(node.payload.alignment).toBe("center");
  });

  it("patches audio track volume and fades", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    const doc: TimelineDocument = { project, clips, lanes };
    const result = executePropertyCommand(doc, {
      type: "set-audio-track",
      audioTrackId: "audio.a",
      patch: { volume: 0.4, fadeIn: 0.2, fadeOut: 0.5 },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const track = result.document.project.layers.find(
      (l) => l.type === "audio" && l.id === "audio.a",
    );
    expect(track?.type === "audio" ? track.payload.volume : undefined).toBe(40);
    expect(track?.type === "audio" ? track.payload.fadeIn : undefined).toBe(
      0.2,
    );
    expect(track?.type === "audio" ? track.payload.fadeOut : undefined).toBe(
      0.5,
    );
  });

  it("upserts blur effect and property keyframe", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const withEffect = executePropertyCommand(doc, {
      type: "set-node-effects",
      targets,
      patch: { op: "upsert-blur", effectId: "fx.blur", radius: 8 },
    });
    expect(withEffect.status).toBe("applied");
    if (withEffect.status !== "applied") return;
    const effected = firstChild(withEffect.document.project);
    expect(
      effected && "effects" in effected ? effected.effects?.[0] : undefined,
    ).toEqual({ id: "fx.blur", type: "blur", radius: 8 });

    const withKey = executePropertyCommand(withEffect.document, {
      type: "set-property-keyframe",
      targets,
      property: "transform.translate.x",
      t: 0.5,
      v: 200,
      easing: "easeOut",
    });
    expect(withKey.status).toBe("applied");
    if (withKey.status !== "applied") return;
    const sceneClips = withKey.document.project.timeline.clips ?? [];
    expect(sceneClips.length).toBeGreaterThan(0);
    const trackClip = sceneClips.find(
      (c) => c.property === "transform.translate.x",
    );
    expect(trackClip?.keys[0]).toMatchObject({
      t: 0.5,
      value: 200,
    });
  });

  it("exposes color/enum/vector editors in registry", () => {
    expect(getPropertyDefinition("style.fill")?.editor).toBe("color");
    expect(getPropertyDefinition("text.align")?.editor).toBe("enum");
    expect(getPropertyDefinition("media.cropOrigin")?.editor).toBe("vector");
    expect(getPropertyDefinition("transform.scaleUniform")?.id).toBe(
      "transform.scaleUniform",
    );
  });

  it("rejects audio speed (no AudioTrack field)", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    const doc: TimelineDocument = { project, clips, lanes };
    const forced = executePropertyCommand(doc, {
      type: "set-audio-track",
      audioTrackId: "audio.a",
      patch: { speed: 1.25 } as never,
    });
    expect(forced.status).toBe("rejected");
  });

  it("rejects style on incompatible node types atomically", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const scene = project.layers[0]!;
    const groupId = "node.group";
    const groupNode = {
      id: groupId,
      type: "group" as const,
      parentLayerId: scene.id,
      zIndex: 0,
      ...visualLayerAtoms({ width: 100, height: 100 }),
      timing: { start: 0, duration: 1 },
      children: [
        {
          id: `${groupId}.child`,
          type: "solid" as const,
          parentLayerId: groupId,
          zIndex: 0,
          ...visualLayerAtoms({ width: 50, height: 50 }),
          timing: { start: 0, duration: 1 },
          payload: { color: "#000000" },
        },
      ],
    } as MotionLayer;
    const withGroup = {
      ...project,
      layers: [
        {
          ...scene,
          type: "group" as const,
          children: [
            ...(scene.type === "group" ? scene.children : []),
            groupNode,
          ],
        } as MotionLayer,
      ],
    };
    const result = executePropertyCommand(
      { project: withGroup, clips, lanes },
      {
        type: "set-node-style",
        targets: [{ sceneId: scene.id, layerId: groupId }],
        patch: { fill: "#fff" },
      },
    );
    expect(result.status).toBe("rejected");
  });

  it("clamps crop so x+width and y+height stay within 1", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    const scene = project.layers[0]!;
    const imageId = "node.img";
    const assetId = project.assets[0]!.id;
    const imageNode = {
      id: imageId,
      type: "image" as const,
      parentLayerId: scene.id,
      zIndex: 0,
      ...visualLayerAtoms({ width: 100, height: 100 }),
      timing: { start: 0, duration: 1 },
      payload: { assetId, fit: "cover" as const },
    } as MotionLayer;
    const withImage = {
      ...project,
      layers: [
        {
          ...scene,
          type: "group" as const,
          children: [
            ...(scene.type === "group" ? scene.children : []),
            imageNode,
          ],
        } as MotionLayer,
      ],
    };
    const injected = executePropertyCommand(
      { project: withImage, clips, lanes },
      {
        type: "set-node-media",
        targets: [{ sceneId: scene.id, layerId: imageId }],
        patch: { crop: { x: 0.7, y: 0.8, width: 0.5, height: 0.5 } },
      },
    );
    expect(injected.status).toBe("applied");
    if (injected.status !== "applied") return;
    const injectedScene = injected.document.project.layers[0];
    const node =
      injectedScene?.type === "group"
        ? injectedScene.children.find((n) => n.id === imageId)
        : undefined;
    expect(node?.type).toBe("image");
    if (!node || node.type !== "image" || !node.payload.crop) return;
    expect(node.payload.crop.x + node.payload.crop.width).toBeLessThanOrEqual(
      1 + 1e-9,
    );
    expect(node.payload.crop.y + node.payload.crop.height).toBeLessThanOrEqual(
      1 + 1e-9,
    );
  });

  it("dedupes effect reorder ids (first-wins)", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    let doc: TimelineDocument = { project, clips, lanes };
    for (const id of ["a", "b", "c"]) {
      const r = executePropertyCommand(doc, {
        type: "set-node-effects",
        targets,
        patch: { op: "upsert-blur", effectId: id, radius: 1 },
      });
      expect(r.status).toBe("applied");
      if (r.status === "applied") doc = r.document;
    }
    const reordered = executePropertyCommand(doc, {
      type: "set-node-effects",
      targets,
      patch: { op: "reorder", effectIds: ["c", "a", "c", "b", "a"] },
    });
    expect(reordered.status).toBe("applied");
    if (reordered.status !== "applied") return;
    const node = firstChild(reordered.document.project);
    const ids = (node && "effects" in node ? (node.effects ?? []) : []).map(
      (e) => e.id,
    );
    expect(ids).toEqual(["c", "a", "b"]);
  });

  it("rejects non-finite style / crop / audio / keyframe numbers", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );

    expect(
      executePropertyCommand(doc, {
        type: "set-node-style",
        targets,
        patch: { fillOpacity: Number.NaN },
      }).status,
    ).toBe("rejected");

    expect(
      executePropertyCommand(doc, {
        type: "set-node-media",
        targets,
        patch: {
          crop: { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 0.5 },
        },
      }).status,
    ).toBe("rejected");

    const withAudio = fixtureMainPlusAudioOverlap();
    const audioId = withAudio.project.layers.find(
      (l) => l.type === "audio",
    )!.id;
    expect(
      executePropertyCommand(
        {
          project: withAudio.project,
          clips: withAudio.clips,
          lanes: withAudio.lanes,
        },
        {
          type: "set-audio-track",
          audioTrackId: audioId,
          patch: { volume: Number.NEGATIVE_INFINITY },
        },
      ).status,
    ).toBe("rejected");

    expect(
      executePropertyCommand(doc, {
        type: "set-property-keyframe",
        targets,
        property: "transform.translate.x",
        t: Number.NaN,
        v: 1,
      }).status,
    ).toBe("rejected");

    expect(
      executePropertyCommand(doc, {
        type: "set-node-effects",
        targets,
        patch: { op: "upsert-blur", effectId: "b1", radius: Number.NaN },
      }).status,
    ).toBe("rejected");

    expect(
      executePropertyCommand(doc, {
        type: "set-property-keyframe",
        targets,
        property: "transform.translate.x",
        t: 86_401,
        v: 1,
      }).status,
    ).toBe("rejected");
  });

  it("allocates distinct keyframe clip ids for properties that sanitize alike", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const a = executePropertyCommand(doc, {
      type: "set-property-keyframe",
      targets,
      property: "a.b",
      t: 0,
      v: 1,
    });
    expect(a.status).toBe("applied");
    if (a.status !== "applied") return;
    const b = executePropertyCommand(a.document, {
      type: "set-property-keyframe",
      targets,
      property: "a-b",
      t: 0,
      v: 2,
    });
    expect(b.status).toBe("applied");
    if (b.status !== "applied") return;
    const sceneClips = b.document.project.timeline.clips ?? [];
    const kfClips = sceneClips.filter((c) => c.id.startsWith("kf_"));
    expect(kfClips.length).toBeGreaterThanOrEqual(2);
    expect(new Set(kfClips.map((c) => c.id)).size).toBe(kfClips.length);
  });

  it("clamps keyframe clip duration at mediaDurationSeconds boundary", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const t = MOTION_PROTOCOL_LIMITS.mediaDurationSeconds;
    const result = executePropertyCommand(doc, {
      type: "set-property-keyframe",
      targets,
      property: "transform.translate.x",
      t,
      v: 42,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const kf = result.document.project.timeline.clips?.find(
      (c) => c.property === "transform.translate.x",
    );
    expect(kf).toBeTruthy();
    expect(kf!.keys[0]!.t).toBeLessThanOrEqual(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    );
    expect(() => parseMotionProject(result.document.project)).not.toThrow();
  });
});

describe("history coalesce", () => {
  it("replaceOrPushHistory keeps a single scrub entry", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const before: TimelineDocument = { project, clips, lanes };
    let after: TimelineDocument = {
      project: setFirstChildX(project, 10),
      clips,
      lanes,
    };

    let state = createHistoryState();
    const entry1: HistoryEntry = {
      id: "h1",
      timestamp: 1,
      label: "transform.translate.x",
      coalesceKey: "scrub:transform.x:clip1",
      before,
      after,
    };
    state = replaceOrPushHistory(state, entry1, {
      coalesceKey: entry1.coalesceKey,
    });

    after = {
      ...after,
      project: setFirstChildX(after.project, 50),
    };
    const entry2: HistoryEntry = {
      id: "h2",
      timestamp: 2,
      label: "transform.translate.x",
      coalesceKey: "scrub:transform.x:clip1",
      before: after,
      after,
    };
    state = replaceOrPushHistory(state, entry2, {
      coalesceKey: entry2.coalesceKey,
    });

    expect(state.past).toHaveLength(1);
    expect(state.past[0]!.before).toBe(before);
    const finalNode = firstChild(state.past[0]!.after.project);
    expect(
      finalNode && "transform" in finalNode
        ? finalNode.transform.translate.x
        : undefined,
    ).toBe(50);
  });
});
