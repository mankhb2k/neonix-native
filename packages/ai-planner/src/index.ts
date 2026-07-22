import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
import { retrieveTemplates, templates } from "@motionvideo/template-library";

export type PlanInput = {
  brandName: string;
  industry: string;
  script: string;
  tags?: string[];
  aspectRatio?: "9:16" | "16:9" | "1:1";
  primaryColor?: string;
  /** Explicit template id — preferred when user picks from gallery */
  templateId?: string;
};

/**
 * Stub planner: retrieve template by id/tags/industry, fill brand + script lines.
 * Replace internals with LLM later; keep output validated by Zod.
 */
export function planMotionProject(input: PlanInput): MotionProject {
  let template =
    input.templateId != null
      ? templates.find((t) => t.id === input.templateId)
      : undefined;

  if (!template) {
    const matched = retrieveTemplates({
      industry: input.industry,
      tags: input.tags,
      limit: 1,
    });
    template =
      matched[0] ??
      retrieveTemplates({ tags: input.tags, limit: 1 })[0] ??
      templates[0];
  }

  if (!template) {
    throw new Error(`No template found for industry=${input.industry}`);
  }

  const lines = input.script
    .split(/\n|。|\.|!|\?/)
    .map((s) => s.trim())
    .filter(Boolean);

  let lineIndex = 0;
  const project: MotionProject = {
    ...template.project,
    id: `proj_${Date.now()}`,
    aspectRatio: input.aspectRatio ?? template.project.aspectRatio,
    brand: {
      ...template.project.brand,
      name: input.brandName,
      primaryColor: input.primaryColor ?? template.project.brand.primaryColor,
    },
    scenes: template.project.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => {
        if (layer.type !== "text") return layer;
        const content = lines[lineIndex] ?? layer.content;
        lineIndex += 1;
        return { ...layer, content };
      }),
    })),
  };

  return parseMotionProject(project);
}
