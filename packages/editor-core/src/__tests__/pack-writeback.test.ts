import { describe, expect, it } from "vitest";
import {
  parseMotionProjectV1,
  type MotionLayer,
} from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/patterns";
import { validateTimelineDocument } from "../document/document";
import { projectToTimelineDocument } from "../document/canonical-projection";
import {
  groupPathToTimelineClips,
  packRootLayersToTimeline,
} from "../timeline/selectors/scene-order-clips";
import { rebuildMainProject } from "../timeline/internal/timeline-project-sync";
import { executeTimelineCommand } from "../timeline/commands/command-runner";
import { selectionClips } from "../selection/editor-selection";

const ATOMS = visualLayerAtoms({ width: 1920, height: 1080 });

const VIDEO_ASSET = {
  id: "asset.video",
  uri: "./clip.mp4",
  assetType: "video" as const,
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  duration: 12,
  fps: 30,
};

const AUDIO_A = {
  id: "asset.audio.a",
  uri: "./a.mp3",
  assetType: "audio" as const,
  mimeType: "audio/mpeg",
  duration: 8,
};
const AUDIO_B = {
  id: "asset.audio.b",
  uri: "./b.mp3",
  assetType: "audio" as const,
  mimeType: "audio/mpeg",
  duration: 8,
};

function videoLayer(
  id: string,
  opts: { z: number; start: number; duration: number; name?: string },
): MotionLayer {
  return {
    id,
    type: "video",
    parentLayerId: null,
    zIndex: opts.z,
    timing: { start: opts.start, duration: opts.duration },
    ...ATOMS,
    payload: { assetId: VIDEO_ASSET.id, trimStart: 0 },
  } as MotionLayer;
}

function groupLayer(
  id: string,
  opts: { z: number; start: number; duration: number; name?: string },
  children: MotionLayer[],
): MotionLayer {
  return {
    id,
    type: "group",
    parentLayerId: null,
    zIndex: opts.z,
    timing: { start: opts.start, duration: opts.duration },
    ...ATOMS,
    children,
  } as MotionLayer;
}

function textChild(
  parentId: string,
  id: string,
  opts: { z: number; start: number; duration: number; text: string },
): MotionLayer {
  return {
    id,
    type: "text",
    parentLayerId: parentId,
    zIndex: opts.z,
    timing: { start: opts.start, duration: opts.duration },
    ...visualLayerAtoms({ width: 200, height: 40 }),
    payload: {
      text: opts.text,
      fontSize: 24,
      color: "#111111",
      alignment: "left",
    },
  } as MotionLayer;
}

function audioLayer(
  id: string,
  opts: { z: number; start: number; duration: number; assetId: string },
): MotionLayer {
  return {
    id,
    type: "audio",
    parentLayerId: null,
    zIndex: opts.z,
    timing: { start: opts.start, duration: opts.duration },
    payload: {
      assetId: opts.assetId,
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

function projectWith(layers: MotionLayer[], assets: unknown[] = [VIDEO_ASSET]) {
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "pack-test", name: "Pack test", locale: "vi-VN" },
    composition: { width: 1920, height: 1080, fps: 30 },
    assets,
    components: [],
    layers,
  });
}

