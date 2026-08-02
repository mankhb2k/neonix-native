import { afterEach, describe, expect, it } from "vitest";
import { resolveTimelineDropGeometry } from "./drop-geometry";
import {
  getTimelineDropHost,
  resolveDropGeometryAtPoint,
  resolveLibraryPlacement,
  setTimelineDropHost,
} from "./library-drop";
import type { LibraryPayload } from "../../library/model/library-payload";

const BASE_POLICY = {
  allowOverlap: false as const,
  rippleMode: true as const,
};

function mountScrollWithLanes(
  lanes: Array<{
    id: string;
    type: "main" | "overlay" | "audio";
    order: number;
    top: number;
    height: number;
  }>,
): HTMLElement {
  const scrollEl = document.createElement("div");
  scrollEl.setAttribute("data-timeline-drop-zone", "true");
  scrollEl.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      right: 400,
      bottom: 240,
      width: 400,
      height: 240,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  Object.defineProperty(scrollEl, "scrollTop", {
    value: 0,
    writable: true,
  });
  Object.defineProperty(scrollEl, "scrollLeft", {
    value: 0,
    writable: true,
  });

  for (const lane of lanes) {
    const el = document.createElement("div");
    el.setAttribute("data-track-lane", "true");
    el.setAttribute("data-lane-id", lane.id);
    el.setAttribute("data-lane-order", String(lane.order));
    if (lane.type === "main") {
      el.setAttribute("data-track-type", "main");
      el.setAttribute("data-track-role", "base");
      el.setAttribute("data-track-family", "visual");
    } else if (lane.type === "overlay") {
      el.setAttribute("data-track-type", "overlay");
      el.setAttribute("data-track-role", "overlay");
      el.setAttribute("data-track-family", "visual");
    } else {
      el.setAttribute("data-track-type", "audio");
      el.setAttribute("data-track-role", "audio");
      el.setAttribute("data-track-family", "audio");
    }
    const top = lane.top;
    const height = lane.height;
    el.getBoundingClientRect = () =>
      ({
        top,
        left: 0,
        right: 400,
        bottom: top + height,
        width: 400,
        height,
        x: 0,
        y: top,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    scrollEl.appendChild(el);
  }

  document.body.appendChild(scrollEl);

  const orig = document.elementFromPoint.bind(document);
  document.elementFromPoint = () => scrollEl;
  (scrollEl as HTMLElement & { __restoreElementFromPoint?: () => void }).__restoreElementFromPoint =
    () => {
      document.elementFromPoint = orig;
    };

  return scrollEl;
}

describe("drop-host CapCut policy", () => {
  afterEach(() => {
    setTimelineDropHost(null);
    const scroll = document.body.querySelector(
      "[data-timeline-drop-zone]",
    ) as (HTMLElement & { __restoreElementFromPoint?: () => void }) | null;
    scroll?.__restoreElementFromPoint?.();
    document.body.replaceChildren();
  });

  it("stores and clears the active timeline host", () => {
    const scrollEl = mountScrollWithLanes([
      { id: "base", type: "main", order: -1, top: 0, height: 60 },
    ]);

    setTimelineDropHost({
      scrollEl,
      lanes: [
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });

    expect(getTimelineDropHost()?.lanes[0]?.id).toBe("base");

    const geo = resolveTimelineDropGeometry({
      clientX: 150,
      clientY: 10,
      scrollEl,
      lanes: [
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });
    expect(geo).toEqual({
      laneId: "base",
      startTime: 1.5,
      track: "main",
    });

    setTimelineDropHost(null);
    expect(getTimelineDropHost()).toBeNull();
  });

  it("drops audio on Main body as new audio lane (insertOrder)", () => {
    const scrollEl = mountScrollWithLanes([
      { id: "base", type: "main", order: -1, top: 0, height: 60 },
    ]);

    setTimelineDropHost({
      scrollEl,
      lanes: [
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 60,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });

    const audio: LibraryPayload = {
      kind: "audio",
      id: "a1",
      label: "BGM",
      assetId: "asset_bgm",
      duration: 4,
    };

    // Mid Main body → audio insert (never lands on Main).
    expect(resolveLibraryPlacement(50, 30, audio)).toEqual({
      track: "audio",
      insertNewLane: true,
      insertOrder: 0,
      startTime: 0.5,
    });

    const preview = resolveDropGeometryAtPoint(50, 30, audio);
    expect(preview?.isInsert).toBe(true);
    expect(preview?.track).toBe("audio");
    expect(preview?.ghostWidthPx).toBeGreaterThan(40);
  });

  it("drops text on Main body as overlay insert", () => {
    const scrollEl = mountScrollWithLanes([
      { id: "base", type: "main", order: -1, top: 0, height: 60 },
    ]);

    setTimelineDropHost({
      scrollEl,
      lanes: [
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 60,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });

    const text: LibraryPayload = {
      kind: "text",
      id: "t1",
      label: "Title",
      text: "Title",
      duration: 3,
    };

    // Mid body → overBaseBody main, but text remaps to overlay insert.
    expect(resolveLibraryPlacement(50, 30, text)).toEqual({
      track: "overlay",
      insertNewLane: true,
      insertOrder: 0,
      startTime: 0.5,
    });
  });

  it("keeps text on existing overlay lane body", () => {
    const scrollEl = mountScrollWithLanes([
      { id: "ov", type: "overlay", order: 0, top: 0, height: 48 },
      { id: "base", type: "main", order: -1, top: 50, height: 60 },
    ]);

    setTimelineDropHost({
      scrollEl,
      lanes: [
        {
          id: "ov",
          kind: "visual",
          role: "overlay",
          name: "Text",
          order: 0,
          policy: { allowOverlap: false, rippleMode: false },
        },
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 48,
      laneHeightFor: (lane) =>
        lane.kind === "visual" && lane.role === "base" ? 60 : 48,
      laneGapPx: 2,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });

    const text: LibraryPayload = {
      kind: "text",
      id: "t1",
      label: "Title",
      text: "Title",
    };

    // Center of overlay lane (away from 12px edges).
    expect(resolveLibraryPlacement(80, 24, text)).toEqual({
      track: "overlay",
      laneId: "ov",
      startTime: 0.8,
    });
  });

  it("inserts overlay lane near Main top edge (4px band)", () => {
    const scrollEl = mountScrollWithLanes([
      { id: "base", type: "main", order: -1, top: 40, height: 60 },
    ]);

    setTimelineDropHost({
      scrollEl,
      lanes: [
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 60,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });

    const video: LibraryPayload = {
      kind: "video",
      id: "v1",
      label: "Clip",
      assetId: "asset_v",
      duration: 2,
    };

    // Within 4px of Main top → overlay insert above.
    const placement = resolveLibraryPlacement(100, 42, video);
    expect(placement).toMatchObject({
      track: "overlay",
      insertNewLane: true,
      insertOrder: 0,
      startTime: 1,
    });

    const preview = resolveDropGeometryAtPoint(100, 42, video);
    expect(preview?.isInsert).toBe(true);
  });

  it("snaps library drop start/end to existing clip edges with guide time", () => {
    const scrollEl = mountScrollWithLanes([
      { id: "base", type: "main", order: -1, top: 0, height: 60 },
    ]);

    setTimelineDropHost({
      scrollEl,
      lanes: [
        {
          id: "base",
          kind: "visual",
          role: "base",
          name: "Main",
          order: -1,
          policy: BASE_POLICY,
        },
      ],
      lanesTop: 0,
      laneHeight: 60,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
      snapPoints: [2],
      snapThresholdSec: 0.1,
    });

    const video: LibraryPayload = {
      kind: "video",
      id: "v1",
      label: "Clip",
      assetId: "asset_v",
      duration: 2,
    };

    // Mid Main body; raw start ≈ 1.95 → snap start to 2.
    const preview = resolveDropGeometryAtPoint(195, 30, video);
    expect(preview?.startTime).toBe(2);
    expect(preview?.snapGuideTime).toBe(2);
    expect(resolveLibraryPlacement(195, 30, video)?.startTime).toBe(2);
  });
});
