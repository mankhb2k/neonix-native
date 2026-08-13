import {
  bakeMotionRecipe,
  compileMotionProject,
  isMotionRecipe,
} from "@motionvideo/motion-compiler";
import {
  applyMotionProjectV1Patch,
  normalizeTextPayloadInput,
  parseMotionProject,
  ProceduralDriverSchema,
  type MotionLayer,
  type MotionProject,
  type MotionRuntimeProject,
} from "@motionvideo/motion-protocol";
import {
  type CommandReceipt,
  diagnostic,
  unsupportedCapability,
} from "./diagnostics";
import {
  type AuthoringCommand,
  type CommandBatch,
  parseCommandBatch,
  type TransformPatch,
} from "./types";
import { critiqueProject, type CriticReport } from "../critic";
import { buildContactSheetPlan } from "../contact-sheet";

export type CommandBatchResult = {
  ok: boolean;
  project: MotionProject | null;
  revision: number;
  receipts: CommandReceipt[];
  compiled?: MotionRuntimeProject;
  contactSheet?: ReturnType<typeof buildContactSheetPlan>;
  critic?: CriticReport;
};

function cloneProject(project: MotionProject): MotionProject {
  return JSON.parse(JSON.stringify(project)) as MotionProject;
}

function defaultTransform(patch?: TransformPatch) {
  return {
    x: patch?.x ?? 540,
    y: patch?.y ?? 960,
    ...(patch?.depth !== undefined ? { depth: patch.depth } : {}),
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
  const dims = ASPECT_DIMS[input.aspectRatio];
  return parseMotionProject({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: input.projectId,
      name: input.name,
      locale: "vi-VN",
    },
    composition: {
      width: dims.width,
      height: dims.height,
      fps: input.fps ?? 30,
      background: input.primaryColor ?? "#0b1220",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {
      colors: { brand: input.primaryColor ?? "#0b1220" },
      fonts: { display: "Be Vietnam Pro" },
    },
    assets: [],
    variables: [],
    components: [],
    scenes: [],
    timeline: { visualTracks: [], audioTracks: [], captionTracks: [] },
    bindings: [],
  }) as unknown as MotionProject;
}

const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

function applyOne(
  project: MotionProject | null,
  command: AuthoringCommand,
  revision: number,
): {
  project: MotionProject | null;
  receipt: CommandReceipt;
  compiled?: MotionRuntimeProject;
  contactSheet?: ReturnType<typeof buildContactSheetPlan>;
  critic?: CriticReport;
} {
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setArtDirection",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        if (command.projectName) next.metadata.name = command.projectName;
        // Phase 9: v1 tokens replace v2 metadata.brand.
        const tokens = (next as Record<string, unknown>).tokens as
          | Record<string, Record<string, string>>
          | undefined;
        if (command.brandName && tokens?.fonts)
          tokens.fonts.display = command.brandName;
        if (command.primaryColor && tokens?.colors)
          tokens.colors.brand = command.primaryColor;
        if (command.secondaryColor && tokens?.colors)
          tokens.colors.accent = command.secondaryColor;
        if (command.fontFamily && tokens?.fonts)
          tokens.fonts.display = command.fontFamily;
        changedIds.push(next.metadata.id);
        return {
          project: parseMotionProject(
            next as Parameters<typeof parseMotionProject>[0],
          ),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addScene",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        if (project.scenes.some((scene) => scene.id === command.sceneId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `scenes.${command.sceneId}`,
                  `Scene already exists: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        const scene = {
          id: command.sceneId,
          ...(command.name ? { name: command.name } : {}),
          duration: command.duration,
          layers: [] as MotionLayer[],
          clips: [],
        };
        const insertAt = command.insertAt ?? next.scenes.length;
        next.scenes.splice(Math.min(insertAt, next.scenes.length), 0, scene);
        // Insert a visual clip into the main track for this scene.
        const tl = next.timeline as Record<string, unknown>;
        const visualTracks =
          (tl.visualTracks as Array<Record<string, unknown>>) ?? [];
        let mainTrack = visualTracks.find((t) => t.role === "main") as
          | Record<string, unknown>
          | undefined;
        if (!mainTrack) {
          mainTrack = {
            id: "main-track",
            role: "main",
            order: 0,
            muted: false,
            clips: [],
          };
          visualTracks.push(mainTrack);
          tl.visualTracks = visualTracks;
        }
        const clips = (mainTrack.clips as Array<Record<string, unknown>>) ?? [];
        clips.splice(Math.min(insertAt, clips.length), 0, {
          id: `clip-${command.sceneId}`,
          source: { kind: "scene", sceneId: command.sceneId },
          start: 0,
          duration: command.duration,
          opacity: 1,
          loop: false,
        });
        mainTrack.clips = clips;
        changedIds.push(command.sceneId);
        return {
          project: parseMotionProject(
            next as Parameters<typeof parseMotionProject>[0],
          ),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setSceneTiming",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        scene.duration = command.duration;
        changedIds.push(command.sceneId);
        return {
          project: parseMotionProject(next),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "reorderScenes",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const ids = new Set(project.scenes.map((scene) => scene.id));
        if (
          command.sceneIds.length !== ids.size ||
          command.sceneIds.some((id) => !ids.has(id))
        ) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "invalid_scene_order",
                  "timeline.visualTracks",
                  "sceneIds must list each project scene exactly once",
                  {
                    repairHint:
                      "Pass the full permutation of existing scene ids",
                  },
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        next.scenes = command.sceneIds.map(
          (id) => next.scenes.find((scene) => scene.id === id)!,
        );
        const tl = next.timeline as Record<string, unknown>;
        const visualTracks =
          (tl.visualTracks as Array<Record<string, unknown>>) ?? [];
        const mainTrack = visualTracks.find((t) => t.role === "main") as
          | Record<string, unknown>
          | undefined;
        if (mainTrack) {
          let cursor = 0;
          mainTrack.clips = command.sceneIds.map((sceneId) => {
            const scene = next.scenes.find((s) => s.id === sceneId);
            const clip = {
              id: `clip-${sceneId}`,
              source: { kind: "scene", sceneId },
              start: cursor,
              duration:
                (scene as Record<string, unknown> | undefined)?.duration ?? 2,
              opacity: 1,
              loop: false,
            };
            cursor +=
              ((scene as Record<string, unknown> | undefined)
                ?.duration as number) ?? 2;
            return clip;
          });
        }
        changedIds.push(...command.sceneIds);
        return {
          project: parseMotionProject(
            next as Parameters<typeof parseMotionProject>[0],
          ),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addNode",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        if (scene.layers.some((node) => node.id === command.layerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `layers.${command.layerId}`,
                  `Node already exists: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        const parentLayerId =
          command.parentLayerId === undefined ? null : command.parentLayerId;
        if (parentLayerId && !scene.layers.some((node) => node.id === parentLayerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_parent",
                  `layers.${command.layerId}.parentLayerId`,
                  `Unknown parent: ${parentLayerId}`,
                ),
              ],
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
        let node: MotionLayer;
        if (command.nodeType === "group") {
          node = {
            id: command.layerId,
            type: "group",
            parentLayerId,
            transform,
            ...(semantic ? { semantic } : {}),
          };
        } else if (command.nodeType === "text") {
          node = {
            id: command.layerId,
            type: "text",
            parentLayerId,
            transform,
            payload: {
              content: { kind: "plain" as const, text: command.text ?? "" },
              fontSize: command.fontSize ?? 48,
              color: command.fill ?? "#ffffff",
              alignment: "center" as const,
            },
            ...(semantic ? { semantic } : {}),
          };
        } else {
          node = {
            id: command.layerId,
            type: "shape",
            parentLayerId,
            transform,
            payload: { shape: "rectangle" as const },
            style: { fill: command.fill ?? "#111111" },
            ...(semantic ? { semantic } : {}),
          };
        }
        scene.layers.push(node);
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "removeNode",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        if (!scene.layers.some((node) => node.id === command.layerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `layers.${command.layerId}`,
                  `Unknown layer: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        const removeIds = new Set<string>();
        const visit = (id: string): void => {
          removeIds.add(id);
          for (const child of scene.layers) {
            if (child.parentLayerId === id) visit(child.id);
          }
        };
        visit(command.layerId);
        scene.layers = scene.layers.filter((node) => !removeIds.has(node.id));
        scene.clips = scene.clips.filter((clip) => {
          if (clip.layerId && removeIds.has(clip.layerId)) return false;
          if (clip.source.kind === "tracks") {
            clip.source.tracks = clip.source.tracks.filter(
              (track) => !removeIds.has(track.layerId),
            );
            return clip.source.tracks.length > 0;
          }
          return true;
        });
        changedIds.push(...removeIds);
        return {
          project: parseMotionProject(next),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addTrack",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        if (!scene.layers.some((node) => node.id === command.layerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `layers.${command.layerId}`,
                  `Unknown track target: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        if (scene.clips.some((clip) => clip.id === command.clipId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `clips.${command.clipId}`,
                  `Clip already exists: ${command.clipId}`,
                ),
              ],
            },
          };
        }
        scene.clips.push({
          id: command.clipId,
          layerId: command.layerId,
          schedule: { kind: "absolute", at: command.at ?? 0 },
          duration: command.duration,
          playback: { iterations: 1, direction: "normal", rate: 1 },
          source: {
            kind: "tracks",
            tracks: [
              {
                layerId: command.layerId,
                property: command.property,
                keys: command.keys,
              },
            ],
          },
        });
        changedIds.push(command.clipId);
        return {
          project: parseMotionProject(next),
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "validateProject",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        parseMotionProject(project);
        return {
          project,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [
              diagnostic(
                "validated",
                "project",
                "Project parsed successfully",
                { severity: "info" },
              ),
            ],
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "compileProject",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const compiled = compileMotionProject(parseMotionProject(project));
        return {
          project,
          compiled,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [
              diagnostic(
                "compiled",
                "project",
                "Project compiled to runtime IR",
                { severity: "info" },
              ),
            ],
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
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "applyRepairPatch",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const result = applyMotionProjectV1Patch(project, command.patch);
        if (!result.project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                ...diagnostics,
                ...result.diagnostics.map((d) =>
                  diagnostic("patch_failure", d.path, d.message, {
                    severity: d.severity,
                  }),
                ),
              ],
            },
          };
        }
        changedIds.push(result.project.metadata.id);
        return {
          project: result.project,
          receipt: {
            revision: revision + 1,
            changedIds,
            diagnostics: [
              ...diagnostics,
              ...result.diagnostics.map((d) =>
                diagnostic("patch_diag", d.path, d.message, {
                  severity: d.severity,
                }),
              ),
            ],
          },
        };
      }
      case "setLayoutConstraint": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setLayoutConstraint",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        const node = scene.layers.find((item) => item.id === command.layerId);
        if (!node) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `layers.${command.layerId}`,
                  `Unknown layer: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        const modifiers = [...(node.modifiers ?? [])].filter(
          (modifier) => modifier.id !== command.modifierId,
        );
        modifiers.push({
          id: command.modifierId,
          type: "layout",
          // Command schema allows optional stack fields; layout modifier requires defaults at compile.
          constraint: {
            ...command.constraint,
            ...(command.constraint.kind === "stack"
              ? {
                  gap: command.constraint.gap ?? 0,
                  padding: command.constraint.padding ?? 0,
                  align: command.constraint.align ?? "start",
                }
              : {}),
            ...(command.constraint.kind === "grid"
              ? {
                  gapX: command.constraint.gapX ?? 0,
                  gapY: command.constraint.gapY ?? 0,
                }
              : {}),
          } as Extract<
            NonNullable<MotionLayer["modifiers"]>[number],
            { type: "layout" }
          >["constraint"],
        });
        node.modifiers = modifiers;
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addMask": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addMask",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        const node = scene.layers.find((item) => item.id === command.layerId);
        const source = scene.layers.find(
          (item) => item.id === command.sourceLayerId,
        );
        if (!node || !source) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `layers.${command.layerId}`,
                  "addMask requires existing node and sourceLayerId",
                  {
                    repairHint: "Create both layers before addMask",
                  },
                ),
              ],
            },
          };
        }
        node.mask = {
          sourceLayerId: command.sourceLayerId,
          mode: command.mode,
          sourceVisibility: command.sourceVisibility ?? "mask-only",
        };
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addEffect": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addEffect",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        const node = scene.layers.find((item) => item.id === command.layerId);
        if (!node) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `layers.${command.layerId}`,
                  `Unknown layer: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        const effects = [...(node.effects ?? [])];
        if (effects.some((effect) => effect.id === command.effectId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `effects.${command.effectId}`,
                  `Effect already exists: ${command.effectId}`,
                ),
              ],
            },
          };
        }
        if (command.effect.type === "blur") {
          effects.push({
            id: command.effectId,
            type: "blur",
            radius: command.effect.radius,
          });
        } else if (command.effect.type === "shadow") {
          effects.push({
            id: command.effectId,
            type: "shadow",
            offsetX: command.effect.offsetX,
            offsetY: command.effect.offsetY,
            blur: command.effect.blur,
            color: command.effect.color,
            opacity: command.effect.opacity ?? 1,
          });
        } else if (command.effect.type === "glow") {
          effects.push({
            id: command.effectId,
            type: "glow",
            radius: command.effect.radius,
            intensity: command.effect.intensity,
            color: command.effect.color,
            opacity: command.effect.opacity ?? 1,
          });
        } else {
          effects.push({
            id: command.effectId,
            type: "color-adjust",
            brightness: command.effect.brightness ?? 0,
            contrast: command.effect.contrast ?? 1,
            saturation: command.effect.saturation ?? 1,
          });
        }
        node.effects = effects;
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setCamera": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setCamera",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        let camera = scene.layers.find((item) => item.id === command.cameraId);
        if (!camera) {
          camera = {
            id: command.cameraId,
            type: "camera",
            parentLayerId: null,
            transform: defaultTransform(command.transform),
            payload: {
              zoom: command.zoom ?? 1,
              projection: "orthographic",
              ...(command.parallaxStrength !== undefined
                ? { parallaxStrength: command.parallaxStrength }
                : {}),
            },
          };
          scene.layers.push(camera);
        } else if (camera.type !== "camera") {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "invalid_node_type",
                  `layers.${command.cameraId}`,
                  `Node ${command.cameraId} is not a camera`,
                ),
              ],
            },
          };
        } else {
          if (command.transform) {
            camera.transform = {
              ...camera.transform,
              ...Object.fromEntries(
                Object.entries(command.transform).filter(
                  ([, value]) => value !== undefined,
                ),
              ),
            };
          }
          if (command.zoom !== undefined) camera.payload.zoom = command.zoom;
          if (command.parallaxStrength !== undefined)
            camera.payload.parallaxStrength = command.parallaxStrength;
        }
        if (command.makeActive !== false) {
          scene.activeCameraLayerId = command.cameraId;
          if (!scene.space || scene.space === "flat-2d")
            scene.space = "layered-2.5d";
        }
        changedIds.push(command.cameraId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addDriver": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addDriver",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const parsed = ProceduralDriverSchema.safeParse(command.driver);
        if (!parsed.success) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "invalid_driver",
                  "addDriver",
                  parsed.error.message,
                  {
                    repairHint: "Pass a closed ProceduralDriverSchema object",
                  },
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        if (!scene.layers.some((node) => node.id === parsed.data.targetLayerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `drivers.${parsed.data.id}`,
                  `Unknown targetLayerId: ${parsed.data.targetLayerId}`,
                ),
              ],
            },
          };
        }
        const drivers = [...(scene.drivers ?? [])];
        if (drivers.some((driver) => driver.id === parsed.data.id)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `drivers.${parsed.data.id}`,
                  `Driver already exists: ${parsed.data.id}`,
                ),
              ],
            },
          };
        }
        drivers.push(parsed.data);
        scene.drivers = drivers;
        changedIds.push(parsed.data.id);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "applyRecipe": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "applyRecipe",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        if (!isMotionRecipe(command.recipeId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_recipe",
                  "applyRecipe",
                  `Unknown recipe: ${command.recipeId}`,
                  {
                    repairHint: "Use MOTION_RECIPE_IDS allowlist",
                  },
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        const baked = bakeMotionRecipe({
          recipeId: command.recipeId,
          sceneId: command.sceneId,
          targetLayerId: command.targetLayerId,
          duration: command.duration,
          seed: command.seed,
          intensity: command.intensity,
          sourceLayerId: command.sourceLayerId,
          staggerLayerIds: command.staggerLayerIds,
        });
        const drivers = [...(scene.drivers ?? [])];
        for (const driver of baked.drivers) {
          const parsed = ProceduralDriverSchema.parse(driver);
          if (drivers.some((item) => item.id === parsed.id)) {
            return {
              project,
              receipt: {
                revision,
                changedIds: [],
                diagnostics: [
                  diagnostic(
                    "duplicate_id",
                    `drivers.${parsed.id}`,
                    `Driver already exists: ${parsed.id}`,
                  ),
                ],
              },
            };
          }
          drivers.push(parsed);
          changedIds.push(parsed.id);
        }
        scene.drivers = drivers;
        if (baked.tracks.length > 0) {
          const clipId =
            command.clipId ??
            `clip.recipe.${command.recipeId}.${command.targetLayerId}`;
          scene.clips.push({
            id: clipId,
            schedule: { kind: "absolute", at: 0 },
            duration: command.duration,
            playback: { rate: 1, direction: "normal", iterations: 1 },
            source: {
              kind: "tracks",
              tracks: baked.tracks.map((track) => ({
                layerId: track.layerId,
                property: track.property,
                keys: track.keys.map((key) => ({
                  t: key.t,
                  v: key.v,
                  ...(key.easing
                    ? { easing: key.easing as "easeOut" | "linear" | "step" }
                    : {}),
                })),
              })),
            },
          });
          changedIds.push(clipId);
        }
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "renderContactSheet": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "renderContactSheet",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const sheet = buildContactSheetPlan(project, {
          sceneId: command.sceneId,
          times: command.times,
          width: command.width,
          height: command.height,
        });
        const critic = critiqueProject(project);
        return {
          project,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [
              diagnostic(
                "contact_sheet",
                "renderContactSheet",
                `Contact sheet ${sheet.frames.length} frames`,
                {
                  severity: "info",
                },
              ),
            ],
          },
          contactSheet: sheet,
          critic,
        };
      }
      case "renderPreviewRange": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "renderPreviewRange",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const fps = command.fps ?? 6;
        const times: number[] = [];
        for (let t = command.start; t <= command.end + 1e-9; t += 1 / fps)
          times.push(Number(t.toFixed(6)));
        const sheet = buildContactSheetPlan(project, {
          sceneId: command.sceneId,
          times,
        });
        return {
          project,
          receipt: {
            revision,
            changedIds: [],
            diagnostics: [
              diagnostic(
                "preview_range",
                "renderPreviewRange",
                `Preview range ${times.length} samples`,
                {
                  severity: "info",
                },
              ),
            ],
          },
          contactSheet: sheet,
        };
      }
      case "registerAsset": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "registerAsset",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        if (next.assets.some((asset) => asset.id === command.asset.id)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `assets.${command.asset.id}`,
                  `Asset already exists: ${command.asset.id}`,
                ),
              ],
            },
          };
        }
        next.assets.push(command.asset as MotionProject["assets"][number]);
        changedIds.push(command.asset.id);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addImageNode":
      case "addSvgNode": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  command.type,
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        if (scene.layers.some((node) => node.id === command.layerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `layers.${command.layerId}`,
                  `Node already exists: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        const asset = next.assets.find((item) => item.id === command.assetId);
        const expectedType = command.type === "addImageNode" ? "image" : "svg";
        if (!asset || asset.assetType !== expectedType) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_asset",
                  `layers.${command.layerId}.payload.assetId`,
                  `Asset ${command.assetId} missing or not ${expectedType}`,
                ),
              ],
            },
          };
        }
        const parentLayerId =
          command.parentLayerId === undefined ? null : command.parentLayerId;
        if (parentLayerId && !scene.layers.some((node) => node.id === parentLayerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_parent",
                  `layers.${command.layerId}.parentLayerId`,
                  `Unknown parent: ${parentLayerId}`,
                ),
              ],
            },
          };
        }
        const semantic =
          command.semanticRole || command.semanticKey
            ? {
                role: command.semanticRole ?? "content",
                ...(command.semanticKey ? { key: command.semanticKey } : {}),
                tags: [] as string[],
              }
            : undefined;
        const node: MotionLayer = {
          id: command.layerId,
          type: expectedType,
          parentLayerId,
          transform: defaultTransform(command.transform),
          payload: {
            assetId: command.assetId,
            ...(command.fit ? { fit: command.fit } : {}),
            ...(command.crop ? { crop: command.crop } : {}),
          },
          ...(semantic ? { semantic } : {}),
        };
        scene.layers.push(node);
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addPathNode": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "addPathNode",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        if (scene.layers.some((node) => node.id === command.layerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "duplicate_id",
                  `layers.${command.layerId}`,
                  `Node already exists: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        const parentLayerId =
          command.parentLayerId === undefined ? null : command.parentLayerId;
        if (parentLayerId && !scene.layers.some((node) => node.id === parentLayerId)) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_parent",
                  `layers.${command.layerId}.parentLayerId`,
                  `Unknown parent: ${parentLayerId}`,
                ),
              ],
            },
          };
        }
        const semantic =
          command.semanticRole || command.semanticKey
            ? {
                role: command.semanticRole ?? "content",
                ...(command.semanticKey ? { key: command.semanticKey } : {}),
                tags: [] as string[],
              }
            : undefined;
        const style =
          command.fill || command.stroke || command.strokeWidth != null
            ? {
                ...(command.fill ? { fill: command.fill } : {}),
                ...(command.stroke ? { stroke: command.stroke } : {}),
                ...(command.strokeWidth != null
                  ? { strokeWidth: command.strokeWidth }
                  : {}),
              }
            : undefined;
        const node: MotionLayer = {
          id: command.layerId,
          type: "path",
          parentLayerId,
          transform: defaultTransform(command.transform),
          payload: {
            contours: command.contours,
            fillRule: command.fillRule ?? "nonzero",
          },
          ...(style ? { style } : {}),
          ...(semantic ? { semantic } : {}),
        };
        scene.layers.push(node);
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setNodePayload": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setNodePayload",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        const scene = next.scenes.find((item) => item.id === command.sceneId);
        const node = scene?.layers.find((item) => item.id === command.layerId);
        if (!scene || !node) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "unknown_node",
                  `layers.${command.layerId}`,
                  `Unknown layer: ${command.layerId}`,
                ),
              ],
            },
          };
        }
        if (node.type === "text") {
          const merged = {
            ...(node.payload as Record<string, unknown>),
            ...command.payload,
          };
          node.payload = normalizeTextPayloadInput(
            merged,
          ) as typeof node.payload;
        } else {
          node.payload = {
            ...(node.payload as Record<string, unknown>),
            ...command.payload,
          } as typeof node.payload;
        }
        changedIds.push(command.layerId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setSceneTransition": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setSceneTransition",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        // Apply transition directly on the visual clip.
        const tl = next.timeline as Record<string, unknown>;
        const visualTracks =
          (tl.visualTracks as Array<Record<string, unknown>>) ?? [];
        const mainTrack = visualTracks.find((t) => t.role === "main") as
          | Record<string, unknown>
          | undefined;
        if (mainTrack) {
          const clips =
            (mainTrack.clips as Array<Record<string, unknown>>) ?? [];
          const clip = clips.find(
            (c) =>
              (c.source as Record<string, unknown>)?.sceneId ===
              command.sceneId,
          );
          if (clip) {
            clip.transitionOut =
              command.transition.type === "slide"
                ? {
                    ...command.transition,
                    mode: command.transition.mode ?? "push",
                  }
                : command.transition;
          }
        }
        changedIds.push(command.sceneId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "setSceneBackground": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "setSceneBackground",
                  "createProject must run first",
                ),
              ],
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
              diagnostics: [
                diagnostic(
                  "unknown_scene",
                  `scenes.${command.sceneId}`,
                  `Unknown scene: ${command.sceneId}`,
                ),
              ],
            },
          };
        }
        const bgId = "__scene_background__";
        const existing = scene.layers.find((n) => n.id === bgId);
        // Phase 9: v1 composition replaces v2 metadata.aspectRatio.
        const comp = (next as Record<string, unknown>).composition as
          | Record<string, number>
          | undefined;
        const width = comp?.width ?? 1920;
        const height = comp?.height ?? 1080;
        if (existing && existing.type === "solid") {
          existing.payload = {
            ...existing.payload,
            color: command.fill,
            width,
            height,
          };
          existing.transform = {
            ...existing.transform,
            x: width / 2,
            y: height / 2,
            width,
            height,
            anchorX: 0.5,
            anchorY: 0.5,
          };
          existing.zIndex = -10_000;
        } else {
          scene.layers = [
            {
              id: bgId,
              type: "solid",
              name: "Scene Background",
              parentLayerId: null,
              zIndex: -10_000,
              transform: {
                x: width / 2,
                y: height / 2,
                width,
                height,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                anchorX: 0.5,
                anchorY: 0.5,
                opacity: 1,
                visible: true,
                flipX: false,
                flipY: false,
              },
              payload: { color: command.fill, width, height },
            },
            ...scene.layers.filter((n) => n.id !== bgId),
          ];
        }
        changedIds.push(bgId);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "upsertCaptionTrack": {
        if (!project) {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "missing_project",
                  "upsertCaptionTrack",
                  "createProject must run first",
                ),
              ],
            },
          };
        }
        const next = cloneProject(project);
        const track = command.track as {
          id?: string;
        };
        if (!track?.id || typeof track.id !== "string") {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "invalid_caption_track",
                  "upsertCaptionTrack",
                  "track.id is required",
                ),
              ],
            },
          };
        }
        const tracks = [...(next.timeline.captionTracks ?? [])];
        const idx = tracks.findIndex((t) => t.id === track.id);
        if (idx >= 0) tracks[idx] = track as (typeof tracks)[number];
        else tracks.push(track as (typeof tracks)[number]);
        next.timeline = { ...next.timeline, captionTracks: tracks };
        changedIds.push(track.id);
        return {
          project: parseMotionProject(next),
          receipt: { revision: revision + 1, changedIds, diagnostics },
        };
      }
      case "addComponentInstance":
      case "addAudioCue":
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
            repairHint:
              "Fix command arguments or project state, then retry the batch",
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
  let compiled: MotionRuntimeProject | undefined;
  let contactSheet: ReturnType<typeof buildContactSheetPlan> | undefined;
  let critic: CriticReport | undefined;

  for (const command of batch.commands) {
    const result = applyOne(project, command, revision);
    project = result.project;
    revision = result.receipt.revision;
    receipts.push(result.receipt);
    if (result.compiled) compiled = result.compiled;
    if (result.contactSheet) contactSheet = result.contactSheet;
    if (result.critic) critic = result.critic;
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
    ...(contactSheet ? { contactSheet } : {}),
    ...(critic ? { critic } : {}),
  };
}
