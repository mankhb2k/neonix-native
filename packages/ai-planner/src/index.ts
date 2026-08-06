import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
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
import {
  planFromScratch,
  buildCreativePlanFromBrief,
  buildSceneDesignFromPlan,
  buildBlankProjectCommands,
} from "./from-scratch";
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

/** @deprecated Use CreativeBriefV1 + planMotionProject({ brief }) instead. */
export type PlanInput = {
  brandName: string;
  industry: string;
  script: string;
  tags?: string[];
  aspectRatio?: "9:16" | "16:9" | "1:1";
  primaryColor?: string;
};

export type PlanRequest = {
  brief:
    | CreativeBriefV1
    | (Omit<CreativeBriefV1, "format" | "formatVersion"> & {
        format?: "moticlip-creative-brief";
        formatVersion?: 1;
      });
  /** Only from-scratch is supported (zero-template MVP). */
  mode?: "from-scratch";
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

export function briefFromLegacyInput(input: PlanInput): CreativeBriefV1 {
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
 * AI planner entrypoint — zero-template from-scratch only.
 */
export function planMotionProject(input: PlanRequest | PlanInput): PlanResult {
  const request: PlanRequest =
    "brief" in input
      ? input
      : {
          brief: briefFromLegacyInput(input),
          industry: input.industry,
          tags: input.tags,
          mode: "from-scratch",
        };

  const artifacts = planFromScratch({
    brief: request.brief,
    seed: request.seed,
    industry: request.industry,
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
