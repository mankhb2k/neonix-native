import { describe, expect, it, vi } from "vitest";
import {
  TimelineGeometry,
  PointerSessionController,
  createClipMoveSessionState,
  updateClipMoveSessionState,
  buildClipMovePatch,
  createLibraryDropSessionState,
  updateLibraryDropSessionState,
  buildPlacementTarget,
  createMarqueeSessionState,
  updateMarqueeSessionState,
} from "@/lib/editor/timeline";

describe("TimelineGeometry Engine", () => {
  it("converts time to pixels and pixels to time accurately", () => {
    const geo = new TimelineGeometry({
      pixelsPerSecond: 100,
      scrollLeft: 50,
      scrollTop: 0,
      containerWidth: 1000,
      containerHeight: 400,
      laneRects: [
        { laneId: "base", top: 0, height: 60, order: -1, kind: "visual", role: "base" },
        { laneId: "ov.0", top: 60, height: 44, order: 0, kind: "visual", role: "overlay" },
      ],
    });

    expect(geo.timeToPixel(2)).toBe(150); // 2 * 100 - 50
    expect(geo.pixelToTime(150)).toBe(2); // (150 + 50) / 100
  });

  it("hit-tests lanes correctly based on Y offset", () => {
    const geo = new TimelineGeometry({
      pixelsPerSecond: 100,
      scrollLeft: 0,
      scrollTop: 10,
      containerWidth: 1000,
      containerHeight: 400,
      laneRects: [
        { laneId: "base", top: 0, height: 60, order: -1, kind: "visual", role: "base" },
        { laneId: "ov.0", top: 60, height: 44, order: 0, kind: "visual", role: "overlay" },
      ],
    });

    const hitBase = geo.hitTestLane(20); // 20 + 10 = 30 -> base
    expect(hitBase?.laneId).toBe("base");

    const hitOverlay = geo.hitTestLane(60); // 60 + 10 = 70 -> ov.0
    expect(hitOverlay?.laneId).toBe("ov.0");
  });

  it("maps client X to time and reports visible range with overscan", () => {
    const geo = new TimelineGeometry({
      pixelsPerSecond: 100,
      scrollLeft: 200,
      scrollTop: 0,
      containerWidth: 400,
      containerHeight: 300,
      laneRects: [],
      contentOriginClientX: 100,
      overscanPx: 120,
    });
    expect(geo.clientPointToTime(100)).toBe(2);
    expect(geo.visibleTimeRange()).toEqual({
      start: 0.8,
      end: 7.2,
    });
  });

  it("filters hitTestLane by family when provided", () => {
    const geo = new TimelineGeometry({
      pixelsPerSecond: 100,
      scrollLeft: 0,
      scrollTop: 0,
      containerWidth: 1000,
      containerHeight: 400,
      laneRects: [
        {
          laneId: "base",
          top: 0,
          height: 60,
          order: -1,
          kind: "visual",
          role: "base",
        },
        {
          laneId: "au0",
          top: 0,
          height: 60,
          order: 0,
          kind: "audio",
          role: "audio",
        },
      ],
    });
    expect(geo.hitTestLane(30, "audio")?.laneId).toBe("au0");
    expect(geo.hitTestLane(30, "visual")?.laneId).toBe("base");
  });
});

describe("PointerSessionController Lifecycle", () => {
  it("manages start, update, commit, and cancel lifecycle", () => {
    const onStart = vi.fn((pos) => ({ pos }));
    const onUpdate = vi.fn((pos, current) => ({ pos: current.pos, updated: pos }));
    const onCommit = vi.fn((state) => state);
    const onCancel = vi.fn();

    const controller = new PointerSessionController({
      name: "test-move",
      onStart,
      onUpdate,
      onCommit,
      onCancel,
    });

    expect(controller.isRunning).toBe(false);

    // Start
    const started = controller.start({ x: 10, y: 20 });
    expect(started).toBe(true);
    expect(controller.isRunning).toBe(true);
    expect(onStart).toHaveBeenCalledWith({ x: 10, y: 20 });

    // Update synchronously
    controller.update({ x: 30, y: 40 });
    expect(controller.currentSessionState).toBeDefined();

    // Commit
    const res = controller.commit();
    expect(res).toBeDefined();
    expect(controller.isRunning).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it("handles cancel and prevents concurrent sessions", () => {
    const onCancel = vi.fn();
    const c1 = new PointerSessionController({ name: "s1", onCancel });
    const c2 = new PointerSessionController({ name: "s2" });

    c1.start({ x: 0, y: 0 });
    expect(c1.isRunning).toBe(true);

    // Concurrent session blocked
    const started2 = c2.start({ x: 0, y: 0 });
    expect(started2).toBe(false);

    // Cancel c1
    c1.cancel();
    expect(c1.isRunning).toBe(false);
    expect(onCancel).toHaveBeenCalled();

    // Now c2 can start
    const started2Retry = c2.start({ x: 0, y: 0 });
    expect(started2Retry).toBe(true);
    c2.cancel();
  });
});

describe("Specialized Domain Sessions", () => {
  it("manages Clip Move Session state and builds ClipMovePatch", () => {
    let state = createClipMoveSessionState("clip.1", 0, "lane.main", "main");
    state = updateClipMoveSessionState(state, 5, "lane.overlay.0", "overlay", true, 0);

    const patch = buildClipMovePatch(state);
    expect(patch.startTime).toBe(5);
    expect(patch.track).toBe("overlay");
    expect(patch.laneId).toBe("lane.overlay.0");
    expect(patch.insertNewLane).toBe(true);
  });

  it("manages Library Drop Session state and builds PlacementTarget", () => {
    let state = createLibraryDropSessionState("frame", "f1", "Frame 1", 4);
    state = updateLibraryDropSessionState(state, 2.5, "lane.main", "main");

    const target = buildPlacementTarget(state);
    expect(target.startTime).toBe(2.5);
    expect(target.track).toBe("main");
  });

  it("manages Marquee Select Session box intersection", () => {
    let state = createMarqueeSessionState({ x: 10, y: 10 });
    const clipsWithRects = [
      {
        clip: { id: "c1", kind: "scene" as const, sceneId: "s1", laneId: "l1", startTime: 0, duration: 2, name: "C1" },
        rect: { left: 15, top: 15, width: 20, height: 20 },
      },
      {
        clip: { id: "c2", kind: "scene" as const, sceneId: "s2", laneId: "l1", startTime: 10, duration: 2, name: "C2" },
        rect: { left: 200, top: 200, width: 20, height: 20 },
      },
    ];

    state = updateMarqueeSessionState(state, { x: 50, y: 50 }, clipsWithRects);
    expect(state.selectedClipIds).toContain("c1");
    expect(state.selectedClipIds).not.toContain("c2");
  });
});
