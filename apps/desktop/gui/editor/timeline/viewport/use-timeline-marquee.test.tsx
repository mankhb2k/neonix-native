/**
 * Marquee orchestration — pointer session through live preview to commit/cancel.
 * @vitest-environment happy-dom
 */
import { useRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  selectionClips,
  selectionNone,
  type EditorSelection,
  type TimelineClip,
  type TimelineLane,
  DEFAULT_VISUAL_POLICY,
} from "@motionvideo/editor-core";
import { buildLaneHeightPrefix } from "../view-model/visible-lane-window";
import {
  clearPreviewSession,
  getPreviewSession,
} from "../interactions/timeline-preview-session";
import { resetActivePointerSessionToken } from "../interactions/pointer-session-controller";
import { usePointerSessionHost } from "../interactions/use-pointer-session";
import { useTimelineMarquee } from "./use-timeline-marquee";

vi.mock("@motionvideo/editor-interactions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@motionvideo/editor-interactions")>();
  return {
    ...actual,
    autoScrollElementNearEdge: vi.fn(),
  };
});

import { autoScrollElementNearEdge } from "@motionvideo/editor-interactions";

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

function sceneClip(
  id: string,
  laneId: string,
  startTime: number,
  duration: number,
): TimelineClip {
  return {
    kind: "scene",
    id,
    sceneId: `s-${id}`,
    laneId,
    startTime,
    duration,
    name: id,
  };
}

function Harness(props: {
  selection: EditorSelection;
  onSelect: (s: EditorSelection) => void;
  seekToClientX: (x: number) => void;
  laneContentHeights: number[];
  laneHeightPrefix: number[];
  sortedLanes: TimelineLane[];
  clipsByLaneMap: Map<string, TimelineClip[]>;
  topPadding: number;
  scrollEl: HTMLDivElement;
}) {
  const { beginGesture } = usePointerSessionHost();
  const tracksScrollRef = useRef<HTMLDivElement | null>(props.scrollEl);
  tracksScrollRef.current = props.scrollEl;
  const beginMarquee = useTimelineMarquee({
    tracksScrollRef,
    disabled: false,
    selection: props.selection,
    beginGesture,
    laneHeightPrefix: props.laneHeightPrefix,
    laneContentHeights: props.laneContentHeights,
    topPadding: props.topPadding,
    sortedLanes: props.sortedLanes,
    clipsByLaneMap: props.clipsByLaneMap,
    pixelsPerSecond: 100,
    onSelect: props.onSelect,
    seekToClientX: props.seekToClientX,
  });

  return (
    <div
      data-testid="surface"
      onPointerDown={(e) => beginMarquee(e)}
    />
  );
}

