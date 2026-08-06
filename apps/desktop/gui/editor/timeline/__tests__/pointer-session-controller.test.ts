/**
 * PointerSessionController — pendingPos must clear before onUpdate.
 * @vitest-environment happy-dom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PointerSessionController,
  resetActivePointerSessionToken,
} from "@motionvideo/editor-interactions";

describe("PointerSessionController pendingPos", () => {
  afterEach(() => {
    resetActivePointerSessionToken();
    vi.unstubAllGlobals();
  });

  it("clears pendingPos before onUpdate so flush does not double-apply", () => {
    const updates: Array<{ x: number; y: number }> = [];
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafQueue.length = 0;
    });

    const controller = new PointerSessionController<{ n: number }, void>({
      name: "pending-clear",
      onStart: () => ({ n: 0 }),
      onUpdate: (pos, state) => {
        updates.push(pos);
        return { n: state.n + 1 };
      },
    });

    expect(controller.start({ x: 0, y: 0 })).toBe(true);
    controller.update({ x: 10, y: 20 });
    expect(rafQueue).toHaveLength(1);
    rafQueue[0]!(0);
    expect(updates).toEqual([{ x: 10, y: 20 }]);

    // No queued pos left — flush must not call onUpdate again.
    controller.flushPendingUpdate();
    expect(updates).toHaveLength(1);

    controller.cancel();
  });

  it("clears pendingPos on non-RAF path so flush does not double-apply", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);

    const updates: Array<{ x: number; y: number }> = [];
    const controller = new PointerSessionController<{ n: number }, void>({
      name: "no-raf",
      onStart: () => ({ n: 0 }),
      onUpdate: (pos, state) => {
        updates.push(pos);
        return { n: state.n + 1 };
      },
    });

    expect(controller.start({ x: 0, y: 0 })).toBe(true);
    controller.update({ x: 5, y: 6 });
    expect(updates).toEqual([{ x: 5, y: 6 }]);

    controller.flushPendingUpdate();
    expect(updates).toHaveLength(1);

    controller.cancel();
  });
});
