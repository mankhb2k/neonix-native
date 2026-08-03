import { describe, expect, it } from "vitest";
import {
  ensurePlayheadScrubScroll,
  scrollTracksHorizontallyNearEdge,
} from "./timeline-seek";

function stubScrollEl(init: {
  left: number;
  width: number;
  scrollWidth: number;
  clientWidth: number;
  top?: number;
}) {
  const el = document.createElement("div");
  let scrollLeft = init.left;
  Object.defineProperty(el, "scrollLeft", {
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  Object.defineProperty(el, "scrollWidth", { value: init.scrollWidth });
  Object.defineProperty(el, "clientWidth", { value: init.clientWidth });
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      right: init.width,
      top: init.top ?? 0,
      bottom: 200,
      width: init.width,
      height: 200,
      x: 0,
      y: init.top ?? 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  return el;
}

describe("playhead scrub horizontal auto-scroll", () => {
  it("increases scrollLeft when pointer is in the right edge", () => {
    const el = stubScrollEl({
      left: 0,
      width: 400,
      scrollWidth: 2000,
      clientWidth: 400,
    });
    const delta = scrollTracksHorizontallyNearEdge(el, 390, 40, 14);
    expect(delta).toBe(14);
    expect(el.scrollLeft).toBe(14);
  });

  it("does not scroll when pointer is in the middle", () => {
    const el = stubScrollEl({
      left: 100,
      width: 400,
      scrollWidth: 2000,
      clientWidth: 400,
    });
    const delta = scrollTracksHorizontallyNearEdge(el, 200, 40, 14);
    expect(delta).toBe(0);
    expect(el.scrollLeft).toBe(100);
  });

  it("clamps at max scroll / content end", () => {
    const el = stubScrollEl({
      left: 1590,
      width: 400,
      scrollWidth: 2000,
      clientWidth: 400,
    });
    const delta = scrollTracksHorizontallyNearEdge(el, 390, 40, 14);
    expect(el.scrollLeft).toBe(1600);
    expect(delta).toBe(10);
  });

  it("ensurePlayheadScrubScroll advances time with scroll", () => {
    const el = stubScrollEl({
      left: 0,
      width: 400,
      scrollWidth: 2000,
      clientWidth: 400,
    });
    const pps = 100;
    const before = ensurePlayheadScrubScroll(el, 200, pps, 30);
    expect(before.scrolledBy).toBe(0);
    const edge = ensurePlayheadScrubScroll(el, 390, pps, 30);
    expect(edge.scrolledBy).toBeGreaterThan(0);
    expect(edge.time).toBeGreaterThan(before.time);
    expect(edge.time).toBeLessThanOrEqual(30);
  });
});
