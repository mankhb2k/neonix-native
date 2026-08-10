import { describe, expect, it } from "vitest";
import {
  MOTION_V2_LIMITS,
  getTextPayloadPlain,
  parseMotionProjectV2,
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
import { fixtureMainOnly, fixtureMainPlusAudioOverlap } from "../testing/fixtures/projects";

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
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.transform.x).toBe(120);
  });

  it("clamps opacity to 0..1", () => {
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
      opacity: 2.5,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.document.project.scenes[0]!.nodes[0]!.transform.opacity).toBe(
      1,
    );
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
    expect(result.document.project.scenes[0]!.nodes[0]!.timing).toEqual({
      start: 0.5,
      duration: 1.25,
    });
  });

  it("reorders scene nodes top-to-bottom via zIndex", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const scene = project.scenes[0]!;
    const nodes = [
      { ...scene.nodes[0]!, id: "n-top", zIndex: 2 },
      {
        ...scene.nodes[0]!,
        id: "n-mid",
        zIndex: 1,
        type: "shape" as const,
        payload: { shape: "rect" as const, width: 10, height: 10 },
      },
      {
        ...scene.nodes[0]!,
        id: "n-bot",
        zIndex: 0,
        type: "shape" as const,
        payload: { shape: "rect" as const, width: 10, height: 10 },
      },
    ];
    const doc: TimelineDocument = {
      project: {
        ...project,
        scenes: [{ ...scene, nodes }],
      },
      clips,
      lanes,
    };
    const result = executePropertyCommand(doc, {
      type: "reorder-scene-nodes",
      sceneId: scene.id,
      nodeIds: ["n-mid", "n-top", "n-bot"],
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const next = result.document.project.scenes[0]!.nodes;
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
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.name).toBe("Hero");
    expect(node.transform.visible).toBe(false);
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
    const prop = getPropertyDefinition("transform.x")!;
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
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.transform.scaleX).toBe(2.5);
    expect(node.transform.scaleY).toBe(2.5);
  });

  it("sets fill/stroke style on text nodes", () => {
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
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.type).toBe("text");
    if (node.type !== "text") return;
    expect(node.style?.fill).toBe("#ff0000");
    expect(node.style?.stroke).toBe("#00ff00");
    expect(node.style?.strokeWidth).toBe(2);
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
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.type).toBe("text");
    if (node.type !== "text") return;
    expect(getTextPayloadPlain(node.payload)).toBe("Hello");
    expect(node.payload.fontSize).toBe(42);
    expect(node.payload.align).toBe("center");
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
    const track = result.document.project.timeline.audioTracks.find(
      (t) => t.id === "audio.a",
    );
    expect(track?.volume).toBe(0.4);
    expect(track?.fadeIn).toBe(0.2);
    expect(track?.fadeOut).toBe(0.5);
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
    expect(withEffect.document.project.scenes[0]!.nodes[0]!.effects?.[0]).toEqual(
      { id: "fx.blur", type: "blur", radius: 8 },
    );

    const withKey = executePropertyCommand(withEffect.document, {
      type: "set-property-keyframe",
      targets,
      property: "transform.x",
      t: 0.5,
      v: 200,
      easing: "easeOut",
    });
    expect(withKey.status).toBe("applied");
    if (withKey.status !== "applied") return;
    const sceneClips = withKey.document.project.scenes[0]!.clips;
    expect(sceneClips.length).toBeGreaterThan(0);
    const trackClip = sceneClips.find((c) => c.source.kind === "tracks");
    expect(trackClip?.source.kind).toBe("tracks");
    if (trackClip?.source.kind !== "tracks") return;
    expect(trackClip.source.tracks[0]!.keys[0]).toMatchObject({
      t: 0.5,
      v: 200,
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
    const scene = project.scenes[0]!;
    const groupId = "node.group";
    const withGroup = {
      ...project,
      scenes: [
        {
          ...scene,
          nodes: [
            ...scene.nodes,
            {
              id: groupId,
              type: "group" as const,
              parentId: null,
              transform: { ...scene.nodes[0]!.transform },
            },
          ],
        },
      ],
    };
    const result = executePropertyCommand(
      { project: withGroup, clips, lanes },
      {
        type: "set-node-style",
        targets: [{ sceneId: scene.id, nodeId: groupId }],
        patch: { fill: "#fff" },
      },
    );
    expect(result.status).toBe("rejected");
  });

  it("clamps crop so x+width and y+height stay within 1", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    const scene = project.scenes[0]!;
    const imageId = "node.img";
    const assetId = project.assets[0]!.id;
    const withImage = {
      ...project,
      scenes: [
        {
          ...scene,
          nodes: [
            {
              id: imageId,
              type: "image" as const,
              parentId: null,
              transform: { ...scene.nodes[0]!.transform },
              payload: { assetId },
            },
          ],
        },
      ],
    };
    const injected = executePropertyCommand(
      { project: withImage, clips, lanes },
      {
        type: "set-node-media",
        targets: [{ sceneId: scene.id, nodeId: imageId }],
        patch: { crop: { x: 0.7, y: 0.8, width: 0.5, height: 0.5 } },
      },
    );
    expect(injected.status).toBe("applied");
    if (injected.status !== "applied") return;
    const node = injected.document.project.scenes[0]!.nodes.find(
      (n) => n.id === imageId,
    );
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
    const ids = (
      reordered.document.project.scenes[0]!.nodes[0]!.effects ?? []
    ).map((e) => e.id);
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
    const audioId = withAudio.project.timeline.audioTracks[0]!.id;
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
        property: "transform.x",
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
        property: "transform.x",
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
    const sceneClips = b.document.project.scenes[0]!.clips;
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
    const t = MOTION_V2_LIMITS.mediaDurationSeconds;
    const result = executePropertyCommand(doc, {
      type: "set-property-keyframe",
      targets,
      property: "transform.x",
      t,
      v: 42,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const kf = result.document.project.scenes[0]!.clips.find(
      (c) =>
        c.source.kind === "tracks" &&
        c.source.tracks.some((tr) => tr.property === "transform.x"),
    );
    expect(kf).toBeTruthy();
    expect(kf!.duration).toBeLessThanOrEqual(
      MOTION_V2_LIMITS.mediaDurationSeconds,
    );
    expect(() => parseMotionProjectV2(result.document.project)).not.toThrow();
  });
});

