import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  applyMotionPatch,
  parseMotionProjectV2,
  type MotionNode,
  type MotionProject,
  type NormalizedMotionProjectV2,
} from "@motionvideo/motion-schema";
import { type CommandReceipt, diagnostic, unsupportedCapability } from "./diagnostics";
import {
  type AuthoringCommand,
  type CommandBatch,
  parseCommandBatch,
  type TransformPatch,
} from "./types";

export type CommandBatchResult = {
  ok: boolean;
  project: MotionProject | null;
  revision: number;
  receipts: CommandReceipt[];
  compiled?: NormalizedMotionProjectV2;
};

function cloneProject(project: MotionProject): MotionProject {
  return JSON.parse(JSON.stringify(project)) as MotionProject;
}

function defaultTransform(patch?: TransformPatch) {
  return {
    x: patch?.x ?? 540,
    y: patch?.y ?? 960,
    width: patch?.width ?? 800,
    height: patch?.height ?? 160,
    rotation: patch?.rotation ?? 0,
    scaleX: patch?.scaleX ?? 1,
    scaleY: patch?.scaleY ?? 1,
    anchorX: patch?.anchorX ?? 0.5,
    anchorY: patch?.anchorY ?? 0.5,
    opacity: patch?.opacity ?? 1,
    visible: patch?.visible ?? true,
    flipX: patch?.flipX ?? false,
    flipY: patch?.flipY ?? false,
  };
}

export function createBlankMotionProject(input: {
  projectId: string;
  name: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  brandName: string;
  primaryColor?: string;
  fps?: number;
}): MotionProject {
  return parseMotionProjectV2({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: input.projectId,
      name: input.name,
      aspectRatio: input.aspectRatio,
      fps: input.fps ?? 30,
      locale: "vi-VN",
      brand: {
        name: input.brandName,
        ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
      },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [],
    timeline: { sceneOrder: [], audioTracks: [] },
    scenes: [],
    bindings: [],
    extensions: { constraints: [], events: [] },
  });
}

