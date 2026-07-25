import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";

type SeedNode = {
  id: string;
  type?: "text" | "brand-text";
  text?: string;
  x?: number;
  y?: number;
  preset?: string;
  start?: number;
  duration?: number;
};

type SeedScene = {
  id: string;
  role: "hook" | "pain" | "benefit" | "demo" | "offer" | "cta" | "logo";
  duration: number;
  nodes: SeedNode[];
};

export function createTemplateProject(input: {
  id: string;
  name: string;
  industry: string;
  primaryColor: string;
  scenes: SeedScene[];
}): MotionProject {
  return parseMotionProject({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: input.id,
      name: input.name,
      aspectRatio: "9:16",
      fps: 30,
      locale: "vi-VN",
      industry: input.industry,
      brand: {
        name: "Brand",
        primaryColor: input.primaryColor,
        fontFamily: "Be Vietnam Pro",
      },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [
      { id: "project.brandName", type: "string", name: "Brand Name", value: "Brand" },
      { id: "project.primaryColor", type: "color", name: "Primary Color", value: input.primaryColor },
    ],
    timeline: { sceneOrder: input.scenes.map((scene) => scene.id), audioTracks: [] },
    scenes: input.scenes.map((scene) => ({
      id: scene.id,
      name: scene.role,
      duration: scene.duration,
      semantic: { role: scene.role },
      nodes: scene.nodes.map((node, index) => ({
        id: node.id,
        type: "text" as const,
        parentId: null,
        zIndex: index,
        transform: {
          x: 540 + (node.x ?? 0),
          y: 960 + (node.y ?? 0),
          width: 900,
          height: 180,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: {
          text: node.type === "brand-text" ? "Brand" : (node.text ?? ""),
          fontSize: node.type === "brand-text" ? 72 : 64,
          fontWeight: node.type === "brand-text" ? 700 : 600,
          align: "center" as const,
        },
        semantic: { role: node.type === "brand-text" ? "logo" : "text-content" },
      })),
      clips: scene.nodes.flatMap((node) =>
        node.preset
          ? [{
              id: `clip.${node.id}`,
              targetId: node.id,
              schedule: { kind: "absolute", at: node.start ?? 0 },
              duration: node.duration ?? 0.7,
              source: { kind: "preset", presetId: node.preset },
            }]
          : [],
      ),
    })),
    bindings: [],
    extensions: { constraints: [], events: [] },
  });
}
