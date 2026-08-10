import type { CreativeBriefV1 } from "./contracts";
import { executeCommandBatch, type CommandBatchResult } from "./commands";
import { planFromScratch } from "./from-scratch";
import { applyCriticRepair, critiqueProject, type CriticReport } from "./critic";
import { buildContactSheetPlan, type ContactSheetPlan } from "./contact-sheet";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { runZeroTemplateGeneration, type ZeroTemplateGenerationResult } from "./orchestrator";

export type GenerationLoopResult = {
  project: MotionProject;
  critic: CriticReport;
  contactSheet: ContactSheetPlan;
  repairs: number;
  receipts: CommandBatchResult["receipts"];
  ok: boolean;
};

/**
 * Deterministic planner → critic → repair loop with budget (R7).
 * No LLM required; uses stub from-scratch assembler.
 */
export function runGenerationLoop(input: {
  brief: CreativeBriefV1;
  seed?: string;
  industry?: string;
  maxRepairs?: number;
  timeoutMs?: number;
}): GenerationLoopResult {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 5_000;
  const maxRepairs = input.maxRepairs ?? 3;
  const planned = planFromScratch({
    brief: input.brief,
    seed: input.seed,
    industry: input.industry,
  });
  if (!planned.batchResult.ok || !planned.batchResult.project) {
    throw new Error(
      `from-scratch failed: ${planned.batchResult.receipts.flatMap((r) => r.diagnostics.map((d) => d.message)).join("; ")}`,
    );
  }
  let project = planned.batchResult.project;
  let receipts = planned.receipts;
  let repairs = 0;

  // Apply layout + entrance recipes via a follow-up batch
  const recipeCommands = project.scenes.flatMap((scene) => {
    const textIds = scene.nodes.filter((node) => node.type === "text").map((node) => node.id);
    if (textIds.length === 0) return [];
    const commands = [];
    if (textIds.length >= 2) {
      commands.push({
        type: "applyRecipe" as const,
        sceneId: scene.id,
        recipeId: "stagger" as const,
        targetNodeId: textIds[0]!,
        staggerNodeIds: textIds,
        duration: Math.min(1.2, scene.duration),
      });
    } else {
      commands.push({
        type: "applyRecipe" as const,
        sceneId: scene.id,
        recipeId: "float" as const,
        targetNodeId: textIds[0]!,
        duration: scene.duration,
        intensity: 0.6,
      });
    }
    return commands;
  });

  if (recipeCommands.length > 0) {
    const batch = executeCommandBatch(
      {
        format: "moticlip-command-batch",
        formatVersion: 1,
        baseRevision: receipts.at(-1)?.revision ?? 0,
        commands: recipeCommands,
      },
      project,
    );
    receipts = [...receipts, ...batch.receipts];
    if (batch.ok && batch.project) project = batch.project;
  }

  let critic = critiqueProject(project);
  while (repairs < maxRepairs && Date.now() - started < timeoutMs) {
    const actionable = critic.findings.find(
      (finding) =>
        finding.code === "text_overflow" ||
        finding.code === "missing_cta" ||
        finding.code === "empty_scene",
    );
    if (!actionable) break;
    const before = critic.score;
    project = applyCriticRepair(project, actionable);
    repairs += 1;
    critic = critiqueProject(project);
    if (critic.score <= before) break;
  }

  const contactSheet = buildContactSheetPlan(project);
  return {
    project,
    critic,
    contactSheet,
    repairs,
    receipts,
    ok: critic.findings.every((finding) => finding.severity !== "error"),
  };
}

/** Async zero-template loop via ModelGateway (stub or live). */
export async function runGenerationLoopAsync(input: {
  brief: CreativeBriefV1;
  seed?: string;
  industry?: string;
  maxModelRepairs?: number;
  probeFrames?: boolean;
}): Promise<ZeroTemplateGenerationResult> {
  return runZeroTemplateGeneration(input);
}
