import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  selectionNone,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeginGesture } from "@motionvideo/editor-react";
import type { PointerSessionConfig } from "@motionvideo/editor-interactions";
import {
  clearPreviewSession,
  getPreviewSession,
} from "../interactions/timeline-preview-session";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import { useClipMove } from "./use-clip-move";

const mocks = vi.hoisted(() => ({
  autoScroll: vi.fn(),
  resolveDropTarget: vi.fn(),
  pointerContentXAtPoint: vi.fn((x: number) => x),
  getTimelineDropHost: vi.fn(),
}));

vi.mock("../drop/auto-scroll", () => ({
  autoScrollTimelineNearEdge: mocks.autoScroll,
}));

vi.mock("../drop/lane-drop-target", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../drop/lane-drop-target")>();
  return {
    ...actual,
    resolveClipMoveDropAtY: mocks.resolveDropTarget,
  };
});

vi.mock("../drop/timeline-drop-host", () => ({
  getTimelineDropHost: mocks.getTimelineDropHost,
  pointerContentXAtPoint: mocks.pointerContentXAtPoint,
}));

const LANE: TimelineLane = {
  id: "base",
  kind: "visual",
  role: "base",
  order: -1,
  name: "Main",
  policy: { allowOverlap: false, rippleMode: true },
};

const CLIP: TimelineClip = {
  id: "clip",
  kind: "scene",
  sceneId: "scene",
  laneId: "base",
  startTime: 0,
  duration: 2,
  name: "Clip",
};

