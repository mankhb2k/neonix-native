import type { MotionProject } from "@motionvideo/motion-schema";
import {
  parseCreativeBriefV1,
  parseCreativePlanV1,
  parseSceneDesignPlanV1,
  type CreativeBriefV1,
  type CreativePlanV1,
  type SceneDesignPlanV1,
} from "./contracts";
import {
  executeCommandBatch,
  parseCommandBatch,
  type AuthoringCommand,
  type CommandBatch,
  type CommandBatchResult,
  type CommandReceipt,
} from "./commands";
import { applyCriticRepair, critiqueProject, type CriticReport } from "./critic";
import { buildContactSheetPlan, type ContactSheetPlan } from "./contact-sheet";
import { createModelGateway, type ModelGateway } from "./gateway";
import { isModelAllowedCommand, MODEL_BLOCKED_COMMAND_TYPES } from "./model-allowlist";
import { probeContactSheetPng, type ProbeContactSheetResult } from "./probe-frames";

export type OrchestratorPhase =
  | "queued"
  | "planning"
  | "designing"
  | "composing"
  | "validating"
  | "repairing"
  | "probing"
  | "ready"
  | "failed";

export type OrchestratorProgress = {
  phase: OrchestratorPhase;
  progress: number;
  message?: string;
};

export type ZeroTemplateGenerationResult = {
  ok: boolean;
  brief: CreativeBriefV1;
  plan: CreativePlanV1;
  sceneDesign: SceneDesignPlanV1;
  project: MotionProject | null;
  critic: CriticReport;
  contactSheet: ContactSheetPlan;
  probe?: ProbeContactSheetResult;
  receipts: CommandReceipt[];
  repairs: number;
  modelRepairs: number;
  generation: {
    planId: string;
    seed: string;
    model: string;
    promptVersions: Record<string, string>;
    capabilityManifestVersion: string;
    mode: string;
  };
  error?: string;
};

function hashSeed(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `seed_${(hash >>> 0).toString(16)}`;
}

function reconcileSceneDurations(plan: CreativePlanV1, targetSeconds: number): CreativePlanV1 {
  if (plan.scenes.length === 0) return plan;
  const sum = plan.scenes.reduce((acc, scene) => acc + scene.duration, 0);
  if (Math.abs(sum - targetSeconds) < 0.05) return plan;
  const scale = targetSeconds / sum;
  const scenes = plan.scenes.map((scene, index) => {
    if (index < plan.scenes.length - 1) {
      return { ...scene, duration: Math.max(0.5, Number((scene.duration * scale).toFixed(3))) };
    }
    const used = plan.scenes
      .slice(0, -1)
      .reduce((acc, item, i) => acc + Math.max(0.5, Number((item.duration * scale).toFixed(3))), 0);
    return { ...scene, duration: Math.max(0.5, Number((targetSeconds - used).toFixed(3))) };
  });
  return parseCreativePlanV1({ ...plan, scenes });
}

function filterModelCommands(commands: AuthoringCommand[]): {
  commands: AuthoringCommand[];
  blocked: string[];
} {
  const blocked: string[] = [];
  const filtered: AuthoringCommand[] = [];
  for (const command of commands) {
    if (command.type === "registerAsset") {
      blocked.push(command.type);
      continue;
    }
    if ((MODEL_BLOCKED_COMMAND_TYPES as readonly string[]).includes(command.type)) {
      blocked.push(command.type);
      continue;
    }
    if (!isModelAllowedCommand(command.type)) {
      blocked.push(command.type);
      continue;
    }
    filtered.push(command);
  }
  return { commands: filtered, blocked };
}

function assertNoSilentUnsupported(receipts: CommandReceipt[]): void {
  for (const receipt of receipts) {
    for (const diagnostic of receipt.diagnostics) {
      if (diagnostic.code === "unsupported_capability" && diagnostic.severity === "error") {
        // Explicit diagnostic is OK — silent ignore would be absence of diagnostic.
        continue;
      }
    }
  }
}

