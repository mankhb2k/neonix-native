import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
import { retrieveTemplates, templates } from "@motionvideo/template-library";
import type { CreativeBriefV1, CreativePlanV1, SceneDesignPlanV1 } from "./contracts";
import {
  parseCreativeBriefV1,
  parseCreativePlanV1,
  parseSceneDesignPlanV1,
  serializeCreativeBriefV1,
  serializeCreativePlanV1,
  serializeSceneDesignPlanV1,
} from "./contracts";
import {
  executeCommandBatch,
  createBlankMotionProject,
  parseCommandBatch,
  type CommandBatchResult,
  type CommandReceipt,
  type AuthoringCommand,
  type CommandBatch,
  type Diagnostic,
} from "./commands";
import { planFromScratch, buildCreativePlanFromBrief, buildSceneDesignFromPlan, buildBlankProjectCommands } from "./from-scratch";
export { critiqueProject, applyCriticRepair, type CriticReport, type CriticFinding } from "./critic";
export { buildContactSheetPlan, type ContactSheetPlan, type ContactSheetFrame } from "./contact-sheet";
export { runGenerationLoop, runGenerationLoopAsync, type GenerationLoopResult } from "./generation-loop";
export {
  runZeroTemplateGeneration,
  runScopedRefine,
  type ZeroTemplateGenerationResult,
  type OrchestratorProgress,
  type OrchestratorPhase,
} from "./orchestrator";
export { createModelGateway, StubModelGateway, AnthropicGateway, type ModelGateway } from "./gateway";
export {
  MODEL_ALLOWED_COMMAND_TYPES,
  MODEL_BLOCKED_COMMAND_TYPES,
  isModelAllowedCommand,
  modelCapabilityPromptBlock,
} from "./model-allowlist";
export { probeContactSheetPng, type ProbeContactSheetResult } from "./probe-frames";
export { layoutRecipe, LAYOUT_RECIPES, type LayoutRecipeId } from "./commands/layout-recipes";

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

export type PlanRequest = {
  brief: CreativeBriefV1 | (Omit<CreativeBriefV1, "format" | "formatVersion"> & { format?: "moticlip-creative-brief"; formatVersion?: 1 });
  mode?: "from-scratch" | "template";
  templateId?: string;
  seed?: string;
  industry?: string;
  tags?: string[];
};

export type PlanResult = {
  brief: CreativeBriefV1;
  plan: CreativePlanV1;
  sceneDesign: SceneDesignPlanV1;
  project: MotionProject;
  receipts: CommandReceipt[];
  generation: {
    planId: string;
    seed: string;
    model: string;
    capabilityManifestVersion: string;
  };
};

/**
 * Legacy template-fill path kept for mode:"template".
 */
export function planMotionProjectFromTemplate(input: PlanInput): MotionProject {
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
      if (variable.id === "project.primaryColor" && variable.type === "color") {
        return { ...variable, value: input.primaryColor ?? template.project.metadata.brand.primaryColor ?? variable.value };
      }
      return variable;
    }),
    scenes: template.project.scenes.map((scene) => ({
      ...scene,
      nodes: scene.nodes.map((node) => {
        if (node.type !== "text") return node;
        if (node.semantic?.role === "logo") {
          return { ...node, payload: { ...node.payload, text: input.brandName } };
        }
        const currentText = typeof node.payload?.text === "string" ? node.payload.text : "";
        const text = lines[lineIndex] ?? currentText;
        lineIndex += 1;
        return { ...node, payload: { ...node.payload, text } };
      }),
    })),
  };

  return parseMotionProject(project);
}

function briefFromLegacyInput(input: PlanInput): CreativeBriefV1 {
  return parseCreativeBriefV1({
    format: "moticlip-creative-brief",
    formatVersion: 1,
    objective: input.brandName,
    durationSeconds: 15,
    aspectRatio: input.aspectRatio ?? "9:16",
    script: input.script,
    language: "vi",
    brand: {
      name: input.brandName,
      primaryColor: input.primaryColor,
    },
  });
}

/**
 * AI planner entrypoint.
 * Default mode is from-scratch (typed commands). Pass mode:"template" for optional retrieval prior.
 */
export function planMotionProject(input: PlanRequest | PlanInput): PlanResult | MotionProject {
  if ("brief" in input) {
    const mode = input.mode ?? "from-scratch";
    if (mode === "template") {
      const brief = parseCreativeBriefV1(input.brief);
      const project = planMotionProjectFromTemplate({
        brandName: brief.brand?.name ?? brief.objective.slice(0, 64),
        industry: input.industry ?? "fnb",
        script: brief.script,
        tags: input.tags,
        aspectRatio: brief.aspectRatio,
        primaryColor: brief.brand?.primaryColor,
        templateId: input.templateId,
      });
      const plan = buildCreativePlanFromBrief(brief, input.industry ?? "fnb");
      const seed = input.seed ?? `template_${project.metadata.id}`;
      const planId = `plan_${seed}`;
      return {
        brief,
        plan,
        sceneDesign: buildSceneDesignFromPlan(plan, planId),
        project,
        receipts: [],
        generation: {
          planId,
          seed,
          model: "ai-planner/stub-template@1",
          capabilityManifestVersion: "1",
        },
      };
    }

    const artifacts = planFromScratch({
      brief: input.brief,
      seed: input.seed,
      industry: input.industry,
    });
    if (!artifacts.batchResult.ok || !artifacts.batchResult.project) {
      const errors = artifacts.receipts
        .flatMap((receipt) => receipt.diagnostics)
        .filter((item) => item.severity === "error")
        .map((item) => `${item.code}: ${item.message}`)
        .join("; ");
      throw new Error(`From-scratch planning failed: ${errors || "unknown error"}`);
    }
    return {
      brief: artifacts.brief,
      plan: artifacts.plan,
      sceneDesign: artifacts.sceneDesign,
      project: artifacts.batchResult.project,
      receipts: artifacts.receipts,
      generation: artifacts.generation,
    };
  }

  // Back-compat: legacy PlanInput still returns MotionProject only.
  return planMotionProjectFromTemplate(input);
}

export {
  parseCreativeBriefV1,
  parseCreativePlanV1,
  parseSceneDesignPlanV1,
  serializeCreativeBriefV1,
  serializeCreativePlanV1,
  serializeSceneDesignPlanV1,
  executeCommandBatch,
  createBlankMotionProject,
  parseCommandBatch,
  buildCreativePlanFromBrief,
  buildSceneDesignFromPlan,
  buildBlankProjectCommands,
  planFromScratch,
  briefFromLegacyInput,
};

export type {
  CreativeBriefV1,
  CreativePlanV1,
  SceneDesignPlanV1,
  CommandBatchResult,
  CommandReceipt,
  AuthoringCommand,
  CommandBatch,
  Diagnostic,
};