describe("useTimelineMarquee orchestration", () => {
  let scrollEl: HTMLDivElement;

  const contentHeights = [40, 40];
  const prefix = buildLaneHeightPrefix([42, 40]);
  const lanes: TimelineLane[] = [
    visualLane("l0", "base", -1),
    visualLane("l1", "overlay", 0),
  ];
  const clips = [
    sceneClip("a", "l0", 1, 2),
    sceneClip("b", "l1", 5, 1),
  ];
  const clipsByLaneMap = new Map<string, TimelineClip[]>([
    ["l0", [clips[0]!]],
    ["l1", [clips[1]!]],
  ]);

  beforeEach(() => {
    resetActivePointerSessionToken();
    clearPreviewSession();
    vi.mocked(autoScrollElementNearEdge).mockClear();
    scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollLeft", { value: 0, writable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 0, writable: true });
    scrollEl.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
  });

  afterEach(() => {
    cleanup();
    clearPreviewSession();
    resetActivePointerSessionToken();
  });

  function renderHarness(
    selection: EditorSelection,
    onSelect: (s: EditorSelection) => void,
    seek = vi.fn(),
    layout?: {
      laneContentHeights: number[];
      laneHeightPrefix: number[];
      sortedLanes: TimelineLane[];
      clipsByLaneMap: Map<string, TimelineClip[]>;
      topPadding?: number;
    },
  ) {
    const view = render(
      <Harness
        selection={selection}
        onSelect={onSelect}
        seekToClientX={seek}
        laneContentHeights={layout?.laneContentHeights ?? contentHeights}
        laneHeightPrefix={layout?.laneHeightPrefix ?? prefix}
        sortedLanes={layout?.sortedLanes ?? lanes}
        clipsByLaneMap={layout?.clipsByLaneMap ?? clipsByLaneMap}
        topPadding={layout?.topPadding ?? 10}
        scrollEl={scrollEl}
      />,
    );
    return view.getByTestId("surface");
  }

  function pointer(
    el: Element | Window,
    type: "pointerdown" | "pointermove" | "pointerup",
    clientX: number,
    clientY: number,
    extras: { shiftKey?: boolean } = {},
  ) {
    const target = el as Element;
    fireEvent(
      target,
      new PointerEvent(type, {
        bubbles: true,
        clientX,
        clientY,
        pointerId: 1,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        ...extras,
      }),
    );
  }

  async function flushPointerRaf() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  it("commits selection none once when marquee ends on empty region", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionClips(["a"]), onSelect);
    pointer(surface, "pointerdown", 20, 20);
    pointer(window, "pointermove", 30, 35);
    await flushPointerRaf();
    pointer(window, "pointerup", 30, 35);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(selectionNone());
  });

  it("unions hits with existing selection when Shift is held", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionClips(["b"]), onSelect);
    pointer(surface, "pointerdown", 158, 20, { shiftKey: true });
    pointer(window, "pointermove", 250, 40, { shiftKey: true });
    await flushPointerRaf();
    pointer(window, "pointerup", 250, 40, { shiftKey: true });
    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0]![0] as EditorSelection;
    expect(arg.kind).toBe("clips");
    if (arg.kind === "clips") {
      expect([...arg.ids].sort()).toEqual(["a", "b"]);
    }
  });

  it("Escape cancel keeps document selection and clears preview", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionClips(["a"]), onSelect);
    pointer(surface, "pointerdown", 150, 20);
    pointer(window, "pointermove", 250, 40);
    await flushPointerRaf();
    expect(getPreviewSession().marquee).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(getPreviewSession().marquee).toBeNull();
    expect(getPreviewSession().marqueeSelectionIds).toBeNull();
  });

  it("does not select when marquee is only in the lane gap", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionNone(), onSelect);
    pointer(surface, "pointerdown", 200, 50.5);
    pointer(window, "pointermove", 220, 51.5);
    await flushPointerRaf();
    pointer(window, "pointerup", 220, 51.5);
    expect(onSelect).toHaveBeenCalledWith(selectionNone());
  });

  it("selects with a vertical zero-width marquee through a clip", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionNone(), onSelect);
    pointer(surface, "pointerdown", 200, 15);
    pointer(window, "pointermove", 200, 45);
    await flushPointerRaf();
    pointer(window, "pointerup", 200, 45);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(selectionClips(["a"]));
  });

  it("calls auto-scroll during marquee update near edge", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionNone(), onSelect);
    Object.defineProperty(scrollEl, "clientHeight", { value: 300 });
    Object.defineProperty(scrollEl, "scrollHeight", { value: 800 });
    pointer(surface, "pointerdown", 10, 20);
    pointer(window, "pointermove", 390, 280);
    await flushPointerRaf();
    pointer(window, "pointerup", 390, 280);
    expect(autoScrollElementNearEdge).toHaveBeenCalled();
    const lastCall = vi.mocked(autoScrollElementNearEdge).mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(scrollEl);
    // maxScrollTop constraint was removed to allow reaching native scroll max
    expect(lastCall?.[5]).toBeUndefined();
  });

  it("keeps auto-scrolling while the pointer stays in the bottom edge band", async () => {
    const onSelect = vi.fn();
    // Tall stack so maxScrollTop > 0 (edge loop can continue downward).
    const tallHeights = [120, 120, 120, 120, 120, 120];
    const tallPrefix = buildLaneHeightPrefix(
      tallHeights.map((h, i) => h + (i < tallHeights.length - 1 ? 2 : 0)),
    );
    const tallLanes = tallHeights.map((_, i) =>
      visualLane(`tl${i}`, i === 0 ? "base" : "overlay", i - 1),
    );
    const tallClips = new Map<string, TimelineClip[]>();
    for (const lane of tallLanes) tallClips.set(lane.id, []);

    Object.defineProperty(scrollEl, "clientHeight", { value: 300 });
    Object.defineProperty(scrollEl, "clientWidth", { value: 400 });
    Object.defineProperty(scrollEl, "scrollHeight", { value: 900 });
    Object.defineProperty(scrollEl, "scrollWidth", { value: 400 });
    Object.defineProperty(scrollEl, "scrollTop", {
      value: 0,
      writable: true,
    });
    vi.mocked(autoScrollElementNearEdge).mockImplementation((el) => {
      el.scrollTop = Math.min(el.scrollTop + 14, 200);
    });
    const surface = renderHarness(selectionNone(), onSelect, vi.fn(), {
      laneContentHeights: tallHeights,
      laneHeightPrefix: tallPrefix,
      sortedLanes: tallLanes,
      clipsByLaneMap: tallClips,
      topPadding: 10,
    });
    pointer(surface, "pointerdown", 100, 20);
    pointer(window, "pointermove", 100, 290);
    await flushPointerRaf();
    await flushPointerRaf();
    await flushPointerRaf();
    expect(
      vi.mocked(autoScrollElementNearEdge).mock.calls.length,
    ).toBeGreaterThan(1);
    pointer(window, "pointerup", 100, 290);
  });

  it("does not call onSelect during live preview (only on commit)", async () => {
    const onSelect = vi.fn();
    const surface = renderHarness(selectionNone(), onSelect);
    pointer(surface, "pointerdown", 150, 20);
    pointer(window, "pointermove", 250, 40);
    await flushPointerRaf();
    expect(onSelect).not.toHaveBeenCalled();
    expect(getPreviewSession().marqueeSelectionIds).toEqual(["a"]);
    pointer(window, "pointerup", 250, 40);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("treats a click without movement as clear selection plus seek", () => {
    const onSelect = vi.fn();
    const seek = vi.fn();
    const surface = renderHarness(selectionClips(["a"]), onSelect, seek);

    pointer(surface, "pointerdown", 180, 20);
    pointer(window, "pointerup", 180, 20);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(selectionNone());
    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(180);
  });

  it("seeks on empty click with layer-mode synthetic clips in the map", () => {
    const onSelect = vi.fn();
    const seek = vi.fn();
    const layerLane = visualLane("layer-node:n1", "overlay", 0);
    const layerClips = new Map<string, TimelineClip[]>([
      [
        layerLane.id,
        [
          {
            kind: "scene",
            id: "n1",
            sceneId: "sc1",
            laneId: layerLane.id,
            startTime: 2,
            duration: 3,
            name: "Node",
          },
        ],
      ],
    ]);
    const surface = renderHarness(selectionNone(), onSelect, seek, {
      laneContentHeights: [40],
      laneHeightPrefix: buildLaneHeightPrefix([40]),
      sortedLanes: [layerLane],
      clipsByLaneMap: layerClips,
      topPadding: 10,
    });

    // Empty region to the left of the synthetic strip (strip starts at 2s * 100pps).
    pointer(surface, "pointerdown", 50, 20);
    pointer(window, "pointerup", 50, 20);

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(50);
    expect(onSelect).toHaveBeenCalledWith(selectionNone());
  });

  describe("integration: real auto-scroll", () => {
    it("scrolls the DOM node automatically when pointer is held near the bottom edge", async () => {
      const { autoScrollElementNearEdge: realAutoScroll } = await vi.importActual<
        typeof import("@motionvideo/editor-interactions")
      >("@motionvideo/editor-interactions");

      vi.mocked(autoScrollElementNearEdge).mockImplementation((...args) => {
        realAutoScroll(...args);
      });

      const onSelect = vi.fn();
      const tallHeights = [120, 120, 120, 120, 120, 120];
      const tallPrefix = buildLaneHeightPrefix(
        tallHeights.map((h, i) => h + (i < tallHeights.length - 1 ? 2 : 0)),
      );
      const tallLanes = tallHeights.map((_, i) =>
        visualLane(`tl${i}`, i === 0 ? "base" : "overlay", i - 1),
      );
      const tallClips = new Map<string, TimelineClip[]>();
      for (const lane of tallLanes) tallClips.set(lane.id, []);

      Object.defineProperty(scrollEl, "clientHeight", { value: 300 });
      Object.defineProperty(scrollEl, "clientWidth", { value: 400 });
      Object.defineProperty(scrollEl, "scrollHeight", { value: 900 });
      Object.defineProperty(scrollEl, "scrollWidth", { value: 400 });
      Object.defineProperty(scrollEl, "scrollTop", { value: 0, writable: true });
      Object.defineProperty(scrollEl, "scrollLeft", { value: 0, writable: true });
      
      const surface = renderHarness(selectionNone(), onSelect, vi.fn(), {
        laneContentHeights: tallHeights,
        laneHeightPrefix: tallPrefix,
        sortedLanes: tallLanes,
        clipsByLaneMap: tallClips,
        topPadding: 10,
      });

      pointer(surface, "pointerdown", 100, 20);
      // Move into bottom edge band (300 - 48 = 252. 290 is well inside)
      pointer(window, "pointermove", 100, 290);
      
      await flushPointerRaf();
      await flushPointerRaf();
      await flushPointerRaf();

      // Ensure the actual scroll element got its property updated
      expect(scrollEl.scrollTop).toBeGreaterThan(0);
      
      pointer(window, "pointerup", 100, 290);
    });

    it("does not call autoScrollElementNearEdge on mouse up (commit phase)", async () => {
      Object.defineProperty(scrollEl, "scrollHeight", { value: 800 });
      const surface = renderHarness(selectionNone(), vi.fn());
      pointer(surface, "pointerdown", 10, 20);
      pointer(window, "pointermove", 100, 290);
      await flushPointerRaf();
      
      // Clear mock calls to isolate pointerup
      vi.mocked(autoScrollElementNearEdge).mockClear();
      
      pointer(window, "pointerup", 100, 290);
      expect(autoScrollElementNearEdge).not.toHaveBeenCalled();
    });
  });
});