function applyOne(
  project: MotionProject | null,
  command: AuthoringCommand,
  revision: number,
): { project: MotionProject | null; receipt: CommandReceipt; compiled?: NormalizedMotionProjectV2 } {
  const changedIds: string[] = [];
  const diagnostics: CommandReceipt["diagnostics"] = [];

  try {
    switch (command.type) {
      case "createProject": {
        const next = createBlankMotionProject({
          projectId: command.projectId,
          name: command.name,
          aspectRatio: command.aspectRatio,
          brandName: command.brandName,
          primaryColor: command.primaryColor,
          fps: command.fps,
        });
        changedIds.push(command.projectId);
        return {
          project: next,
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setArtDirection": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "setArtDirection", "createProject must run first")],
            },
          };
        }
        const next = cloneProject(project);
        if (command.projectName) next.metadata.name = command.projectName;
        if (command.brandName) next.metadata.brand.name = command.brandName;
        if (command.primaryColor) next.metadata.brand.primaryColor = command.primaryColor;
        if (command.secondaryColor) next.metadata.brand.secondaryColor = command.secondaryColor;
        if (command.fontFamily) next.metadata.brand.fontFamily = command.fontFamily;
        changedIds.push(next.metadata.id);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addScene": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "addScene", "createProject must run first")],
            },
          };
        }
        if (project.scenes.some((scene) => scene.id === command.sceneId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("duplicate_id", `scenes.${command.sceneId}`, `Scene already exists: ${command.sceneId}`)],
            },
          };
        }
        const next = cloneProject(project);
        const scene = {
          id: command.sceneId,
          ...(command.name ? { name: command.name } : {}),
          duration: command.duration,
          nodes: [] as MotionNode[],
          clips: [],
        };
        const insertAt = command.insertAt ?? next.timeline.sceneOrder.length;
        next.scenes.splice(Math.min(insertAt, next.scenes.length), 0, scene);
        next.timeline.sceneOrder.splice(Math.min(insertAt, next.timeline.sceneOrder.length), 0, command.sceneId);
        changedIds.push(command.sceneId);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setSceneTiming": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "setSceneTiming", "createProject must run first")],
            },
          };
        }
        const next = cloneProject(project);
        const scene = next.scenes.find((item) => item.id === command.sceneId);
        if (!scene) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_scene", `scenes.${command.sceneId}`, `Unknown scene: ${command.sceneId}`)],
            },
          };
        }
        scene.duration = command.duration;
        changedIds.push(command.sceneId);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "reorderScenes": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "reorderScenes", "createProject must run first")],
            },
          };
        }
        const ids = new Set(project.scenes.map((scene) => scene.id));
        if (command.sceneOrder.length !== ids.size || command.sceneOrder.some((id) => !ids.has(id))) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "invalid_scene_order",
                  "timeline.sceneOrder",
                  "sceneOrder must list each project scene exactly once",
                  { repairHint: "Pass the full permutation of existing scene ids" },
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        next.timeline.sceneOrder = [...command.sceneOrder];
        next.scenes = command.sceneOrder.map((id) => next.scenes.find((scene) => scene.id === id)!);
        changedIds.push(...command.sceneOrder);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addNode": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "addNode", "createProject must run first")],
            },
          };
        }
        const next = cloneProject(project);
        const scene = next.scenes.find((item) => item.id === command.sceneId);
        if (!scene) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_scene", `scenes.${command.sceneId}`, `Unknown scene: ${command.sceneId}`)],
            },
          };
        }
        if (scene.nodes.some((node) => node.id === command.nodeId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("duplicate_id", `nodes.${command.nodeId}`, `Node already exists: ${command.nodeId}`)],
            },
          };
        }
        const parentId = command.parentId === undefined ? null : command.parentId;
        if (parentId && !scene.nodes.some((node) => node.id === parentId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_parent", `nodes.${command.nodeId}.parentId`, `Unknown parent: ${parentId}`)],
            },
          };
        }
        const transform = defaultTransform(command.transform);
        const semantic =
          command.semanticRole || command.semanticKey
            ? {
                role: command.semanticRole ?? "content",
                ...(command.semanticKey ? { key: command.semanticKey } : {}),
                tags: [] as string[],
              }
            : undefined;
        let node: MotionNode;
        if (command.nodeType === "group") {
          node = { id: command.nodeId, type: "group", parentId, transform, ...(semantic ? { semantic } : {}) };
        } else if (command.nodeType === "text") {
          node = {
            id: command.nodeId,
            type: "text",
            parentId,
            transform,
            payload: {
              text: command.text ?? "",
              fontSize: command.fontSize ?? 48,
              align: "center" as const,
            },
            style: { fill: command.fill ?? "#ffffff" },
            ...(semantic ? { semantic } : {}),
          };
        } else {
          node = {
            id: command.nodeId,
            type: "shape",
            parentId,
            transform,
            payload: { shape: "rectangle" as const },
            style: { fill: command.fill ?? "#111111" },
            ...(semantic ? { semantic } : {}),
          };
        }
        scene.nodes.push(node);
        changedIds.push(command.nodeId);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "removeNode": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "removeNode", "createProject must run first")],
            },
          };
        }
        const next = cloneProject(project);
        const scene = next.scenes.find((item) => item.id === command.sceneId);
        if (!scene) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_scene", `scenes.${command.sceneId}`, `Unknown scene: ${command.sceneId}`)],
            },
          };
        }
        if (!scene.nodes.some((node) => node.id === command.nodeId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_node", `nodes.${command.nodeId}`, `Unknown node: ${command.nodeId}`)],
            },
          };
        }
        const removeIds = new Set<string>();
        const visit = (id: string): void => {
          removeIds.add(id);
          for (const child of scene.nodes) {
            if (child.parentId === id) visit(child.id);
          }
        };
        visit(command.nodeId);
        scene.nodes = scene.nodes.filter((node) => !removeIds.has(node.id));
        scene.clips = scene.clips.filter((clip) => {
          if (clip.targetId && removeIds.has(clip.targetId)) return false;
          if (clip.source.kind === "tracks") {
            clip.source.tracks = clip.source.tracks.filter((track) => !removeIds.has(track.targetId));
            return clip.source.tracks.length > 0;
          }
          return true;
        });
        changedIds.push(...removeIds);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addTrack": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "addTrack", "createProject must run first")],
            },
          };
        }
        const next = cloneProject(project);
        const scene = next.scenes.find((item) => item.id === command.sceneId);
        if (!scene) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_scene", `scenes.${command.sceneId}`, `Unknown scene: ${command.sceneId}`)],
            },
          };
        }
        if (!scene.nodes.some((node) => node.id === command.targetId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("unknown_node", `nodes.${command.targetId}`, `Unknown track target: ${command.targetId}`)],
            },
          };
        }
        if (scene.clips.some((clip) => clip.id === command.clipId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("duplicate_id", `clips.${command.clipId}`, `Clip already exists: ${command.clipId}`)],
            },
          };
        }
        scene.clips.push({
          id: command.clipId,
          targetId: command.targetId,
          schedule: { kind: "absolute", at: command.at ?? 0 },
          duration: command.duration,
          playback: { iterations: 1, direction: "normal", rate: 1 },
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: command.targetId,
                property: command.property,
                keys: command.keys,
              },
            ],
          },
        });
        changedIds.push(command.clipId);
        return {
          project: parseMotionProjectV2(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "validateProject": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "validateProject", "createProject must run first")],
            },
          };
        }
        parseMotionProjectV2(project);
        return {
          project,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [diagnostic("validated", "project", "Project parsed successfully", { severity: "info" })],
          },
        };
      }
      case "compileProject": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "compileProject", "createProject must run first")],
            },
          };
        }
        const compiled = compileMotionProject(parseMotionProjectV2(project));
        return {
          project,
          compiled,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [diagnostic("compiled", "project", "Project compiled to runtime IR", { severity: "info" })],
          },
        };
      }
      case "applyRepairPatch": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [diagnostic("missing_project", "applyRepairPatch", "createProject must run first")],
            },
          };
        }
        const patched = applyMotionPatch(project, command.patch);
        changedIds.push(patched.metadata.id);
        return {
          project: patched,
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setLayoutConstraint":
      case "addComponentInstance":
      case "addDriver":
      case "addMask":
      case "addEffect":
      case "setCamera":
      case "addAudioCue":
      case "renderContactSheet":
      case "renderPreviewRange":
        return {
          project,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [unsupportedCapability(command.type)],
          },
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      project,
      receipt: {
        revision,
        changedIds: [],
        diagnostics: [
          diagnostic("command_failed", `commands.${command.type}`, message, {
            repairHint: "Fix command arguments or project state, then retry the batch",
          }),
        ],
      },
    };
  }
}

/**
 * Apply a command batch transactionally: on any error-severity diagnostic, roll back to the pre-batch project.
 */
export function executeCommandBatch(
  batchInput: unknown,
  initialProject: MotionProject | null = null,
): CommandBatchResult {
  const batch: CommandBatch = parseCommandBatch(batchInput);
  const snapshot = initialProject ? cloneProject(initialProject) : null;
  let project = initialProject ? cloneProject(initialProject) : null;
  let revision = batch.baseRevision;
  const receipts: CommandReceipt[] = [];
  let compiled: NormalizedMotionProjectV2 | undefined;

  for (const command of batch.commands) {
    const result = applyOne(project, command, revision);
    project = result.project;
    revision = result.receipt.revision;
    receipts.push(result.receipt);
    if (result.compiled) compiled = result.compiled;
    if (result.receipt.diagnostics.some((item) => item.severity === "error")) {
      return {
        ok: false,
        project: snapshot,
        revision: batch.baseRevision,
        receipts,
      };
    }
  }

  return {
    ok: true,
    project,
    revision,
    receipts,
    ...(compiled ? { compiled } : {}),
  };
}
