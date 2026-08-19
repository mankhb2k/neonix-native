import {
  parseMotionProjectV1,
  type AspectRatio,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  createDefaultAuthoringSugar,
  createEmptyEnvelope,
  type WebProjectEnvelope,
} from "./authoring/web-project-envelope";

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
    assets: [],
    components: [],
    layers: [],
  });
}

export function createBlankProjectWithEnvelope(input: {
  name: string;
  aspectRatio: AspectRatio;
}): { project: MotionProject; envelope: WebProjectEnvelope } {
  const project = createBlankProject(input);
  const envelope = createEmptyEnvelope(project.metadata.id);
  envelope.authoring = {
    ...envelope.authoring,
    ...createDefaultAuthoringSugar({ name: input.name }),
  };
  return { project, envelope };
}
