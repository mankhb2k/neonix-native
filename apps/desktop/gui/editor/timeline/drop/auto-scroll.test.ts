import { afterEach, describe, expect, it } from "vitest";
import {
  autoScrollElementNearEdge,
  autoScrollTimelineNearEdge,
} from "./auto-scroll";
import {
  getTimelineDropHost,
  registerTimelineDropHost,
} from "./timeline-drop-host";

function stubScroll(init: {
  scrollTop: number;
  scrollLeft?: number;
  clientHeight?: number;
  scrollHeight?: number;
  clientWidth?: number;
  scrollWidth?: number;
  bottom?: number;
}) {
  const el = document.createElement("div");
  let scrollTop = init.scrollTop;
  let scrollLeft = init.scrollLeft ?? 0;
  Object.defineProperty(el, "scrollTop", {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
  });
  Object.defineProperty(el, "scrollLeft", {
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  Object.defineProperty(el, "clientHeight", {
    value: init.clientHeight ?? 200,
  });
  Object.defineProperty(el, "scrollHeight", {
    value: init.scrollHeight ?? 800,
  });
  Object.defineProperty(el, "clientWidth", {
    value: init.clientWidth ?? 400,
  });
  Object.defineProperty(el, "scrollWidth", {
    value: init.scrollWidth ?? 400,
  });
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 400,
      bottom: init.bottom ?? init.clientHeight ?? 200,
      width: 400,
      height: init.clientHeight ?? 200,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  return el;
}

describe("autoScrollElementNearEdge maxScrollTop", () => {
  afterEach(() => {
    const clear = registerTimelineDropHost({
      scrollEl: document.createElement("div"),
      lanes: [],
      lanesTop: 0,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 8,
    });
    clear();
  });

  it("does not scroll past maxScrollTop when dragging near the bottom edge", () => {
    const scrollEl = stubScroll({ scrollTop: 80, scrollHeight: 800 });
    autoScrollElementNearEdge(scrollEl, 200, 190, 40, 14, {
      maxScrollTop: 90,
    });
    expect(scrollEl.scrollTop).toBe(90);
    autoScrollElementNearEdge(scrollEl, 200, 190, 40, 14, {
      maxScrollTop: 90,
    });
    expect(scrollEl.scrollTop).toBe(90);
  });

  it("snaps back when already scrolled into bottom runway past the cap", () => {
    const scrollEl = stubScroll({ scrollTop: 400, scrollHeight: 800 });
    autoScrollElementNearEdge(scrollEl, 200, 100, 40, 14, {
      maxScrollTop: 150,
    });
    expect(scrollEl.scrollTop).toBe(150);
  });

  it("still scrolls down when below maxScrollTop", () => {
    const scrollEl = stubScroll({ scrollTop: 10, scrollHeight: 800 });
    autoScrollElementNearEdge(scrollEl, 200, 190, 40, 14, {
      maxScrollTop: 100,
    });
    expect(scrollEl.scrollTop).toBe(24);
  });

  it("scrolls down when the pointer is exactly on the bottom edge", () => {
    const scrollEl = stubScroll({ scrollTop: 10, scrollHeight: 800 });
    // rect.bottom = 200; pointer at bottom edge with edgePx=40
    autoScrollElementNearEdge(scrollEl, 200, 200, 40, 14, {
      maxScrollTop: 100,
    });
    expect(scrollEl.scrollTop).toBe(24);
  });

  it("host wrapper respects maxScrollTop", () => {
    const scrollEl = stubScroll({ scrollTop: 80, scrollHeight: 800 });
    const unregister = registerTimelineDropHost({
      scrollEl,
      lanes: [],
      lanesTop: 0,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 8,
    });
    expect(getTimelineDropHost()?.scrollEl).toBe(scrollEl);
    autoScrollTimelineNearEdge(200, 190, 40, 14, { maxScrollTop: 90 });
    expect(scrollEl.scrollTop).toBe(90);
    unregister();
  });
});

describe("autoScrollElementNearEdge scroll direction collision", () => {
  it("does not scroll in both directions when viewport is smaller than 2 * edgePx", () => {
    // clientHeight=50, edgePx=40. pointer at y=25 is near both top and bottom.
    // Near distance: top = 25, bottom = 25. Should pick bottom by default if equal, or pick one, but NOT BOTH.
    const scrollEl = stubScroll({ scrollTop: 100, clientHeight: 50, scrollHeight: 800 });
    autoScrollElementNearEdge(scrollEl, 200, 25, 40, 14, { maxScrollTop: 800 });
    // It should move either 14 up or 14 down, but not 0 (which happens if both ifs run)
    expect(scrollEl.scrollTop).not.toBe(100); 
    // Usually it will scroll down if equal or top if top is strictly closer
  });

  it("chooses the closer edge when near both edges simultaneously", () => {
    const scrollEl = stubScroll({ scrollTop: 100, clientHeight: 60, scrollHeight: 800 });
    // pointer at y=15. Dist to top: 15. Dist to bottom: 45. 
    // Both are <= 40 if edgePx is 40? Wait, dist to bottom is 60 - 15 = 45 > 40. Not near bottom.
    // Let's use edgePx=50.
    // y=20. Dist to top: 20. Dist to bottom: 40. Both <= 50. Top is closer.
    autoScrollElementNearEdge(scrollEl, 200, 20, 50, 14, { maxScrollTop: 800 });
    expect(scrollEl.scrollTop).toBe(86); // scrolled up by 14
    
    // y=40. Dist to top: 40. Dist to bottom: 20. Bottom is closer.
    autoScrollElementNearEdge(scrollEl, 200, 40, 50, 14, { maxScrollTop: 800 });
    expect(scrollEl.scrollTop).toBe(100); // scrolled down by 14 (86 + 14)
  });

  it("scrolls horizontally and vertically simultaneously", () => {
    const scrollEl = stubScroll({ scrollTop: 100, scrollLeft: 100, clientHeight: 200, clientWidth: 400, scrollHeight: 800, scrollWidth: 800 });
    // near top (y=10, edge=40) and near left (x=10, edge=40)
    autoScrollElementNearEdge(scrollEl, 10, 10, 40, 14, { maxScrollTop: 800 });
    expect(scrollEl.scrollTop).toBe(86); // up
    expect(scrollEl.scrollLeft).toBe(86); // left
  });

  it("scrolls up when the pointer is exactly on the top edge", () => {
    const scrollEl = stubScroll({ scrollTop: 100, scrollHeight: 800 });
    // rect.top = 0. Pointer at top boundary of edge band (y=40). 
    // dist to top is 40. Should scroll up.
    autoScrollElementNearEdge(scrollEl, 200, 40, 40, 14, { maxScrollTop: 800 });
    expect(scrollEl.scrollTop).toBe(86);
  });
});
