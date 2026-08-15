import {
  parseMotionProjectV1,
  type AspectRatio,
  type MotionProject,
} from "@motionvideo/motion-protocol";

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export function createBlankProject(input: {
  name: string;
  aspectRatio: AspectRatio;
}): MotionProject {
  const { width, height } = ASPECT_SIZES[input.aspectRatio];
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      locale: "vi-VN",
    },
    composition: {
      width,
      height,
      fps: 30,
      background: "#1A5D3A",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {
      colors: { brand: "#1A5D3A" },
      fonts: { display: "Be Vietnam Pro" },
    },
    variables: [
      { id: "project.brandName", type: "string", name: "Brand Name", value: input.name },
      { id: "project.primaryColor", type: "color", name: "Primary Color", value: "#1A5D3A" },
    ],
    assets: [],
    components: [],
    scenes: [],
    timeline: { visualTracks: [], audioTracks: [], captionTracks: [] },
    bindings: [],
  });
}
