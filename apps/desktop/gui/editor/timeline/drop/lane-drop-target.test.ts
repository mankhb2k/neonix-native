import { describe, expect, it, vi } from "vitest";
import { DEFAULT_VISUAL_POLICY, type TimelineLane } from "@motionvideo/editor-core";
import { buildLaneHeightPrefix } from "@motionvideo/editor-react";
import {
  collectSceneLanesFromLayout,
  resolveClipMoveDropAtY,
  type LaneHitLayout,
} from "./lane-drop-target";

function visualLane(
  id: string,
  role: "base" | "overlay",
  order: number,
): TimelineLane {
  return {
    id,
    kind: "visual",
    role,
    name: id,
    order,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

describe("lane-drop-target geometry path", () => {
  const lanes: TimelineLane[] = [
    visualLane("ov1", "overlay", 0),
    visualLane("base", "base", -1),
  ];
  const contentHeights = [40, 48];
  const heightsWithGap = [42, 48];
  const layout: LaneHitLayout = {
    topPadding: 10,
    laneHeightPrefix: buildLaneHeightPrefix(heightsWithGap),
    laneContentHeights: contentHeights,
  };

  function stubScroll(scrollTop = 0) {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", {
      value: scrollTop,
      writable: true,
    });
    el.getBoundingClientRect = () =>
      ({
        top: 100,
        left: 0,
        right: 400,
        bottom: 400,
        width: 400,
        height: 300,
        x: 0,
        y: 100,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    return el;
  }

  it("builds client Y hits from prefix without querySelectorAll", () => {
    const scroll = stubScroll(0);
    const spy = vi.spyOn(scroll, "querySelectorAll");
    const hits = collectSceneLanesFromLayout(scroll, lanes, layout);
    expect(spy).not.toHaveBeenCalled();
    // ov1: contentTop 10+0=10 → client 110..150
    expect(hits[0]).toMatchObject({
      laneId: "ov1",
      type: "overlay",
      top: 110,
      bottom: 150,
    });
    // base: contentTop 10+42=52 → client 152..200
    expect(hits[1]).toMatchObject({
      laneId: "base",
      type: "main",
      top: 152,
      bottom: 200,
    });
  });

  it("resolves drop inside lane content via layout path", () => {
    const scroll = stubScroll(0);
    const spy = vi.spyOn(scroll, "querySelectorAll");
    const target = resolveClipMoveDropAtY(
      scroll,
      130, // inside ov1
      "visual",
      false,
      lanes,
      layout,
    );
    expect(spy).not.toHaveBeenCalled();
    expect(target?.laneId).toBe("ov1");
    expect(target?.isInsert).toBe(false);
  });

  it("does not treat gap Y as lane body (insert or miss per policy)", () => {
    const scroll = stubScroll(0);
    // Gap between ov1 bottom (150) and base top (152): clientY 151
    const target = resolveClipMoveDropAtY(
      scroll,
      151,
      "visual",
      false,
      lanes,
      layout,
    );
    // CapCut insert hysteresis may insert between; must not claim ov1 body.
    if (target && !target.isInsert) {
      expect(target.laneId).not.toBe("ov1");
    }
  });
});
