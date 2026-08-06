import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIN_CLIP_SLICE_SEC,
  type TimelineClip,
} from "@motionvideo/editor-core";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeginGesture } from "@motionvideo/editor-react";
import type { PointerSessionConfig } from "@motionvideo/editor-interactions";
import { useClipTrim } from "./use-clip-trim";

const CLIP: TimelineClip = {
  id: "clip",
  kind: "scene",
  sceneId: "scene",
  laneId: "base",
  startTime: 1,
  duration: 2,
  name: "Clip",
};

function pointerEvent(clientX: number): ReactPointerEvent<HTMLElement> {
  return {
    button: 0,
    clientX,
    clientY: 20,
    pointerId: 7,
    currentTarget: document.createElement("div"),
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as ReactPointerEvent<HTMLElement>;
}

describe("useClipTrim", () => {
  afterEach(cleanup);

  it("previews and commits a right-edge trim", () => {
    let captured: PointerSessionConfig<unknown, unknown> | null = null;
    const beginGesture = ((config: unknown) => {
      captured = config as PointerSessionConfig<unknown, unknown>;
      return null;
    }) as BeginGesture;
    const onSelect = vi.fn();
    const onExecute = vi.fn();
    const onLocalPreview = vi.fn();
    const { result } = renderHook(() =>
      useClipTrim({
        pixelsPerSecond: 100,
        beginGesture,
        onSelect,
        onExecute,
        onLocalPreview,
      }),
    );

    act(() => result.current.beginTrim(pointerEvent(100), CLIP, "right"));
    expect(onSelect).toHaveBeenCalledWith({
      kind: "clips",
      ids: ["clip"],
      primaryId: "clip",
    });

    const config = captured!;
    const initial = config.onStart?.({ x: 100, y: 20 });
    const updated = config.onUpdate?.({ x: 150, y: 20 }, initial);
    expect(updated).toEqual({ startTime: 1, duration: 2.5 });
    expect(onLocalPreview).toHaveBeenLastCalledWith({
      kind: "trim",
      clipId: "clip",
      startTime: 1,
      duration: 2.5,
    });

    config.onCommit?.(updated);
    expect(onExecute).toHaveBeenCalledWith(
      {
        type: "clip/trim",
        clipId: "clip",
        startTime: 1,
        duration: 2.5,
      },
      "Trim clip",
    );
    expect(onLocalPreview).toHaveBeenLastCalledWith(null);
  });

  it("clamps trim duration and clears preview on cancel", () => {
    let captured: PointerSessionConfig<unknown, unknown> | null = null;
    const beginGesture = ((config: unknown) => {
      captured = config as PointerSessionConfig<unknown, unknown>;
      return null;
    }) as BeginGesture;
    const onLocalPreview = vi.fn();
    const { result } = renderHook(() =>
      useClipTrim({
        pixelsPerSecond: 100,
        beginGesture,
        onSelect: vi.fn(),
        onExecute: vi.fn(),
        onLocalPreview,
      }),
    );

    act(() => result.current.beginTrim(pointerEvent(100), CLIP, "right"));
    const config = captured!;
    const initial = config.onStart?.({ x: 100, y: 20 });
    const updated = config.onUpdate?.({ x: -1_000, y: 20 }, initial) as {
      duration: number;
    };
    expect(updated.duration).toBe(MIN_CLIP_SLICE_SEC);

    config.onCancel?.(updated);
    expect(onLocalPreview).toHaveBeenLastCalledWith(null);
  });

  it("moves the left edge without changing the original end time", () => {
    let captured: PointerSessionConfig<unknown, unknown> | null = null;
    const beginGesture = ((config: unknown) => {
      captured = config as PointerSessionConfig<unknown, unknown>;
      return null;
    }) as BeginGesture;
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useClipTrim({
        pixelsPerSecond: 100,
        beginGesture,
        onSelect: vi.fn(),
        onExecute,
        onLocalPreview: vi.fn(),
      }),
    );

    act(() => result.current.beginTrim(pointerEvent(100), CLIP, "left"));
    const config = captured!;
    const initial = config.onStart?.({ x: 100, y: 20 });
    const updated = config.onUpdate?.({ x: 150, y: 20 }, initial);

    expect(updated).toEqual({ startTime: 1.5, duration: 1.5 });
    config.onCommit?.(updated);
    expect(onExecute).toHaveBeenCalledWith(
      {
        type: "clip/trim",
        clipId: "clip",
        startTime: 1.5,
        duration: 1.5,
      },
      "Trim clip",
    );
  });

  it("does not start for a non-primary button or while disabled", () => {
    const beginGesture = vi.fn() as unknown as BeginGesture;
    const onSelect = vi.fn();
    const { result, rerender } = renderHook(
      ({ disabled }) =>
        useClipTrim({
          pixelsPerSecond: 100,
          disabled,
          beginGesture,
          onSelect,
          onExecute: vi.fn(),
          onLocalPreview: vi.fn(),
        }),
      { initialProps: { disabled: false } },
    );
    const secondary = pointerEvent(100);
    Object.defineProperty(secondary, "button", { value: 2 });

    act(() => result.current.beginTrim(secondary, CLIP, "right"));
    rerender({ disabled: true });
    act(() => result.current.beginTrim(pointerEvent(100), CLIP, "right"));

    expect(beginGesture).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
