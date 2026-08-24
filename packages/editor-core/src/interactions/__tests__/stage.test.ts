import { describe, expect, it } from "vitest";
import {
  applyMoveDelta,
  applyResizeDelta,
  applyRotateDelta,
  applyMoveConstraints,
  applyRotateConstraints,
  clientToComposition,
  compositionToClient,
  createStageSession,
  hitTestHandle,
  toStagePropertyPatches,
} from "../index";

describe("stage coordinates", () => {
  const metrics = {
    contentLeft: 10,
    contentTop: 20,
    contentWidth: 200,
    contentHeight: 100,
    compositionWidth: 400,
    compositionHeight: 200,
  };

  it("maps client to composition and back", () => {
    const comp = clientToComposition({ x: 110, y: 70 }, metrics);
    expect(comp).toEqual({ x: 200, y: 100 });
    const client = compositionToClient(comp!, metrics);
    expect(client.x).toBeCloseTo(110);
    expect(client.y).toBeCloseTo(70);
  });

  it("returns null outside content", () => {
    expect(clientToComposition({ x: 0, y: 0 }, metrics)).toBeNull();
  });
});

describe("stage transform math", () => {
  const base = {
    rootLayerId: "s",
    layerId: "n",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
  };

  it("moves by pointer delta", () => {
    expect(applyMoveDelta(base, { x: 0, y: 0 }, { x: 5, y: -3 })).toMatchObject(
      { x: 15, y: 17 },
    );
  });

  it("resizes from east handle", () => {
    expect(
      applyResizeDelta(base, "e", { x: 0, y: 0 }, { x: 20, y: 0 }),
    ).toMatchObject({ width: 120, x: 10 });
  });

  it("resizes from west and shifts x", () => {
    expect(
      applyResizeDelta(base, "w", { x: 0, y: 0 }, { x: 20, y: 0 }),
    ).toMatchObject({ width: 80, x: 30 });
  });

  it("resizes from the center when Alt is held", () => {
    expect(
      applyResizeDelta(base, "e", { x: 0, y: 0 }, { x: 20, y: 0 }, 8, true),
    ).toMatchObject({ width: 140, x: -10 });
  });

  it("keeps resize values finite", () => {
    expect(
      applyResizeDelta(base, "se", { x: 0, y: 0 }, { x: Number.NaN, y: Number.POSITIVE_INFINITY }),
    ).toMatchObject({ x: 10, y: 20, width: 100, height: 50 });
  });

  it("rotates around center", () => {
    const next = applyRotateDelta(base, { x: 110, y: 45 }, { x: 10, y: 45 });
    expect(next.rotation).toBeCloseTo(180, 0);
  });

  it("rotates around an explicit anchor pivot without wrapping", () => {
    const next = applyRotateDelta(
      { ...base, rotation: 350, pivotX: 60, pivotY: 45 },
      { x: 60, y: 15 },
      { x: 90, y: 45 },
    );
    expect(next.rotation).toBeCloseTo(440, 0);
  });

  it("supports counter-clockwise rotation", () => {
    const next = applyRotateDelta(base, { x: 60, y: 15 }, { x: 30, y: 45 });
    expect(next.rotation).toBeCloseTo(-90, 0);
  });

  it("snaps rotation to 45 degree increments only when enabled", () => {
    const value = { ...base, rotation: 43 };
    expect(applyRotateConstraints(value, { snapAngle: true, snapThreshold: 6 }).values.rotation).toBe(45);
    expect(applyRotateConstraints(value, { snapAngle: false, snapThreshold: 6 }).values.rotation).toBe(43);
  });
});

describe("stage constraints", () => {
  it("snaps move to guides", () => {
    const { values, guides } = applyMoveConstraints(
      {
        rootLayerId: "s",
        layerId: "n",
        x: 52,
        y: 10,
        width: 10,
        height: 10,
        rotation: 0,
      },
      { snapEdgesX: [50], snapThreshold: 4 },
    );
    expect(values.x).toBe(50);
    expect(guides).toEqual([{ kind: "vline", x: 50 }]);
  });
});

