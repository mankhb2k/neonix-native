import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { packRootLayersToTimeline } from "../timeline/selectors/scene-order-clips";
import { rebuildMainProject } from "../timeline/internal/timeline-project-sync";
import { syncProjectProtocolContract } from "../document/sync-project-protocol-contract";

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
    capabilities: { required: [] },
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: { colors: { brand: "#111111" }, fonts: { display: "Inter" } },
    variables: [],
    assets: [],
    components: [],
    layers: [
      {
        id: "title",
        type: "text",
        name: "Title",
        parentLayerId: null,
        zIndex: 0,
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
    timeline: { duration: 4 },
    bindings: [],
  });
}

describe("syncProjectProtocolContract", () => {
  it("declares primitive.text when a text layer exists", () => {
    const next = syncProjectProtocolContract(textProject());
    expect(next.capabilities.required).toContain("primitive.text");
  });

  it("drops empty optional name and empty fill", () => {
    const project = textProject();
    const layer = project.layers[0]!;
    const dirty = {
      ...project,
      layers: [{ ...layer, name: "", style: { fill: "" } }],
    };
    const next = syncProjectProtocolContract(dirty);
    expect(next.layers[0]?.name).toBeUndefined();
    const style =
      next.layers[0] && "style" in next.layers[0]
        ? next.layers[0].style
        : undefined;
    expect(style?.fill).toBeUndefined();
  });

  it("rebuildMainProject declares used capabilities", () => {
    const project = textProject();
    const packed = packRootLayersToTimeline(project);
    const rebuilt = rebuildMainProject(project, packed.clips, packed.lanes);
    expect(rebuilt.capabilities.required).toContain("primitive.text");
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
          name: "Hình vuông",
          children: [
            {
              ...project.layers[0]!,
              id: "node_8orfv3y",
              name: "node_8orfv3y",
              parentLayerId: "scene_sq",
            },
          ],
        },
      ],
    };
    const next = syncProjectProtocolContract(wrapped as typeof project);
    expect(next.layers).toHaveLength(1);
    expect(next.layers[0]?.id).toBe("scene_sq");
    expect(next.layers[0]?.type).toBe("text");
    expect(next.layers[0]?.name).toBe("Hình vuông");
  });
});
