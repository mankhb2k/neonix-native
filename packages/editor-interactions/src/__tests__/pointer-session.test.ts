import { describe, expect, it } from "vitest";
import { createInteractionCoordinator } from "../pointer/interaction-coordinator";
import { shouldCommitPointerSession } from "../pointer/pointer-session";
import { PointerSessionController } from "../pointer/pointer-session-controller";
import { syncScheduler, type Scheduler } from "../common/scheduler";
import { resolveClipTrimUpdate } from "../timeline/clip-trim";

describe("interaction coordinator", () => {
  it("allows only one active session per coordinator", () => {
    const coordinator = createInteractionCoordinator();
    const a = new PointerSessionController(
      { name: "a", onStart: () => ({}) },
      { coordinator, scheduler: syncScheduler },
    );
    const b = new PointerSessionController(
      { name: "b", onStart: () => ({}) },
      { coordinator, scheduler: syncScheduler },
    );
    expect(a.start({ x: 0, y: 0 })).toBe(true);
    expect(b.start({ x: 1, y: 1 })).toBe(false);
    a.commit();
    expect(b.start({ x: 1, y: 1 })).toBe(true);
  });

  it("isolates coordinators across editor instances", () => {
    const left = createInteractionCoordinator();
    const right = createInteractionCoordinator();
    const a = new PointerSessionController(
      { name: "a", onStart: () => ({}) },
      { coordinator: left, scheduler: syncScheduler },
    );
    const b = new PointerSessionController(
      { name: "b", onStart: () => ({}) },
      { coordinator: right, scheduler: syncScheduler },
    );
    expect(a.start({ x: 0, y: 0 })).toBe(true);
    expect(b.start({ x: 0, y: 0 })).toBe(true);
  });
});

describe("shouldCommitPointerSession", () => {
  it("commits only on pointerup", () => {
    expect(shouldCommitPointerSession("pointerup")).toBe(true);
    expect(shouldCommitPointerSession("pointercancel")).toBe(false);
    expect(shouldCommitPointerSession("escape")).toBe(false);
  });
});

describe("resolveClipTrimUpdate", () => {
  it("trims left and right edges", () => {
    expect(
      resolveClipTrimUpdate({
        edge: "right",
        originStart: 1,
        originDuration: 2,
        deltaSec: 0.5,
        minDuration: 0.05,
      }),
    ).toEqual({ startTime: 1, duration: 2.5 });
    expect(
      resolveClipTrimUpdate({
        edge: "left",
        originStart: 1,
        originDuration: 2,
        deltaSec: 0.5,
        minDuration: 0.05,
      }),
    ).toEqual({ startTime: 1.5, duration: 1.5 });
  });
});

describe("PointerSessionController commit self-flush", () => {
  it("applies a queued update before commit without an explicit flush", () => {
    let committed: { x: number } | null = null;
    let pending: (() => void) | null = null;
    const scheduler: Scheduler = {
      requestFrame: (callback) => {
        pending = callback;
        return 1;
      },
      cancelFrame: () => {
        pending = null;
      },
    };
    const controller = new PointerSessionController<
      { x: number },
      { x: number }
    >(
      {
        name: "move",
        onStart: (p) => ({ x: p.x }),
        onUpdate: (p) => ({ x: p.x }),
        onCommit: (state) => {
          committed = state;
          return state;
        },
      },
      { coordinator: createInteractionCoordinator(), scheduler },
    );

    expect(controller.start({ x: 0, y: 0 })).toBe(true);
    controller.update({ x: 42, y: 0 });
    // RAF chưa chạy → pending vẫn còn.
    expect(pending).not.toBeNull();

    const result = controller.commit();
    expect(committed).toEqual({ x: 42 });
    expect(result).toEqual({ x: 42 });
    // Pending đã được flush (RAF bị hủy).
    expect(pending).toBeNull();
  });
});
