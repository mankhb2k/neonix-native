import { parseMotionProject, type AspectRatio, type MotionProject } from "@motionvideo/motion-schema";

export function createBlankProject(input: {
  name: string;
  aspectRatio: AspectRatio;
}): MotionProject {
  return parseMotionProject({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      aspectRatio: input.aspectRatio,
      fps: 30,
      locale: "vi-VN",
      brand: {
        name: input.name,
        primaryColor: "#1A5D3A",
        fontFamily: "Be Vietnam Pro",
      },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [
      { id: "project.brandName", type: "string", name: "Brand Name", value: input.name },
      { id: "project.primaryColor", type: "color", name: "Primary Color", value: "#1A5D3A" },
    ],
    timeline: { sceneOrder: [], audioTracks: [] },
    scenes: [],
    bindings: [],
    extensions: { constraints: [], events: [] },
  });
}
