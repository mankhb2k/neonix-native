import { describe, expect, it, vi } from "vitest";
import {
  PointerSessionController,
  resetActivePointerSessionToken,
} from "@motionvideo/editor-interactions";

describe("pointer session lifecycle (UI-0)", () => {
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

  it("owner cancel frees token; foreign dispose must not clear active token", () => {
    resetActivePointerSessionToken();
    const onCancel = vi.fn();
    const owner = new PointerSessionController({
      name: "owner",
      onStart: () => ({ v: 1 }),
      onCancel,
    });
    expect(owner.start({ x: 0, y: 0 })).toBe(true);

    // Simulate foreign host unmount: it has no local gesture — must NOT reset token.
    // Only the owning controller.cancel() releases the token.
    const foreign = new PointerSessionController({
      name: "foreign",
      onStart: () => ({}),
    });
    expect(foreign.start({ x: 1, y: 1 })).toBe(false);

    owner.cancel();
    expect(onCancel).toHaveBeenCalledOnce();

    const next = new PointerSessionController({
      name: "after-owner",
      onStart: () => ({}),
    });
    expect(next.start({ x: 3, y: 3 })).toBe(true);
    next.cancel();
  });
});