describe("packRootLayersToTimeline", () => {
  it("packs sequential video + group onto Main", () => {
    const hero = groupLayer(
      "hero",
      { z: 1, start: 4, duration: 4, name: "Hero" },
      [
        textChild("hero", "hero.title", {
          z: 0,
          start: 0,
          duration: 4,
          text: "Title",
        }),
      ],
    );
    const project = projectWith([
      videoLayer("video-a", { z: 0, start: 0, duration: 4, name: "Video A" }),
      hero,
    ]);
    const { lanes, clips } = packRootLayersToTimeline(project);
    const visualClips = clips.filter((c) => c.kind === "scene");
    expect(visualClips).toHaveLength(2);
    expect(visualClips.every((c) => c.laneId === "lane.main")).toBe(true);
    expect(lanes.filter((l) => l.role === "overlay")).toHaveLength(0);
    expect(clips.map((c) => c.id).sort()).toEqual(["hero", "video-a"]);
  });

  it("opens a new overlay when roots overlap in time", () => {
    const project = projectWith([
      videoLayer("video-a", { z: 0, start: 0, duration: 4 }),
      videoLayer("title", { z: 1, start: 1, duration: 2, name: "Title" }),
    ]);
    const { clips } = packRootLayersToTimeline(project);
    const a = clips.find((c) => c.id === "video-a");
    const title = clips.find((c) => c.id === "title");
    expect(a?.laneId).toBe("lane.main");
    expect(title?.laneId).toBe("lane.overlay.0");
  });

  it("assigns overlapping audio to separate lanes", () => {
    const project = projectWith(
      [
        videoLayer("video-a", { z: 0, start: 0, duration: 8 }),
        audioLayer("music", {
          z: -1,
          start: 0,
          duration: 8,
          assetId: AUDIO_A.id,
        }),
        audioLayer("vo", { z: -2, start: 1, duration: 3, assetId: AUDIO_B.id }),
      ],
      [VIDEO_ASSET, AUDIO_A, AUDIO_B],
    );
    const { clips } = packRootLayersToTimeline(project);
    const music = clips.find((c) => c.id === "music");
    const vo = clips.find((c) => c.id === "vo");
    expect(music?.laneId).toBe("lane.audio");
    expect(vo?.laneId).toBe("lane.audio.1");
  });
});

describe("rebuildMainProject unique zIndex", () => {
  it("write-back of packed Main parses as MotionProjectV1", () => {
    const hero = groupLayer(
      "hero",
      { z: 1, start: 4, duration: 4, name: "Hero" },
      [
        textChild("hero", "hero.title", {
          z: 0,
          start: 0,
          duration: 4,
          text: "Title",
        }),
      ],
    );
    const project = projectWith([
      videoLayer("video-a", { z: 0, start: 0, duration: 4, name: "Video A" }),
      hero,
    ]);
    const packed = packRootLayersToTimeline(project);
    const rebuilt = rebuildMainProject(project, packed.clips, packed.lanes);
    expect(() => parseMotionProjectV1(rebuilt)).not.toThrow();
    const visualZ = rebuilt.layers
      .filter((l) => l.type !== "audio")
      .map((l) => l.zIndex);
    expect(new Set(visualZ).size).toBe(visualZ.length);
    expect(packed.clips.every((c) => c.laneId === "lane.main")).toBe(true);
  });

  it("never copies one zIndex onto a whole packed lane", () => {
    const project = projectWith([
      videoLayer("a", { z: 0, start: 0, duration: 2 }),
      videoLayer("b", { z: 1, start: 2, duration: 2 }),
    ]);
    const packed = packRootLayersToTimeline(project);
    expect(packed.clips.every((c) => c.laneId === "lane.main")).toBe(true);
    const rebuilt = rebuildMainProject(project, packed.clips, packed.lanes);
    const byId = Object.fromEntries(
      rebuilt.layers.map((l) => [l.id, l.zIndex]),
    );
    // Canva: rightmost on Main is 0, increase toward the left.
    expect(byId.b).toBe(0);
    expect(byId.a).toBe(1);
    expect(new Set(Object.values(byId)).size).toBe(2);
  });

  it("assigns a continuous unique zIndex: right-to-left then up", () => {
    const project = projectWith([
      videoLayer("a", { z: 0, start: 0, duration: 2 }),
      videoLayer("b", { z: 1, start: 2, duration: 2 }),
      videoLayer("c", { z: 2, start: 4, duration: 2 }),
      videoLayer("d", { z: 3, start: 1, duration: 2 }),
      videoLayer("e", { z: 4, start: 3, duration: 2 }),
    ]);
    const packed = packRootLayersToTimeline(project);
    const rebuilt = rebuildMainProject(project, packed.clips, packed.lanes);
    expect(() => parseMotionProjectV1(rebuilt)).not.toThrow();
    const z = Object.fromEntries(
      rebuilt.layers.map((layer) => [layer.id, layer.zIndex]),
    );
    expect(packed.clips.find((c) => c.id === "a")?.laneId).toBe("lane.main");
    expect(packed.clips.find((c) => c.id === "b")?.laneId).toBe("lane.main");
    expect(packed.clips.find((c) => c.id === "c")?.laneId).toBe("lane.main");
    expect(packed.clips.find((c) => c.id === "d")?.laneId).toBe(
      "lane.overlay.0",
    );
    expect(packed.clips.find((c) => c.id === "e")?.laneId).toBe(
      "lane.overlay.0",
    );
    // Main 2|1|0, overlay 4|3 — no duplicates.
    expect(z).toMatchObject({ c: 0, b: 1, a: 2, e: 3, d: 4 });
    const visualZ = rebuilt.layers.map((l) => l.zIndex);
    expect(new Set(visualZ).size).toBe(visualZ.length);
  });

  it("keeps audio zIndex unique and negative", () => {
    const project = projectWith(
      [
        videoLayer("video-a", { z: 0, start: 0, duration: 8 }),
        audioLayer("music", {
          z: -1,
          start: 0,
          duration: 8,
          assetId: AUDIO_A.id,
        }),
        audioLayer("vo", { z: -2, start: 8, duration: 2, assetId: AUDIO_B.id }),
      ],
      [VIDEO_ASSET, AUDIO_A, AUDIO_B],
    );
    // Sequential audio share a lane; write-back must still uniquify zIndex.
    const packed = packRootLayersToTimeline(project);
    const rebuilt = rebuildMainProject(project, packed.clips, packed.lanes);
    expect(() => parseMotionProjectV1(rebuilt)).not.toThrow();
    const audioZ = rebuilt.layers
      .filter((l) => l.type === "audio")
      .map((l) => l.zIndex);
    expect(audioZ.every((z) => z < 0)).toBe(true);
    expect(new Set(audioZ).size).toBe(audioZ.length);
  });
});

