import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachWindowListeners,
  beginPress,
  cancel,
  dispose,
  end,
  getSession,
  move,
  subscribe,
} from "../../renderer/src/editor/library/interactions/library-drag-session";
import type { LibraryPayload } from "../../renderer/src/editor/library/model/library-payload";

const SAMPLE: LibraryPayload = {
  kind: "text",
  id: "t1",
  label: "Title",
  text: "Title",
  duration: 5,
};

describe("library-drag-session", () => {
  beforeEach(() => {
    dispose();
    cancel();
  });

  it("stays pressed until 4px threshold, then dragging", () => {
    beginPress(SAMPLE, 100, 100);
    expect(getSession().phase).toBe("pressed");

    move(102, 101);
    expect(getSession().phase).toBe("pressed");

    move(105, 100);
    expect(getSession().phase).toBe("dragging");
    expect(getSession().clientX).toBe(105);
  });

  it("cancel clears session (Escape / pointercancel path)", () => {
    beginPress(SAMPLE, 10, 10);
    move(20, 20);
    expect(getSession().phase).toBe("dragging");
    cancel();
    expect(getSession().phase).toBe("idle");
    expect(getSession().item).toBeNull();
  });

  it("drop outside timeline cancels", () => {
    beginPress(SAMPLE, 0, 0);
    move(10, 0);
    const result = end(50, 50, false);
    expect(result).toEqual({ kind: "cancel" });
    expect(getSession().phase).toBe("idle");
  });

  it("one commit on click (pressed, no drag)", () => {
    beginPress(SAMPLE, 5, 5);
    const result = end(5, 5, false);
    expect(result).toEqual({
      kind: "commit",
      item: SAMPLE,
      clientX: 5,
      clientY: 5,
      mode: "click",
    });
    expect(getSession().phase).toBe("idle");
  });

  it("one commit when dragging over drop zone", () => {
    beginPress(SAMPLE, 0, 0);
    move(8, 0);
    const result = end(100, 100, true);
    expect(result).toEqual({
      kind: "commit",
      item: SAMPLE,
      clientX: 100,
      clientY: 100,
      mode: "drag",
    });
  });

  it("subscribe does not emit on sub-threshold moves while pressed", () => {
    const seen: string[] = [];
    const unsub = subscribe((s) => seen.push(s.phase));
    seen.length = 0;

    beginPress(SAMPLE, 0, 0);
    expect(seen).toEqual(["pressed"]);
    seen.length = 0;

    move(1, 1);
    expect(seen).toEqual([]);

    move(10, 0);
    expect(seen).toEqual(["dragging"]);
    unsub();
  });

  it("attachWindowListeners dispose removes the same listeners", () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const fakeWindow = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) {
        listeners.get(type)?.delete(listener);
      },
    };
    vi.stubGlobal("window", fakeWindow);

    const onMove = vi.fn() as unknown as (event: PointerEvent) => void;
    const onUp = vi.fn() as unknown as (event: PointerEvent) => void;
    const onCancel = vi.fn() as unknown as (event: PointerEvent) => void;
    const onKeyDown = vi.fn() as unknown as (event: KeyboardEvent) => void;

    const cleanup = attachWindowListeners({
      onMove,
      onUp,
      onCancel,
      onKeyDown,
    });

    expect(listeners.get("pointermove")?.has(onMove as never)).toBe(true);
    cleanup();
    expect(listeners.get("pointermove")?.has(onMove as never)).toBe(false);
    expect(listeners.get("pointerup")?.has(onUp as never)).toBe(false);
    expect(listeners.get("pointercancel")?.has(onCancel as never)).toBe(false);
    expect(listeners.get("keydown")?.has(onKeyDown as never)).toBe(false);

    vi.unstubAllGlobals();
  });
});
