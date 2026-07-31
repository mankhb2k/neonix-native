import { describe, expect, it, vi } from "vitest";
import {
  PointerSessionController,
  resetActivePointerSessionToken,
} from "../../renderer/src/editor/timeline/interactions/pointer-session-controller";

describe("pointer session lifecycle (Wave 4)", () => {
  it("releases global token on cancel so a new gesture can start", () => {
    resetActivePointerSessionToken();
    const first = new PointerSessionController({
      name: "first",
      onStart: () => ({}),
    });
    expect(first.start({ x: 0, y: 0 })).toBe(true);
    const blocked = new PointerSessionController({
      name: "blocked",
      onStart: () => ({}),
    });
    expect(blocked.start({ x: 1, y: 1 })).toBe(false);

    first.cancel();
    const second = new PointerSessionController({
      name: "second",
      onStart: () => ({}),
    });
    expect(second.start({ x: 2, y: 2 })).toBe(true);
    second.cancel();
  });

  it("dispose path cancels without commit and frees the token", () => {
    resetActivePointerSessionToken();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const controller = new PointerSessionController({
      name: "dispose",
      onStart: () => ({ v: 1 }),
      onCommit,
      onCancel,
    });
    expect(controller.start({ x: 0, y: 0 })).toBe(true);

    // Host dispose: cancel + reset global token (listeners removed by host).
    controller.cancel();
    resetActivePointerSessionToken();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();

    const next = new PointerSessionController({
      name: "after-dispose",
      onStart: () => ({}),
    });
    expect(next.start({ x: 3, y: 3 })).toBe(true);
    next.cancel();
  });
});
