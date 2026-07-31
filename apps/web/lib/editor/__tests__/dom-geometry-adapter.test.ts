import { describe, expect, it, vi } from "vitest";
import { DomGeometryAdapter } from "@/components/desktop/editor/timeline/interactions/dom-geometry-adapter";

function makeLane(
  attrs: Record<string, string>,
  top: number,
  bottom: number,
): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-track-lane", "true");
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 400,
      width: 400,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe("DomGeometryAdapter", () => {
  it("caches lane measures until revision bumps", () => {
    const workspace = document.createElement("div");
    workspace.appendChild(
      makeLane(
        { "data-track-role": "overlay", "data-lane-id": "ov0", "data-lane-order": "0" },
        100,
        140,
      ),
    );
    workspace.appendChild(
      makeLane(
        { "data-track-role": "base", "data-lane-id": "main" },
        140,
        180,
      ),
    );
    workspace.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 300,
        left: 0,
        right: 400,
        width: 400,
        height: 200,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    const scroll = document.createElement("div");
    Object.defineProperty(scroll, "scrollLeft", { value: 0, writable: true });
    Object.defineProperty(scroll, "clientWidth", { value: 400 });

    const adapter = new DomGeometryAdapter({ pixelsPerSecond: 50 });
    adapter.bind(workspace, scroll);

    const first = adapter.resolveVisualDrop(120, false, 0);
    expect(first?.laneId).toBe("ov0");
    expect(adapter.getMeasureCount()).toBe(1);

    const second = adapter.resolveVisualDrop(120, false, 0);
    expect(second?.laneId).toBe("ov0");
    expect(adapter.getMeasureCount()).toBe(1);

    adapter.bump("scroll");
    adapter.resolveVisualDrop(120, false, 0);
    expect(adapter.getMeasureCount()).toBe(2);
  });

  it("bindInvalidation removes listeners on dispose", () => {
    const workspace = document.createElement("div");
    const scroll = document.createElement("div");
    const adapter = new DomGeometryAdapter({ pixelsPerSecond: 50 });
    adapter.bind(workspace, scroll);

    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const unbind = adapter.bindInvalidation();
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    unbind();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
