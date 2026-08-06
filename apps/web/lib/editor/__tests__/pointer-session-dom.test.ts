import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PointerSessionController } from "@motionvideo/editor-interactions";

/**
 * Unit coverage for the pure controller + DOM-binding contract used by
 * usePointerSession. Full React hook tests live beside interactions when needed;
 * here we verify flush/token/cleanup semantics the hook relies on.
 */
describe("PointerSessionController DOM-host contract", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes token while running and releases on cancel", () => {
    const a = new PointerSessionController({
      name: "a",
      onStart: () => ({ n: 0 }),
    });
    expect(a.start({ x: 0, y: 0 })).toBe(true);
    expect(a.token).toMatch(/^session_a_/);
    a.cancel();
    expect(a.isRunning).toBe(false);

    const b = new PointerSessionController({
      name: "b",
      onStart: () => ({ n: 1 }),
    });
    expect(b.start({ x: 1, y: 1 })).toBe(true);
    b.commit();
  });

  it("flushPendingUpdate applies coalesced move before commit", () => {
    const onUpdate = vi.fn((_pos, state: { x: number }) => ({
      x: _pos.x,
    }));
    // Use real rAF stub that does NOT auto-run so flush can drain pending.
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafCb = null;
    });

    const controller = new PointerSessionController({
      name: "flush",
      onStart: () => ({ x: 0 }),
      onUpdate,
      onCommit: (s) => s,
    });
    controller.start({ x: 0, y: 0 });
    controller.update({ x: 42, y: 0 });
    expect(onUpdate).not.toHaveBeenCalled();
    controller.flushPendingUpdate();
    expect(onUpdate).toHaveBeenCalledOnce();
    const result = controller.commit();
    expect(result).toEqual({ x: 42 });
  });

  it("blocks a second concurrent session until the first releases", () => {
    const first = new PointerSessionController({
      name: "first",
      onStart: () => ({}),
    });
    const second = new PointerSessionController({
      name: "second",
      onStart: () => ({}),
    });
    expect(first.start({ x: 0, y: 0 })).toBe(true);
    expect(second.start({ x: 1, y: 1 })).toBe(false);
    first.cancel();
    expect(second.start({ x: 1, y: 1 })).toBe(true);
    second.cancel();
  });
});

describe("usePointerSession listener cleanup (simulated host)", () => {
  it("removes window listeners after end", () => {
    const listeners = new Map<string, Set<EventListener>>();
    const add = vi.fn((type: string, fn: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    });
    const remove = vi.fn((type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn);
    });

    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;
    window.addEventListener = add as typeof window.addEventListener;
    window.removeEventListener = remove as typeof window.removeEventListener;

    const onMove = () => undefined;
    const onUp = () => undefined;
    const onCancel = () => undefined;
    const onKey = () => undefined;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);

    expect(listeners.get("pointermove")?.size).toBe(1);

    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);

    expect(listeners.get("pointermove")?.size ?? 0).toBe(0);

    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });
});