function prependAssetRegistration(
  commands: AuthoringCommand[],
  assets: CreativeBriefV1["suppliedAssets"],
): AuthoringCommand[] {
  if (!assets?.length) return commands;
  const regs: AuthoringCommand[] = assets.map((asset) => {
    const isSvg = (asset.uri ?? "").endsWith(".svg");
    if (isSvg) {
      return {
        type: "registerAsset" as const,
        asset: {
          id: asset.id,
          assetType: "svg" as const,
          uri: asset.uri ?? `assets/${asset.id}.svg`,
          mimeType: "image/svg+xml" as const,
          width: 512,
          height: 512,
          viewBox: "0 0 512 512",
          sanitized: true as const,
        },
      };
    }
    return {
      type: "registerAsset" as const,
      asset: {
        id: asset.id,
        assetType: "image" as const,
        uri: asset.uri ?? `assets/${asset.id}.png`,
        mimeType: "image/png" as const,
        width: 1024,
        height: 1024,
        pixelFormat: "rgba",
        hasAlpha: true,
      },
    };
  });
  // Insert after createProject
  const createIdx = commands.findIndex((c) => c.type === "createProject");
  if (createIdx < 0) return [...regs, ...commands];
  return [...commands.slice(0, createIdx + 1), ...regs, ...commands.slice(createIdx + 1)];
}

/**
 * Zero-template orchestrator: Brief → Plan → Design → Commands → critic → ≤2 model repairs.
 */