describe("transform handles", () => {
  it("hits corner handles", () => {
    const box = { x: 0, y: 0, width: 100, height: 80, rotation: 0 };
    expect(hitTestHandle(box, { x: 0, y: 0 }, 8)).toBe("nw");
    expect(hitTestHandle(box, { x: 100, y: 80 }, 8)).toBe("se");
    expect(hitTestHandle(box, { x: 50, y: -24 }, 8)).toBe("rotate");
  });
});

describe("createStageSession", () => {
  it("previews move and commits transform command", () => {
    const session = createStageSession();
    const previews: unknown[] = [];
    const base = {
      rootLayerId: "scene",
      layerId: "node",
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      rotation: 0,
    };
    session.beginMove(
      {
        interactionId: "i1",
        base,
        worldBounds: { x: 100, y: 50, width: 40, height: 20 },
        pointer: { x: 0, y: 0 },
      },
      {
        onPreview: (p) => {
          previews.push(p);
        },
      },
    );
    session.updatePointer({ x: 10, y: 5 });
    const commit = session.commit("pointerup");
    expect(commit?.patches[0]?.values).toMatchObject({ x: 10, y: 5 });
    expect(commit?.command).toMatchObject({
      type: "set-node-transform",
      patch: { x: 10, y: 5 },
    });
    expect(session.mode).toBe("idle");
    expect(previews.length).toBeGreaterThan(1);
  });

  it("previews resize and preserves the opposite edge", () => {
    const session = createStageSession();
    const base = {
      rootLayerId: "scene",
      layerId: "node",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
    };
    session.beginResize(
      {
        interactionId: "resize-1",
        base,
        worldBounds: { x: 10, y: 20, width: 100, height: 50 },
        pointer: { x: 0, y: 0 },
        handle: "w",
      },
      { onPreview: () => undefined },
    );
    session.updatePointer({ x: 20, y: 0 });
    const commit = session.commit("pointerup");
    expect(commit?.patches[0]?.values).toMatchObject({ x: 30, width: 80 });
    expect(commit?.patches[0]?.sizePatch).toEqual({ width: 80, height: 50 });
  });

  it("keeps aspect ratio and center when Shift+Alt are held", () => {
    const session = createStageSession();
    const base = {
      rootLayerId: "scene",
      layerId: "node",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
    };
    session.beginResize(
      {
        interactionId: "resize-2",
        base,
        worldBounds: { x: 10, y: 20, width: 100, height: 50 },
        pointer: { x: 0, y: 0 },
        handle: "e",
      },
      { onPreview: () => undefined },
    );
    session.updatePointer({ x: 10, y: 0 }, { shift: true, alt: true });
    const commit = session.commit("pointerup");
    expect(commit?.patches[0]?.values).toMatchObject({
      x: 0,
      y: 15,
      width: 120,
      height: 60,
    });
  });

  it("snaps a rotate session to 45 degrees with Shift", () => {
    const session = createStageSession();
    const rotateBase = {
      rootLayerId: "scene",
      layerId: "node",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
    };
    session.beginRotate(
      {
        interactionId: "rotate-1",
        base: rotateBase,
        worldBounds: { x: 10, y: 20, width: 100, height: 50 },
        pointer: { x: 60, y: 15 },
        constraints: { snapThreshold: 6 },
      },
      { onPreview: () => undefined },
    );
    session.updatePointer({ x: 80, y: 23 }, { shift: true });
    const commit = session.commit("pointerup");
    expect(commit?.patches[0]?.values.rotation).toBe(45);
    expect(commit?.command).toMatchObject({ patch: { rotation: 45 } });
  });

  it("cancels without command", () => {
    const session = createStageSession();
    session.beginRotate(
      {
        interactionId: "i2",
        base: {
          rootLayerId: "s",
          layerId: "n",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
        },
        worldBounds: { x: 0, y: 0, width: 10, height: 10 },
        pointer: { x: 20, y: 5 },
      },
      { onPreview: () => undefined },
    );
    session.cancel();
    expect(session.commit()).toBeNull();
  });
});

describe("toStagePropertyPatches", () => {
  it("includes sizePatch when dimensions change", () => {
    const base = {
      rootLayerId: "s",
      layerId: "n",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
    };
    const preview = { ...base, width: 30 };
    const patches = toStagePropertyPatches(base, preview);
    expect(patches[0]?.sizePatch).toEqual({ width: 30, height: 10 });
  });
});
