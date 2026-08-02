import { describe, expect, it } from "vitest";
import { createPlaybackClockStore } from "./playback-clock-store";
import { createPlaybackDriver } from "./playback-driver";
import {
  buildVisualLaneIndex,
  composeAtTime,
} from "../preview/compose-layers";
import { previewParitySnapshot } from "../preview/preview-evaluate";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { parseMotionProject } from "@motionvideo/motion-schema";
import { DEFAULT_VISUAL_POLICY } from "@motionvideo/editor-core";

describe("playback driver", () => {
  it("play → tick → seek → continues from seek time", () => {
    const clock = createPlaybackClockStore();
    clock.getState().reset({ duration: 30, currentTime: 0 });

    let fakeNow = 0;
    const queue: Array<(t: number) => void> = [];
    let nextId = 1;
    const pending = new Map<number, (t: number) => void>();

    const driver = createPlaybackDriver({
      clock,
      now: () => fakeNow,
      requestFrame: (cb) => {
        const id = nextId++;
        pending.set(id, cb);
        queue.push(cb);
        return id;
      },
      cancelFrame: (id) => {
        pending.delete(id);
      },
    });

    clock.getState().play();
    expect(clock.getState().mode).toBe("playing");

    const flushOne = () => {
      const cb = queue.shift();
      if (!cb) return;
      for (const [id, fn] of pending) {
        if (fn === cb) pending.delete(id);
      }
      cb(fakeNow);
    };

    fakeNow = 1000;
    flushOne();
    expect(clock.getState().currentTime).toBeGreaterThan(0);

    clock.getState().seek(10);
    fakeNow = 2000;
    flushOne();
    expect(clock.getState().currentTime).toBeGreaterThanOrEqual(10);

    driver.dispose();
    expect(clock.getState().mode).toBe("playing");
    clock.getState().pause();
  });

  it("pauses at end of duration", () => {
    const clock = createPlaybackClockStore();
    clock.getState().reset({ duration: 2, currentTime: 0 });

    let fakeNow = 0;
    const queue: Array<(t: number) => void> = [];
    let nextId = 1;
    const pending = new Map<number, (t: number) => void>();

    const driver = createPlaybackDriver({
      clock,
      now: () => fakeNow,
      requestFrame: (cb) => {
        const id = nextId++;
        pending.set(id, cb);
        queue.push(cb);
        return id;
      },
      cancelFrame: (id) => {
        pending.delete(id);
      },
    });

    clock.getState().play();
    fakeNow = 5000;
    const cb = queue.shift();
    expect(cb).toBeTypeOf("function");
    cb?.(fakeNow);

    expect(clock.getState().currentTime).toBe(2);
    expect(clock.getState().mode).toBe("idle");
    driver.dispose();
  });

  it("dispose unsubscribes without leaking play starts", () => {
    const clock = createPlaybackClockStore();
    clock.getState().reset({ duration: 10, currentTime: 0 });
    let frames = 0;
    const driver = createPlaybackDriver({
      clock,
      now: () => 0,
      requestFrame: (cb) => {
        frames += 1;
        cb(0);
        return frames;
      },
      cancelFrame: () => undefined,
    });
    driver.dispose();
    clock.getState().play();
    expect(frames).toBe(0);
  });
});

describe("compose + evaluate smoke", () => {
  it("composes a scene clip layer and evaluates nodes", () => {
    const project = parseMotionProject({
      format: "motion-project",
      formatVersion: 2,
      metadata: {
        id: "proj_test",
        name: "Test",
        aspectRatio: "16:9",
        fps: 30,
        locale: "vi-VN",
        brand: {
          name: "Test",
          primaryColor: "#1A5D3A",
          fontFamily: "Be Vietnam Pro",
        },
      },
      dependencies: { components: [] },
      assets: [],
      variables: [],
      timeline: { sceneOrder: ["scene_1"], audioTracks: [] },
      scenes: [
        {
          id: "scene_1",
          name: "Scene",
          duration: 3,
          nodes: [
            {
              id: "node_1",
              type: "text",
              parentId: null,
              zIndex: 0,
              transform: {
                x: 100,
                y: 100,
                width: 400,
                height: 80,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                anchorX: 0.5,
                anchorY: 0.5,
                opacity: 1,
                visible: true,
                flipX: false,
                flipY: false,
              },
              payload: {
                text: "Hello",
                fontSize: 64,
                fontWeight: 600,
                align: "center",
              },
            },
          ],
          clips: [],
        },
      ],
      bindings: [],
      extensions: { constraints: [], events: [] },
    });

    const lanes = [
      {
        id: "lane_base",
        kind: "visual" as const,
        role: "base" as const,
        name: "Main",
        order: -1,
        policy: { ...DEFAULT_VISUAL_POLICY },
      },
    ];
    const clips = [
      {
        id: "clip_1",
        kind: "scene" as const,
        sceneId: "scene_1",
        laneId: "lane_base",
        startTime: 0,
        duration: 3,
        name: "A",
      },
    ];

    const index = buildVisualLaneIndex(clips, lanes);
    const layers = composeAtTime(index, 0.5);
    expect(layers).toHaveLength(1);
    expect(layers[0]?.sceneId).toBe("scene_1");

    const compiled = compileMotionProject(project);
    const snapshot = previewParitySnapshot(compiled, "scene_1", 0.5);
    expect(snapshot.nodes.length).toBeGreaterThan(0);
    expect(snapshot.nodes.some((n) => n.type === "text")).toBe(true);
  });
});