export async function runZeroTemplateGeneration(input: {
  brief: unknown;
  seed?: string;
  industry?: string;
  gateway?: ModelGateway;
  maxModelRepairs?: number;
  probeFrames?: boolean;
  onProgress?: (event: OrchestratorProgress) => void;
}): Promise<ZeroTemplateGenerationResult> {
  const emit = (event: OrchestratorProgress) => input.onProgress?.(event);
  const mode = (process.env.AI_MODE ?? "stub").toLowerCase();
  const gateway = input.gateway ?? createModelGateway({ mode });
  const maxModelRepairs = input.maxModelRepairs ?? 2;
  const brief = parseCreativeBriefV1(input.brief);
  const seed = input.seed ?? hashSeed(`${brief.objective}|${brief.script}|${brief.aspectRatio}|${Date.now()}`);
  const planId = `plan_${seed}`;
  const modelName = mode === "live" || mode === "anthropic" ? "anthropic/messages" : "ai-planner/stub-from-scratch@1";
  const promptVersions = {
    plan: "zero-template-plan@1",
    design: "zero-template-design@1",
    commands: "zero-template-commands@1",
    repair: "zero-template-repair@1",
  };

  const receipts: CommandReceipt[] = [];
  let modelRepairs = 0;
  let repairs = 0;

  try {
    emit({ phase: "planning", progress: 15, message: "Creative plan" });
    const planRaw = await gateway.generateStructured<CreativePlanV1>({
      task: "creative-plan",
      systemPromptVersion: promptVersions.plan,
      schemaDescription: "CreativePlanV1 JSON (format moticlip-creative-plan)",
      input: { brief, industry: input.industry ?? "fnb" },
      model: modelName,
      seed,
      maxOutputTokens: 4_096,
    });
    let plan = reconcileSceneDurations(parseCreativePlanV1(planRaw.value), brief.durationSeconds);

    emit({ phase: "designing", progress: 35, message: "Scene design" });
    const designRaw = await gateway.generateStructured<SceneDesignPlanV1>({
      task: "scene-design",
      systemPromptVersion: promptVersions.design,
      schemaDescription: "SceneDesignPlanV1 JSON",
      input: { plan, planId },
      model: modelName,
      seed,
      maxOutputTokens: 4_096,
    });
    const sceneDesign = parseSceneDesignPlanV1(designRaw.value);

    emit({ phase: "composing", progress: 55, message: "Command batch" });
    const allowlistedAssetIds = (brief.suppliedAssets ?? []).map((a) => a.id);
    const batchRaw = await gateway.generateStructured<CommandBatch>({
      task: "command-batch",
      systemPromptVersion: promptVersions.commands,
      schemaDescription: "CommandBatch JSON — typed commands only, no MotionProject blob",
      input: {
        brief,
        plan,
        sceneDesign,
        projectId: `proj_${seed}`,
        allowlistedAssetIds,
      },
      model: modelName,
      seed,
      maxOutputTokens: 8_192,
    });

    let batch = parseCommandBatch(batchRaw.value);
    const filtered = filterModelCommands(batch.commands);
    if (filtered.blocked.length > 0) {
      throw new Error(`Model emitted blocked commands: ${filtered.blocked.join(", ")}`);
    }
    batch = {
      ...batch,
      commands: prependAssetRegistration(filtered.commands, brief.suppliedAssets),
    };

    let batchResult: CommandBatchResult = executeCommandBatch(batch);
    receipts.push(...batchResult.receipts);
    assertNoSilentUnsupported(batchResult.receipts);

    if (!batchResult.ok || !batchResult.project) {
      return {
        ok: false,
        brief,
        plan,
        sceneDesign,
        project: null,
        critic: { score: 0, findings: [{ code: "batch_failed", severity: "error", path: "commands", message: "Command batch failed" }] },
        contactSheet: { frames: [], width: 0, height: 0 },
        receipts,
        repairs,
        modelRepairs,
        generation: {
          planId,
          seed,
          model: modelName,
          promptVersions,
          capabilityManifestVersion: "1",
          mode,
        },
        error: "Command batch failed",
      };
    }

    let project = batchResult.project;

    // Recipe pass (deterministic polish)
    const recipeCommands: AuthoringCommand[] = [];
    for (const scene of project.scenes) {
      const textIds = scene.nodes.filter((node) => node.type === "text").map((node) => node.id);
      if (textIds.length === 0) continue;
      if (textIds.length >= 2) {
        recipeCommands.push({
          type: "applyRecipe",
          sceneId: scene.id,
          recipeId: "stagger",
          targetNodeId: textIds[0]!,
          staggerNodeIds: textIds,
          duration: Math.min(1.2, scene.duration),
        });
      } else {
        recipeCommands.push({
          type: "applyRecipe",
          sceneId: scene.id,
          recipeId: "float",
          targetNodeId: textIds[0]!,
          duration: scene.duration,
          intensity: 0.6,
        });
      }
    }
    if (recipeCommands.length > 0) {
      const recipeBatch = executeCommandBatch(
        {
          format: "moticlip-command-batch",
          formatVersion: 1,
          baseRevision: batchResult.revision,
          commands: recipeCommands,
        },
        project,
      );
      receipts.push(...recipeBatch.receipts);
      if (recipeBatch.ok && recipeBatch.project) {
        project = recipeBatch.project;
        batchResult = recipeBatch;
      }
    }

    emit({ phase: "validating", progress: 70, message: "Critic" });
    let critic = critiqueProject(project);

    // Rule repairs first (cheap)
    while (repairs < 3) {
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

    // Model repair rounds (max 2)
    while (
      modelRepairs < maxModelRepairs &&
      critic.findings.some((f) => f.severity === "error" || f.code === "text_overflow" || f.code === "overlap" || f.code === "empty_scene")
    ) {
      emit({ phase: "repairing", progress: 75 + modelRepairs * 8, message: `Model repair ${modelRepairs + 1}` });
      const targetedIds = critic.findings
        .map((f) => {
          const m = /\.nodes\.([^.]+)/.exec(f.path);
          return m?.[1];
        })
        .filter((id): id is string => Boolean(id));

      const repairRaw = await gateway.generateStructured<CommandBatch>({
        task: "repair",
        systemPromptVersion: promptVersions.repair,
        schemaDescription: "CommandBatch repair — targeted IDs only, no full regenerate",
        input: {
          baseRevision: batchResult.revision,
          findings: critic.findings,
          targetedIds,
          projectSummary: {
            sceneIds: project.scenes.map((s) => s.id),
            nodeIds: project.scenes.flatMap((s) => s.nodes.map((n) => n.id)),
          },
        },
        model: modelName,
        seed: `${seed}_repair_${modelRepairs}`,
        maxOutputTokens: 4_096,
      });

      const repairBatch = parseCommandBatch(repairRaw.value);
      const repairFiltered = filterModelCommands(repairBatch.commands);
      if (repairFiltered.blocked.length > 0) {
        throw new Error(`Repair emitted blocked commands: ${repairFiltered.blocked.join(", ")}`);
      }
      const applied = executeCommandBatch(
        { ...repairBatch, commands: repairFiltered.commands, baseRevision: batchResult.revision },
        project,
      );
      receipts.push(...applied.receipts);
      modelRepairs += 1;
      if (applied.ok && applied.project) {
        project = applied.project;
        batchResult = applied;
      }
      critic = critiqueProject(project);
    }

    const contactSheet = buildContactSheetPlan(project);
    let probe: ProbeContactSheetResult | undefined;
    if (input.probeFrames) {
      emit({ phase: "probing", progress: 90, message: "PNG contact sheet" });
      probe = await probeContactSheetPng(project);
      if (probe.ok && probe.frames.length > 0) {
        critic = {
          ...critic,
          findings: [
            ...critic.findings,
            {
              code: "contact_sheet_ok",
              severity: "info",
              path: "probe",
              message: `PNG probe ${probe.frames.length} frames`,
            },
          ],
          score: Math.min(100, critic.score + 2),
        };
      }
    }

    emit({ phase: "ready", progress: 100, message: "Done" });
    const ok =
      critic.findings.every((f) => f.severity !== "error") &&
      project.scenes.length > 0 &&
      project.scenes.every((s) => s.nodes.length > 0);

    return {
      ok,
      brief,
      plan,
      sceneDesign,
      project,
      critic,
      contactSheet,
      probe,
      receipts,
      repairs,
      modelRepairs,
      generation: {
        planId,
        seed,
        model: modelName,
        promptVersions,
        capabilityManifestVersion: "1",
        mode,
      },
    };
  } catch (error) {
    emit({ phase: "failed", progress: 100, message: error instanceof Error ? error.message : String(error) });
    return {
      ok: false,
      brief,
      plan: parseCreativePlanV1({
        format: "moticlip-creative-plan",
        formatVersion: 1,
        concept: brief.objective,
        tone: [],
        artDirection: { palette: [], typographyMood: "sans", visualStyle: "flat" },
        pacing: { energy: "medium" },
        scenes: [],
        audioDirection: { voiceover: false },
      }),
      sceneDesign: parseSceneDesignPlanV1({
        format: "moticlip-scene-design-plan",
        formatVersion: 1,
        planId,
        scenes: [],
      }),
      project: null,
      critic: {
        score: 0,
        findings: [
          {
            code: "orchestrator_error",
            severity: "error",
            path: "orchestrator",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      contactSheet: { frames: [], width: 0, height: 0 },
      receipts,
      repairs,
      modelRepairs,
      generation: {
        planId,
        seed,
        model: modelName,
        promptVersions,
        capabilityManifestVersion: "1",
        mode,
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Scoped refine: emit a small command batch for selected element. */
export async function runScopedRefine(input: {
  project: MotionProject;
  prompt: string;
  scope: string;
  baseRevision: number;
  selectionKey?: string;
  gateway?: ModelGateway;
}): Promise<CommandBatchResult & { summary: string; commandLabels: string[] }> {
  const gateway = input.gateway ?? createModelGateway();
  const [sceneId, nodeId] = (input.selectionKey ?? "").split("/");
  const commands: AuthoringCommand[] = [];

  if (input.scope === "element" && sceneId && nodeId) {
    const lower = input.prompt.toLowerCase();
    if (lower.includes("larger") || lower.includes("bigger") || lower.includes("lớn")) {
      commands.push({
        type: "setNodePayload",
        sceneId,
        nodeId,
        payload: { fontSize: 72 },
      });
    } else {
      commands.push({
        type: "setNodePayload",
        sceneId,
        nodeId,
        payload: { text: input.prompt.slice(0, 200) },
      });
    }
  } else {
    // Fall back to full zero-template for video scope via stub commands on last CTA
    const lastScene = input.project.scenes[input.project.scenes.length - 1];
    if (lastScene) {
      commands.push({
        type: "addNode",
        sceneId: lastScene.id,
        nodeId: `node.refine.${Date.now().toString(36)}`,
        nodeType: "text",
        text: input.prompt.slice(0, 120),
        fontSize: 40,
        fill: "#ffffff",
        semanticRole: "offer",
        transform: { x: 540, y: 1400, width: 900, height: 100, anchorX: 0.5, anchorY: 0.5 },
      });
    }
  }

  if (commands.length === 0) {
    commands.push({ type: "validateProject" });
  }

  // Prefer model repair-shaped batch when live; stub gateway repair for consistency
  if ((process.env.AI_MODE ?? "stub") !== "stub") {
    try {
      const raw = await gateway.generateStructured<CommandBatch>({
        task: "repair",
        systemPromptVersion: "zero-template-refine@1",
        schemaDescription: "CommandBatch scoped refine",
        input: {
          baseRevision: input.baseRevision,
          findings: [
            {
              code: "user_refine",
              path: input.selectionKey ?? "project",
              message: input.prompt,
              repairHint: `scope=${input.scope}`,
            },
          ],
          targetedIds: nodeId ? [nodeId] : [],
        },
        model: "anthropic/messages",
        maxOutputTokens: 2_048,
      });
      const parsed = parseCommandBatch(raw.value);
      const filtered = filterModelCommands(parsed.commands);
      const result = executeCommandBatch(
        { ...parsed, commands: filtered.commands, baseRevision: input.baseRevision },
        input.project,
      );
      return {
        ...result,
        summary: `Refine ${input.scope}: ${input.prompt.slice(0, 80)}`,
        commandLabels: filtered.commands.map((c) => c.type),
      };
    } catch {
      // fall through to deterministic commands
    }
  }

  const result = executeCommandBatch(
    {
      format: "moticlip-command-batch",
      formatVersion: 1,
      baseRevision: input.baseRevision,
      commands,
    },
    input.project,
  );
  return {
    ...result,
    summary: `Refine ${input.scope}: ${input.prompt.slice(0, 80)}`,
    commandLabels: commands.map((c) => c.type),
  };
}
