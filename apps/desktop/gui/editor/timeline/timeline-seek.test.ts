/**
 * Logic tests live in @motionvideo/editor-interactions.
 * Keep this file as a smoke import so desktop CI still discovers a seek suite.
 */
export {
  resolvePlayheadScrubMax,
  clientXToTimelineTime,
} from "@motionvideo/editor-interactions";

import { describe, expect, it } from "vitest";
import {
  clientXToTimelineTime,
  ensurePlayheadScrubScroll,
  resolvePlayheadScrubMax,
  scrollTracksHorizontallyNearEdge,
} from "@motionvideo/editor-interactions";

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

describe("playhead scrub (compat HTMLElement API)", () => {
  it("still scrolls via deprecated wrappers", () => {
    const el = stubScrollEl({
      left: 0,
      width: 400,
      scrollWidth: 2000,
      clientWidth: 400,
    });
    expect(scrollTracksHorizontallyNearEdge(el, 390, 40, 14)).toBe(14);
    expect(resolvePlayheadScrubMax(20, 12)).toBe(12);
    expect(clientXToTimelineTime(-50, el, 100, 6, 2)).toBe(2);
    const edge = ensurePlayheadScrubScroll(el, 390, 100, 30);
    expect(edge.scrolledBy).toBeGreaterThanOrEqual(0);
  });
});