function pointerEvent(clientX: number): ReactPointerEvent<HTMLElement> {
  const currentTarget = document.createElement("div");
  const parent = document.createElement("div");
  parent.appendChild(currentTarget);
  return {
    button: 0,
    clientX,
    clientY: 30,
    pointerId: 7,
    currentTarget,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as ReactPointerEvent<HTMLElement>;
}

describe("useClipMove", () => {
  beforeEach(() => {
    clearPreviewSession();
    useTimelineInteractionPrefs.setState({ autoSnapping: false });
    mocks.autoScroll.mockReset();
    mocks.resolveDropTarget.mockReset();
    mocks.pointerContentXAtPoint.mockClear();
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollTop", { value: 0, writable: true });
    mocks.getTimelineDropHost.mockReturnValue({
      scrollEl,
      lanes: [LANE],
    });
    mocks.resolveDropTarget.mockReturnValue({
      family: "visual",
      laneId: "base",
      isInsert: false,
      insertOrder: null,
      indicatorTop: 30,
      overBaseBody: true,
    });
  });

  afterEach(() => {
    cleanup();
    clearPreviewSession();
    useTimelineInteractionPrefs.setState({ autoSnapping: true });
  });

  it("honors the movement threshold, previews, and commits one clip", () => {
    let captured: PointerSessionConfig<unknown, unknown> | null = null;
    const beginGesture = ((config: unknown) => {
      captured = config as PointerSessionConfig<unknown, unknown>;
      return null;
    }) as BeginGesture;
    const onSelect = vi.fn();
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useClipMove({
        clips: [CLIP],
        allClips: [CLIP],
        lanes: [LANE],
        lane: LANE,
        pixelsPerSecond: 100,
        selection: selectionNone(),
        beginGesture,
        onSelect,
        onExecute,
      }),
    );

    act(() => result.current.beginMove(pointerEvent(10), CLIP));
    expect(onSelect).toHaveBeenCalledWith({
      kind: "clips",
      ids: ["clip"],
      primaryId: "clip",
    });

    const config = captured!;
    const initial = config.onStart?.({ x: 10, y: 30 });
    const belowThreshold = config.onUpdate?.({ x: 12, y: 31 }, initial) as {
      moved: boolean;
    };
    expect(belowThreshold.moved).toBe(false);
    expect(getPreviewSession().clipMovePreview).toBeNull();

    const moved = config.onUpdate?.({ x: 110, y: 30 }, belowThreshold) as {
      startTime: number;
      valid: boolean;
    };
    expect(moved).toMatchObject({ startTime: 1, valid: true });
    expect(getPreviewSession().clipMovePreview).toMatchObject({
      clipId: "clip",
      startTime: 1,
      valid: true,
    });

    config.onCommit?.(moved);
    expect(onExecute).toHaveBeenCalledWith(
      {
        type: "move-clip",
        clipId: "clip",
        patch: {
          startTime: 1,
          track: "main",
          laneId: "base",
          insertNewLane: undefined,
          insertOrder: undefined,
        },
      },
      "Move clip",
    );
    expect(getPreviewSession().clipMovePreview).toBeNull();
  });

  it("does not commit an invalid move and clears previews", () => {
    mocks.resolveDropTarget.mockReturnValue(null);
    let captured: PointerSessionConfig<unknown, unknown> | null = null;
    const beginGesture = ((config: unknown) => {
      captured = config as PointerSessionConfig<unknown, unknown>;
      return null;
    }) as BeginGesture;
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useClipMove({
        clips: [CLIP],
        lanes: [LANE],
        lane: LANE,
        pixelsPerSecond: 100,
        selection: selectionNone(),
        beginGesture,
        onSelect: vi.fn(),
        onExecute,
      }),
    );

    act(() => result.current.beginMove(pointerEvent(10), CLIP));
    const config = captured!;
    const initial = config.onStart?.({ x: 10, y: 30 });
    const invalid = config.onUpdate?.({ x: 110, y: 30 }, initial);
    expect(getPreviewSession().clipMovePreview).not.toBeNull();
    config.onCommit?.(invalid);

    expect(onExecute).not.toHaveBeenCalled();
    expect(getPreviewSession().clipMovePreview).toBeNull();
  });

  it("passes base lane role/order so occupancy insertOrder is 0", () => {
    const other: TimelineClip = {
      id: "other",
      kind: "scene",
      sceneId: "scene-2",
      laneId: "base",
      startTime: 2,
      duration: 3,
      name: "Other",
    };
    let captured: PointerSessionConfig<unknown, unknown> | null = null;
    const beginGesture = ((config: unknown) => {
      captured = config as PointerSessionConfig<unknown, unknown>;
      return null;
    }) as BeginGesture;
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useClipMove({
        clips: [CLIP, other],
        allClips: [CLIP, other],
        lanes: [LANE],
        lane: LANE,
        pixelsPerSecond: 100,
        selection: selectionNone(),
        beginGesture,
        onSelect: vi.fn(),
        onExecute,
      }),
    );

    act(() => result.current.beginMove(pointerEvent(10), CLIP));
    const config = captured!;
    const initial = config.onStart?.({ x: 10, y: 30 });
    const moved = config.onUpdate?.({ x: 350, y: 30 }, initial) as {
      valid: boolean;
      insertNewLane: boolean;
      insertOrder: number | null;
      startTime: number;
    };
    expect(moved).toMatchObject({
      valid: true,
      insertNewLane: true,
      insertOrder: 0,
    });
    expect(getPreviewSession().clipMovePreview).toMatchObject({
      isInsert: true,
      insertOrder: 0,
    });

    config.onCommit?.(moved);
    expect(onExecute).toHaveBeenCalledWith(
      {
        type: "move-clip",
        clipId: "clip",
        patch: {
          startTime: moved.startTime,
          track: "overlay",
          laneId: null,
          insertNewLane: true,
          insertOrder: 0,
        },
      },
      "Move clip to new lane",
    );
  });

  it("does not start for a non-primary button or while disabled", () => {
    const beginGesture = vi.fn() as unknown as BeginGesture;
    const onSelect = vi.fn();
    const { result, rerender } = renderHook(
      ({ disabled }) =>
        useClipMove({
          clips: [CLIP],
          lanes: [LANE],
          lane: LANE,
          pixelsPerSecond: 100,
          selection: selectionNone(),
          disabled,
          beginGesture,
          onSelect,
          onExecute: vi.fn(),
        }),
      { initialProps: { disabled: false } },
    );
    const secondary = pointerEvent(10);
    Object.defineProperty(secondary, "button", { value: 2 });

    act(() => result.current.beginMove(secondary, CLIP));
    rerender({ disabled: true });
    act(() => result.current.beginMove(pointerEvent(10), CLIP));

    expect(beginGesture).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
