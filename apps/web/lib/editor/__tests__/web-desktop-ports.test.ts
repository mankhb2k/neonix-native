import { describe, expect, it } from "vitest";
import {
  playbackFrameIndex,
  playbackFrameTime,
} from "@motionvideo/editor-core";
import {
  resolvePlayheadScrubMax,
} from "@motionvideo/editor-core";
import {
  clientXToStripTime,
  scrollTracksHorizontallyNearEdge,
} from "@/lib/editor/interaction-host/timeline-dom";
import { seedWebEditorUi } from "@/lib/editor/fixtures/seed-editor-ui";

describe("playback time-frame (web port)", () => {
  it("maps time to frame index", () => {
    expect(playbackFrameIndex(0, 30)).toBe(0);
    expect(playbackFrameIndex(1, 30)).toBe(30);
    expect(playbackFrameTime(1.02, 30)).toBeCloseTo(1, 5);
  });
});

describe("timeline-seek strip (web port)", () => {
  it("maps clientX across strip width", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({
        left: 100,
        right: 500,
        width: 400,
        top: 0,
        bottom: 40,
        height: 40,
        x: 100,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    expect(clientXToStripTime(100, el, 10)).toBe(0);
    expect(clientXToStripTime(300, el, 10)).toBe(5);
    expect(clientXToStripTime(500, el, 10)).toBe(10);
  });

  it("resolvePlayheadScrubMax prefers shorter clock duration", () => {
    expect(resolvePlayheadScrubMax(100, 27)).toBe(27);
    expect(resolvePlayheadScrubMax(20, 0)).toBe(20);
  });

  it("scrolls near right edge", () => {
    const el = document.createElement("div");
    let scrollLeft = 0;
    Object.defineProperty(el, "scrollLeft", {
      get: () => scrollLeft,
      set: (v: number) => {
        scrollLeft = v;
      },
    });
    Object.defineProperty(el, "scrollWidth", { value: 2000 });
    Object.defineProperty(el, "clientWidth", { value: 400 });
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 400,
        width: 400,
        top: 0,
        bottom: 200,
        height: 200,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    const delta = scrollTracksHorizontallyNearEdge(el, 390, 40, 14);
    expect(delta).toBe(14);
    expect(el.scrollLeft).toBe(14);
  });
});

describe("seedWebEditorUi", () => {
  it("seeds facebook-history with scene clips", () => {
    const seed = seedWebEditorUi("facebook-history");
    expect(seed.kind).toBe("editor");
    expect(seed.snapshot.project.layers.length).toBe(6);
    expect(seed.snapshot.timelineClips.length).toBe(6);
  });

  it("seeds blank without scenes", () => {
    const seed = seedWebEditorUi("blank-16x9");
    expect(seed.snapshot.project.layers).toHaveLength(0);
  });
});