describe("groupPathToTimelineClips", () => {
  it("shows one row per direct child and no audio", () => {
    const hero = groupLayer(
      "hero",
      { z: 1, start: 4, duration: 4, name: "Hero" },
      [
        textChild("hero", "hero.title", {
          z: 0,
          start: 0,
          duration: 4,
          text: "Title",
        }),
        textChild("hero", "hero.sub", {
          z: 1,
          start: 1,
          duration: 2,
          text: "Sub",
        }),
      ],
    );
    const project = projectWith(
      [
        videoLayer("video-a", { z: 0, start: 0, duration: 4 }),
        hero,
        audioLayer("music", {
          z: -1,
          start: 0,
          duration: 8,
          assetId: AUDIO_A.id,
        }),
      ],
      [VIDEO_ASSET, AUDIO_A],
    );
    const surface = groupPathToTimelineClips(project, ["hero"]);
    expect(surface.clips).toHaveLength(2);
    expect(surface.clips.every((c) => c.kind === "scene")).toBe(true);
    expect(surface.clips.map((c) => c.laneId).sort()).toEqual([
      "lane.main",
      "lane.overlay.0",
    ]);
    expect(surface.clips.find((c) => c.id === "hero.title")?.startTime).toBe(4);
    expect(surface.clips.find((c) => c.id === "hero.sub")?.startTime).toBe(5);
    expect(surface.lanes.some((l) => l.kind === "audio")).toBe(false);
    expect(validateTimelineDocument({ project, ...surface }).valid).toBe(true);
  });

  it("writes nested local timing on trim inside a group", () => {
    const hero = groupLayer(
      "hero",
      { z: 0, start: 4, duration: 4, name: "Hero" },
      [
        textChild("hero", "hero.title", {
          z: 0,
          start: 0,
          duration: 4,
          text: "Title",
        }),
      ],
    );
    const project = projectWith([hero]);
    const surface = groupPathToTimelineClips(project, ["hero"]);
    const doc = projectToTimelineDocument(project, undefined, ["hero"]);
    const result = executeTimelineCommand(
      doc,
      {
        type: "clip/trim",
        clipId: "hero.title",
        startTime: 5,
        duration: 2,
      },
      selectionClips(["hero.title"]),
    );
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const child = result.document.project.layers[0];
    expect(child?.type).toBe("group");
    if (child?.type !== "group") return;
    expect(child.children[0]?.timing).toEqual({ start: 1, duration: 2 });
    expect(() => parseMotionProjectV1(result.document.project)).not.toThrow();
    expect(surface.timeOffset).toBe(4);
  });
});
