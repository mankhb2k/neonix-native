import { getGrammarForIndustry, grammarPatterns } from "./planning/grammar";
import { CAPABILITY_MANIFEST_VERSION } from "@motionvideo/motion-runtime";
import type { CreativeBriefV1, CreativePlanV1, SceneBrief, SceneDesignPlanV1 } from "./contracts";
import { parseCreativeBriefV1, parseCreativePlanV1, parseSceneDesignPlanV1 } from "./contracts";
import type { AuthoringCommand, CommandBatchResult, CommandReceipt } from "./commands";
import { executeCommandBatch } from "./commands";

const AI_MAX_SCENES_DEFAULT = 6;

function hashSeed(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `seed_${(hash >>> 0).toString(16)}`;
}

function splitScriptLines(script: string): string[] {
  return script
    .split(/\n|。|\.|!|\?/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapGrammarRole(role: string): SceneBrief["role"] {
  if (role === "pain") return "problem";
  if (
    role === "hook" ||
    role === "problem" ||
    role === "benefit" ||
    role === "demo" ||
    role === "proof" ||
    role === "offer" ||
    role === "cta" ||
    role === "logo"
  ) {
    return role;
  }
  return "hook";
}

function layoutForRole(role: SceneBrief["role"]): SceneBrief["layoutIntent"] {
  switch (role) {
    case "cta":
      return { kind: "cta", safeArea: "tiktok" };
    case "offer":
    case "proof":
      return { kind: "centered" };
    case "demo":
      return { kind: "split" };
    case "logo":
      return { kind: "hero" };
    default:
      return { kind: "hero", safeArea: "tiktok" };
  }
}

export function buildCreativePlanFromBrief(brief: CreativeBriefV1, industry = "fnb"): CreativePlanV1 {
  const lines = splitScriptLines(brief.script);
  const maxScenes = brief.constraints?.maxScenes ?? AI_MAX_SCENES_DEFAULT;
  const patterns = getGrammarForIndustry(industry);
  const pattern = patterns[0] ?? grammarPatterns[0]!;
  const roles = pattern.roles.slice(0, maxScenes).map(mapGrammarRole);
  const sceneCount = Math.max(1, Math.min(roles.length, Math.max(lines.length, 1), maxScenes));
  const durationEach = brief.durationSeconds / sceneCount;

  const scenes: SceneBrief[] = Array.from({ length: sceneCount }, (_, index) => {
    const role = roles[index] ?? (index === sceneCount - 1 && brief.constraints?.mustIncludeCta ? "cta" : "hook");
    const copy = lines[index] ?? lines[lines.length - 1] ?? brief.objective;
    const semanticKey = `${role}.copy`;
    return {
      id: `scene.${role}.${index + 1}`,
      role,
      duration: Math.max(0.5, Number(durationEach.toFixed(3))),
      onScreenCopy: [copy],
      visualConcept: `${role} scene for ${brief.objective}`.slice(0, 1_000),
      layoutIntent: layoutForRole(role),
      motionIntents: [
        {
          type: "entrance",
          target: { kind: "semantic", key: semanticKey },
          style: role === "cta" ? "pop" : "fade-up",
          intensity: 0.75,
        },
      ],
      assetRequests: [],
    };
  });

  if (brief.constraints?.mustIncludeCta && !scenes.some((scene) => scene.role === "cta")) {
    const last = scenes[scenes.length - 1]!;
    last.role = "cta";
    last.layoutIntent = layoutForRole("cta");
  }

  return parseCreativePlanV1({
    format: "moticlip-creative-plan",
    formatVersion: 1,
    concept: brief.objective,
    tone: ["clear", "direct"],
    artDirection: {
      palette: brief.brand?.primaryColor ? [brief.brand.primaryColor, "#111111", "#FFFFFF"] : ["#111111", "#FFFFFF"],
      typographyMood: "bold sans",
      visualStyle: "flat kinetic",
    },
    pacing: { energy: "medium" },
    scenes,
    audioDirection: { voiceover: false },
  });
}

export function buildSceneDesignFromPlan(plan: CreativePlanV1, planId: string): SceneDesignPlanV1 {
  return parseSceneDesignPlanV1({
    format: "moticlip-scene-design-plan",
    formatVersion: 1,
    planId,
    scenes: plan.scenes.map((scene) => ({
      sceneBriefId: scene.id,
      layout: scene.layoutIntent,
      layers: scene.onScreenCopy.map((_, copyIndex) => ({
        id: `node.${scene.id}.${copyIndex}`,
        semanticKey: `${scene.role}.copy`,
        nodeHint: "text" as const,
        copyIndex,
      })),
    })),
  });
}

export function buildBlankProjectCommands(input: {
  brief: CreativeBriefV1;
  plan: CreativePlanV1;
  sceneDesign: SceneDesignPlanV1;
  projectId: string;
}): AuthoringCommand[] {
  const { brief, plan, sceneDesign, projectId } = input;
  const commands: AuthoringCommand[] = [
    {
      type: "createProject",
      projectId,
      name: brief.brand?.name ?? brief.objective.slice(0, 64),
      aspectRatio: brief.aspectRatio,
      brandName: brief.brand?.name ?? "Brand",
      primaryColor: brief.brand?.primaryColor,
    },
    {
      type: "setArtDirection",
      brandName: brief.brand?.name,
      primaryColor: brief.brand?.primaryColor ?? plan.artDirection.palette?.[0],
      secondaryColor: brief.brand?.secondaryColor ?? plan.artDirection.palette?.[1],
      fontFamily: brief.brand?.fontFamily,
      projectName: brief.brand?.name ?? brief.objective.slice(0, 64),
    },
  ];

  for (const scene of plan.scenes) {
    commands.push({
      type: "addScene",
      sceneId: scene.id,
      duration: scene.duration,
      name: scene.role,
    });
  }

  for (const design of sceneDesign.scenes) {
    const briefScene = plan.scenes.find((scene) => scene.id === design.sceneBriefId);
    if (!briefScene) continue;
    const groupId = `group.${design.sceneBriefId}`;
    if (design.layers.length > 1) {
      commands.push({
        type: "addNode",
        sceneId: design.sceneBriefId,
        layerId: groupId,
        nodeType: "group",
        transform: {
          x: brief.aspectRatio === "16:9" ? 80 : 60,
          y: brief.aspectRatio === "9:16" ? 220 : 120,
          width: brief.aspectRatio === "16:9" ? 1760 : 960,
          height: 800,
          anchorX: 0,
          anchorY: 0,
        },
      });
      commands.push({
        type: "setLayoutConstraint",
        sceneId: design.sceneBriefId,
        layerId: groupId,
        modifierId: `lay.${groupId}`,
        constraint: { kind: "stack", direction: "vertical", gap: 24, padding: 16, align: "center" },
      });
    }
    for (const node of design.layers) {
      const copy = briefScene.onScreenCopy[node.copyIndex ?? 0] ?? briefScene.onScreenCopy[0] ?? brief.objective;
      commands.push({
        type: "addNode",
        sceneId: design.sceneBriefId,
        layerId: node.id,
        nodeType: node.nodeHint === "shape" || node.nodeHint === "group" || node.nodeHint === "camera" ? "group" : "text",
        parentLayerId: design.layers.length > 1 ? groupId : undefined,
        text: node.nodeHint === "text" ? copy : undefined,
        fontSize: briefScene.role === "cta" ? 64 : 48,
        fill: brief.brand?.primaryColor ?? "#ffffff",
        semanticRole: briefScene.role,
        semanticKey: node.semanticKey,
        transform: {
          x: brief.aspectRatio === "16:9" ? 960 : 540,
          y: brief.aspectRatio === "9:16" ? 960 : 540,
          width: brief.aspectRatio === "16:9" ? 1400 : 900,
          height: 160,
          anchorX: 0.5,
          anchorY: 0.5,
        },
      });
      commands.push({
        type: "addTrack",
        sceneId: design.sceneBriefId,
        clipId: `clip.${node.id}.opacity`,
        layerId: node.id,
        property: "transform.opacity",
        duration: Math.min(1, briefScene.duration),
        keys: [
          { t: 0, v: 0 },
          { t: Math.min(1, briefScene.duration), v: 1, easing: "easeOut" },
        ],
      });
    }
  }

  commands.push({ type: "validateProject" }, { type: "compileProject" });
  return commands;
}

function readCapabilityManifestVersion(): string {
  return CAPABILITY_MANIFEST_VERSION;
}

export type FromScratchPlanArtifacts = {
  brief: CreativeBriefV1;
  plan: CreativePlanV1;
  sceneDesign: SceneDesignPlanV1;
  batchResult: CommandBatchResult;
  receipts: CommandReceipt[];
  generation: {
    planId: string;
    seed: string;
    model: string;
    capabilityManifestVersion: string;
  };
};

export function planFromScratch(input: {
  brief: unknown;
  seed?: string;
  industry?: string;
}): FromScratchPlanArtifacts {
  const brief = parseCreativeBriefV1(input.brief);
  const seed = input.seed ?? hashSeed(`${brief.objective}|${brief.script}|${brief.aspectRatio}`);
  const planId = `plan_${seed}`;
  const plan = buildCreativePlanFromBrief(brief, input.industry ?? "fnb");
  const sceneDesign = buildSceneDesignFromPlan(plan, planId);
  const projectId = `proj_${seed}`;
  const commands = buildBlankProjectCommands({ brief, plan, sceneDesign, projectId });
  const batchResult = executeCommandBatch({
    format: "moticlip-command-batch",
    formatVersion: 1,
    baseRevision: 0,
    commands,
  });

  return {
    brief,
    plan,
    sceneDesign,
    batchResult,
    receipts: batchResult.receipts,
    generation: {
      planId,
      seed,
      model: "ai-planner/stub-from-scratch@1",
      capabilityManifestVersion: readCapabilityManifestVersion(),
    },
  };
}
