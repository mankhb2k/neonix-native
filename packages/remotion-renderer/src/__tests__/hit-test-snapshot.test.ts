import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  buildRenderSnapshot,
  hitTestRenderSnapshot,
} from "@motionvideo/motion-runtime";
import { createDemoMotionProject, DEMO_SCENE_ID } from "@motionvideo/motion-runtime/testing";
import { describe, expect, it } from "vitest";

describe("hitTestRenderSnapshot", () => {
  it("returns drawable hits under a point, top-most first", () => {
    const runtime = compileMotionProject(createDemoMotionProject());
    const scene = runtime.scenes.find((s) => s.id === DEMO_SCENE_ID)!;
    const snapshot = buildRenderSnapshot({
      scene,
      time: 0,
      frame: 0,
      width: 1920,
      height: 1080,
    });

    const title = snapshot.items.find((item) => item.nodeId === "node.title");
    expect(title).toBeTruthy();
    const cx = title!.worldBounds.x + title!.worldBounds.width / 2;
    const cy = title!.worldBounds.y + title!.worldBounds.height / 2;
    const titleHits = hitTestRenderSnapshot(snapshot, { x: cx, y: cy });
    expect(titleHits.some((h) => h.nodeId === "node.title")).toBe(true);
    expect(titleHits[0]!.nodeId).toBe("node.title");

    const dot = snapshot.items.find((item) => item.nodeId === "node.dot")!;
    const dx = dot.worldBounds.x + dot.worldBounds.width / 2;
    const dy = dot.worldBounds.y + dot.worldBounds.height / 2;
    const dotHits = hitTestRenderSnapshot(snapshot, { x: dx, y: dy });
    expect(dotHits[0]!.nodeId).toBe("node.dot");
  });

  it("orders hits by renderOrder descending", () => {
    const runtime = compileMotionProject(createDemoMotionProject());
    const scene = runtime.scenes.find((s) => s.id === DEMO_SCENE_ID)!;
    const snapshot = buildRenderSnapshot({
      scene,
      time: 0,
      frame: 0,
      width: 1920,
      height: 1080,
    });
    const centerHits = hitTestRenderSnapshot(snapshot, { x: 960, y: 520 });
    for (let i = 1; i < centerHits.length; i += 1) {
      expect(centerHits[i - 1]!.renderOrder).toBeGreaterThanOrEqual(
        centerHits[i]!.renderOrder,
      );
    }
  });
});
