import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
import { retrieveTemplates } from "@motionvideo/template-library";

export type PlanInput = {
  brandName: string;
  industry: string;
  script: string;
  tags?: string[];
  aspectRatio?: "9:16" | "16:9" | "1:1";
  primaryColor?: string;
};

/**
 * Stub planner: retrieve template by tags/industry, fill brand + script lines.
 * Replace internals with LLM later; keep output validated by Zod.
 */
export function planMotionProject(input: PlanInput): MotionProject {
  const matched = retrieveTemplates({
    industry: input.industry,
    tags: input.tags,
    limit: 1,
  });
  const [template] =
    matched.length > 0
      ? matched
      : retrieveTemplates({ tags: input.tags, limit: 1 });

  if (!template) {
    throw new Error(`No template found for industry=${input.industry}`);
  }

  const lines = input.script
    .split(/\n|。|\.|!|\?/)
    .map((s) => s.trim())
    .filter(Boolean);

  const project: MotionProject = {
    ...template.project,
    id: `proj_${Date.now()}`,
    aspectRatio: input.aspectRatio ?? template.project.aspectRatio,
    brand: {
      ...template.project.brand,
      name: input.brandName,
      primaryColor: input.primaryColor ?? template.project.brand.primaryColor,
    },
    scenes: template.project.scenes.map((scene, index) => ({
      ...scene,
      layers: scene.layers.map((layer) => {
        if (layer.type !== "text") return layer;
        return {
          ...layer,
          content: lines[index] ?? layer.content,
        };
      }),
    })),
  };

  return parseMotionProject(project);
}
