import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "@/lib/editor/document/demo-projects";
import { createPlaybackControllerV3 } from "../playback-controller-v3";
import type { RuntimeFrameV3 } from "@motionvideo/motion-runtime";

describe("web editor playback adapter", () => {
  it("keeps the editor controller as the web-owned facade over runtime transport", async () => {
    const controller = createPlaybackControllerV3();
    const times: number[] = [];
    const release = controller.registerTimeSink((event) => times.push(event.time));

    controller.loadDocument(createV2EditorProject("shape"), 0);
    expect(controller.snapshot()).toMatchObject({ state: "paused", projectId: "web-editor-shape" });
    expect(controller.duration).toBeGreaterThan(0);

    controller.seek(0.25);
    expect(controller.snapshot().timeUs).toBe(250_000);
    controller.play();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.playing).toBe(true);
    controller.pause();
    expect(controller.playing).toBe(false);
    expect(times).toContain(0.25);

    release();
    controller.dispose();
  });

  it("publishes a transient runtime frame without changing canonical playback state", () => {
    const controller = createPlaybackControllerV3();
    const frames: RuntimeFrameV3[] = [];
    const release = controller.registerFrameSink((event) => frames.push(event.frame));
    const canonical = createV2EditorProject("shape");

    controller.loadDocument(canonical, 0);
    const layer = canonical.layers[0]!;
    const preview = {
      ...canonical,
      layers: canonical.layers.map((candidate) =>
        candidate.id === layer.id
          ? {
              ...candidate,
              transform: {
                ...candidate.transform,
                translate: {
                  ...candidate.transform.translate,
                  x: candidate.transform.translate.x + 120,
                },
              },
            }
          : candidate,
      ),
    };

    controller.setPreviewDocument(preview);
    const previewFrame = frames.at(-1);
    const previewTransform = previewFrame?.commands.find(
      (command) => command.op === "setTransform" && command.layerId === layer.id,
    );
    expect(previewTransform).toMatchObject({ op: "setTransform", layerId: layer.id });
    if (!previewTransform || previewTransform.op !== "setTransform") throw new Error("expected preview transform");

    controller.setPreviewDocument(null);
    const canonicalFrame = frames.at(-1);
    const canonicalTransform = canonicalFrame?.commands.find(
      (command) => command.op === "setTransform" && command.layerId === layer.id,
    );
    expect(canonicalTransform).toMatchObject({ op: "setTransform", layerId: layer.id });
    if (!canonicalTransform || canonicalTransform.op !== "setTransform") throw new Error("expected canonical transform");
    expect(previewTransform.matrix4[12]).not.toBe(canonicalTransform.matrix4[12]);
    expect(controller.snapshot().projectId).toBe("web-editor-shape");

    release();
    controller.dispose();
  });
});
