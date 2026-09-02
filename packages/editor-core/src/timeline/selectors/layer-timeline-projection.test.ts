import { describe, expect, it } from "vitest";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { projectLayersToTimeline } from "./layer-timeline-projection";

const TRANSFORM = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

function fixture(): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: "timeline-projection",
    assets: [
      {
        id: "score",
        kind: "audio",
        uri: "/score.mp3",
        mimeType: "audio/mpeg",
      },
    ],
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#000000",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    layers: [
      {
        id: "main",
        type: "shape",
        parentLayerId: null,
        order: 0,
        frame: { width: 1920, height: 1080 },
        transform: TRANSFORM,
        opacity: 1,
        timing: { start: 0, duration: 60000 },
        payload: { shape: "rectangle" },
        style: { fill: "#111111" },
      },
      {
        id: "title",
        type: "shape",
        parentLayerId: null,
        order: 2,
        frame: { width: 800, height: 200 },
        transform: TRANSFORM,
        opacity: 1,
        timing: { start: 10000, duration: 8000 },
        payload: { shape: "rectangle" },
        style: { fill: "#aa0000" },
      },
    ],
    audio: {
      sampleRate: 48000,
      tracks: [
        {
          id: "music",
          gainDb: -8,
          pan: 0,
          muted: false,
          clips: [
            {
              id: "score-clip",
              assetId: "score",
              timing: { start: 0, duration: 60000 },
              trim: { start: 0, end: 60000 },
              playbackRate: 1,
              gainDb: 0,
            },
          ],
        },
      ],
    },
  };
}

describe("Protocol V2 layer timeline projection", () => {
  it("keeps visual paint order while audio lanes are below root lanes", () => {
    const projection = projectLayersToTimeline(fixture());

    expect(projection.lanes.map((lane) => [lane.kind, lane.order])).toEqual([
      ["visual", 2],
      ["visual", 0],
      ["audio", -1],
    ]);
    expect(projection.lanes[1]).toMatchObject({
      id: "lane.main",
      role: "base",
      order: 0,
    });
  });

  it("projects track mute onto audio clips for unambiguous timeline chrome", () => {
    const project = fixture();
    project.audio.tracks[0]!.muted = true;

    const clip = projectLayersToTimeline(project).clips.find(
      (item) => item.kind === "audio",
    );
    expect(clip).toMatchObject({
      kind: "audio",
      audioTrackId: "music",
      muted: true,
    });
  });

  it("keeps every non-main root order on its own overlay lane", () => {
    const project = fixture();
    project.layers = [
      {
        ...project.layers[0]!,
        id: "layer-0",
        timing: { start: 0, duration: 5000 },
      },
      {
        ...project.layers[1]!,
        id: "layer-1",
        order: 1,
        timing: { start: 5000, duration: 5000 },
      },
      {
        ...project.layers[1]!,
        id: "layer-2",
        order: 2,
        timing: { start: 10000, duration: 5000 },
      },
      {
        ...project.layers[1]!,
        id: "layer-3",
        order: 3,
        timing: { start: 0, duration: 5000 },
      },
    ];

    const projection = projectLayersToTimeline(project);
    const laneFor = (id: string) =>
      projection.clips.find((clip) => clip.id === id)?.laneId;

    expect(laneFor("layer-0")).toBe("lane.main");
    expect(laneFor("layer-1")).toBe("lane.visual.layer-1");
    expect(laneFor("layer-2")).toBe("lane.visual.layer-2");
    expect(laneFor("layer-3")).toBe("lane.visual.layer-3");
  });

  it("derives clips and duration without mutating the V2 document", () => {
    const project = fixture();
    const before = JSON.stringify(project);
    const projection = projectLayersToTimeline(project);

    expect(projection.clips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "main", startTime: 0, duration: 60 }),
        expect.objectContaining({ id: "title", startTime: 10, duration: 8 }),
        expect.objectContaining({
          id: "audio.score-clip",
          kind: "audio",
          startTime: 0,
          duration: 60,
        }),
      ]),
    );
    expect(projection.duration).toBe(60);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("keeps embedded video audio collapsed into the video lane", () => {
    const project = fixture();
    project.assets.push({
      id: "video",
      kind: "video",
      uri: "/video.mp4",
      mimeType: "video/mp4",
      duration: 20000,
      fps: 30,
    });
    project.layers.push({
      id: "video-layer",
      type: "video",
      parentLayerId: null,
      order: 3,
      frame: { width: 1920, height: 1080 },
      transform: TRANSFORM,
      opacity: 1,
      timing: { start: 4000, duration: 8000 },
      payload: {
        assetId: "video",
        trimStart: 2000,
        trimEnd: 10000,
        audio: { enabled: true, gainDb: -3 },
      },
    });

    const projection = projectLayersToTimeline(project, {
      assetPreviews: new Map([
        ["video", { url: "https://signed.example/poster.webp", status: "ready" as const }],
      ]),
    });
    const videoClip = projection.clips.find((clip) => clip.id === "video-layer");
    expect(videoClip).toMatchObject({
      kind: "scene",
      mediaType: "video",
      muted: false,
      posterUrl: "https://signed.example/poster.webp",
      posterStatus: "ready",
      startTime: 4,
      duration: 8,
    });
    expect(projection.clips.filter((clip) => clip.kind === "audio")).toHaveLength(1);
    expect(projection.lanes.filter((lane) => lane.kind === "audio")).toHaveLength(1);
  });

  it("does not expose audio controls for a video without an audio component", () => {
    const project = fixture();
    project.assets.push({
      id: "silent-video",
      kind: "video",
      uri: "/silent-video.mp4",
      mimeType: "video/mp4",
      duration: 10000,
      fps: 30,
    });
    project.layers.push({
      id: "silent-video-layer",
      type: "video",
      parentLayerId: null,
      order: 3,
      frame: { width: 1920, height: 1080 },
      transform: TRANSFORM,
      opacity: 1,
      timing: { start: 0, duration: 10000 },
      payload: { assetId: "silent-video" },
    });

    const clip = projectLayersToTimeline(project).clips.find((item) => item.id === "silent-video-layer");
    expect(clip).toMatchObject({ muted: false, embeddedAudio: false });
  });
});
