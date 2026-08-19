import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { packRootLayersToTimeline } from "../timeline/selectors/scene-order-clips";
import { rebuildMainProject } from "../timeline/internal/timeline-project-sync";
import { sanitizeEditorProject } from "../document/sanitize-editor-project";

function textProject() {
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "proj_sync",
      name: "Sync",
      locale: "vi-VN",
    },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#111111",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    assets: [],
    components: [],
    layers: [
      {
        id: "title",
        type: "text",
        parentLayerId: null,
        zIndex: 0,
        opacity: 100,
        frame: { width: 200, height: 80 },
        transform: {
          translate: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotate: { z: 0 },
          skew: { x: 0, y: 0 },
          origin: { x: 0.5, y: 0.5 },
        },
        timing: { start: 0, duration: 4 },
        payload: {
          text: "Hello",
          fontSize: 48,
          color: "#ffffff",
          alignment: "center",
        },
      },
    ],
  });
}

describe("sanitizeEditorProject", () => {
  it("trims blank metadata name to Untitled", () => {
    const project = textProject();
    const next = sanitizeEditorProject({
      ...project,
      metadata: { ...project.metadata, name: "   " },
    });
    expect(next.metadata.name).toBe("Untitled");
  });

  it("uses default shape fill when empty fill string on shape layer", () => {
    const project = textProject();
    const dirty = {
      ...project,
      layers: [
        {
          id: "shape",
          type: "shape" as const,
          parentLayerId: null,
          zIndex: 0,
          opacity: 100,
          frame: { width: 100, height: 100 },
          transform: {
            translate: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotate: { z: 0 },
            skew: { x: 0, y: 0 },
            origin: { x: 0.5, y: 0.5 },
          },
          timing: { start: 0, duration: 4 },
          payload: { shape: "rectangle" },
          style: { fill: "" },
        },
      ],
    };
    const next = sanitizeEditorProject(dirty as typeof project);
    expect(next.layers[0]?.type).toBe("shape");
    if (next.layers[0]?.type !== "shape") return;
    expect(next.layers[0].style?.fill).toBe("#4A90D9");
  });

  it("rebuildMainProject preserves text layer content", () => {
    const project = textProject();
    const packed = packRootLayersToTimeline(project);
    const rebuilt = rebuildMainProject(project, packed.clips, packed.lanes);
    expect(rebuilt.layers.some((layer) => layer.id === "title")).toBe(true);
  });

  it("unwraps library scene wrappers into primitive roots", () => {
    const project = textProject();
    const wrapped = {
      ...project,
      layers: [
        {
          ...project.layers[0]!,
          id: "scene_sq",
          type: "group" as const,
          children: [
            {
              ...project.layers[0]!,
              id: "node_8orfv3y",
              parentLayerId: "scene_sq",
            },
          ],
        },
      ],
    };
    const next = sanitizeEditorProject(wrapped as typeof project);
    expect(next.layers).toHaveLength(1);
    expect(next.layers[0]?.id).toBe("scene_sq");
    expect(next.layers[0]?.type).toBe("text");
  });
});