describe("history coalesce", () => {
  it("replaceOrPushHistory keeps a single scrub entry", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const before: TimelineDocument = { project, clips, lanes };
    let after: TimelineDocument = {
      project: {
        ...project,
        scenes: project.scenes.map((s, i) =>
          i === 0
            ? {
                ...s,
                nodes: s.nodes.map((n, j) =>
                  j === 0
                    ? { ...n, transform: { ...n.transform, x: 10 } }
                    : n,
                ),
              }
            : s,
        ),
      },
      clips,
      lanes,
    };

    let state = createHistoryState();
    const entry1: HistoryEntry = {
      id: "h1",
      timestamp: 1,
      label: "transform.x",
      coalesceKey: "scrub:transform.x:clip1",
      before,
      after,
    };
    state = replaceOrPushHistory(state, entry1, {
      coalesceKey: entry1.coalesceKey,
    });

    after = {
      ...after,
      project: {
        ...after.project,
        scenes: after.project.scenes.map((s, i) =>
          i === 0
            ? {
                ...s,
                nodes: s.nodes.map((n, j) =>
                  j === 0
                    ? { ...n, transform: { ...n.transform, x: 50 } }
                    : n,
                ),
              }
            : s,
        ),
      },
    };
    const entry2: HistoryEntry = {
      id: "h2",
      timestamp: 2,
      label: "transform.x",
      coalesceKey: "scrub:transform.x:clip1",
      before: after,
      after,
    };
    state = replaceOrPushHistory(state, entry2, {
      coalesceKey: entry2.coalesceKey,
    });

    expect(state.past).toHaveLength(1);
    expect(state.past[0]!.before).toBe(before);
    expect(state.past[0]!.after.project.scenes[0]!.nodes[0]!.transform.x).toBe(
      50,
    );
  });
});
