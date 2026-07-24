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
    metadata: {
      ...template.project.metadata,
      id: `proj_${Date.now()}`,
      name: input.brandName,
      aspectRatio: input.aspectRatio ?? template.project.metadata.aspectRatio,
      brand: {
        ...template.project.metadata.brand,
        name: input.brandName,
        primaryColor: input.primaryColor ?? template.project.metadata.brand.primaryColor,
      },
    },
    variables: template.project.variables.map((variable) => {
      if (variable.id === "project.brandName" && variable.type === "string") return { ...variable, value: input.brandName };
      if (variable.id === "project.primaryColor" && variable.type === "color") return { ...variable, value: input.primaryColor ?? template.project.metadata.brand.primaryColor ?? variable.value };
      return variable;
    }),
    scenes: template.project.scenes.map((scene) => ({
      ...scene,
      nodes: scene.nodes.map((node) => {
        if (node.type !== "text") return node;
        const currentText = typeof node.payload?.text === "string" ? node.payload.text : "";
        const text = lines[lineIndex] ?? currentText;
        lineIndex += 1;
        return { ...node, payload: { ...node.payload, text } };
      }),
    })),
  };

  return parseMotionProject(project);
}
