import {
  bakeMotionRecipe,
  compileMotionProject,
  isMotionRecipe,
} from "@motionvideo/motion-compiler";
import {
  visualLayerAtoms,
  applyMotionProjectV1Patch,
  normalizeTextPayloadInput,
  parseMotionProject,
  ProceduralDriverSchema,
  V1,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  type MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
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
import {
  findLayer,
  findSceneGroup,
  getAiExt,
  insertLayer,
  refreshTimelineDuration,
  removeLayers,
  sceneGroups,
  sceneLayers,
  setAiExt,
} from "./layer-tree";

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
  return visualLayerAtoms({
    x: patch?.x ?? 540,
    y: patch?.y ?? 960,
    width: patch?.width ?? 800,
    height: patch?.height ?? 160,
    rotation: patch?.rotation,
    scaleX: patch?.scaleX,
    scaleY: patch?.scaleY,
    originX: patch?.anchorX,
    originY: patch?.anchorY,
    opacity: patch?.opacity,
    visible: patch?.visible,
    depth: patch?.depth,
  });
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
    layers: [],
    timeline: { duration: 0 },
    bindings: [],
    extensions: {},
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
        if (findSceneGroup(project, command.sceneId)) {
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
        const groups = sceneGroups(next);
        const insertAt = Math.min(command.insertAt ?? groups.length, groups.length);
        const scene = {
          id: command.sceneId,
          type: "group" as const,
          parentLayerId: null,
          zIndex: groups.length,
          ...(command.name ? { name: command.name } : {}),
          timing: { start: 0, duration: command.duration },
          ...visualLayerAtoms({
            width: next.composition.width,
            height: next.composition.height,
          }),
          children: [] as MotionLayer[],
        };
        const nonGroups = next.layers.filter((layer) => layer.type !== "group");
        groups.splice(insertAt, 0, scene);
        next.layers = [...groups, ...nonGroups];
        refreshTimelineDuration(next);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        scene.timing = { start: 0, duration: command.duration };
        refreshTimelineDuration(next);
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
        const ids = new Set(sceneGroups(project).map((scene) => scene.id));
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
        const groups = sceneGroups(next);
        const ordered = command.sceneIds.map(
          (id) => groups.find((scene) => scene.id === id)!,
        );
        const nonGroups = next.layers.filter((layer) => layer.type !== "group");
        next.layers = [...ordered, ...nonGroups];
        refreshTimelineDuration(next);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        if (sceneLayers(scene).some((node) => node.id === command.layerId)) {
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
        const parentLayerId = command.parentLayerId ?? scene.id;
        if (
          parentLayerId !== scene.id &&
          !sceneLayers(scene).some((node) => node.id === parentLayerId)
        ) {
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
        const atoms = defaultTransform(command.transform);
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
            ...atoms,
            children: [] as MotionLayer[],
            ...(semantic ? { semantic } : {}),
          };
        } else if (command.nodeType === "text") {
          node = {
            id: command.layerId,
            type: "text",
            parentLayerId,
            ...atoms,
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
            ...atoms,
            payload: { shape: "rectangle" as const },
            style: { fill: command.fill ?? "#111111" },
            ...(semantic ? { semantic } : {}),
          };
        }
        insertLayer(scene, node);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        if (!sceneLayers(scene).some((node) => node.id === command.layerId)) {
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
          for (const child of sceneLayers(scene)) {
            if (child.parentLayerId === id) visit(child.id);
          }
        };
        visit(command.layerId);
        removeLayers(scene, removeIds);
        const ext = getAiExt(next);
        ext.motionUnits = ext.motionUnits.filter(
          (unit) => !unit.layerId || !removeIds.has(unit.layerId),
        );
        setAiExt(next, ext);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        if (!sceneLayers(scene).some((node) => node.id === command.layerId)) {
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
        const ext = getAiExt(next);
        if (ext.motionUnits.some((unit) => unit.id === command.clipId)) {
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
        ext.motionUnits.push({
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
        setAiExt(next, ext);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        const node = sceneLayers(scene).find((item) => item.id === command.layerId);
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
        if (node.type !== "group") {
          return {
            project,
            receipt: {
              revision,
              changedIds: [],
              diagnostics: [
                diagnostic(
                  "invalid_target",
                  `layers.${command.layerId}.layout`,
                  "Layout can only be applied to group layers",
                ),
              ],
            },
          };
        }
        node.layout = {
          ...command.constraint,
          gap: command.constraint.gap ?? 0,
          padding: command.constraint.padding ?? 0,
          align: command.constraint.align ?? "start",
          justify: command.constraint.justify ?? "start",
        };
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
        const scene = findSceneGroup(next, command.sceneId);
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
        const node = sceneLayers(scene).find((item) => item.id === command.layerId);
        const source = sceneLayers(scene).find(
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
        if (node.type !== "audio") {
          node.compositing = {
            ...(node.compositing ?? {}),
            mask: {
              sourceLayerId: command.sourceLayerId,
              mode: command.mode,
              "source-visibility": command.sourceVisibility ?? "mask-only",
            },
          };
        }
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
        const scene = findSceneGroup(next, command.sceneId);
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
        const node = sceneLayers(scene).find((item) => item.id === command.layerId);
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
            offset: {
              x: command.effect.offsetX,
              y: command.effect.offsetY,
            },
            blur: command.effect.blur,
            color: command.effect.color,
            opacity: command.effect.opacity ?? 25,
          });
        } else if (command.effect.type === "glow") {
          effects.push({
            id: command.effectId,
            type: "glow",
            radius: command.effect.radius,
            color: command.effect.color,
            opacity: command.effect.opacity ?? 100,
          });
        } else {
          effects.push({
            id: command.effectId,
            type: "color-adjust",
            brightness: command.effect.brightness ?? 100,
            contrast: command.effect.contrast ?? 100,
            saturation: command.effect.saturation ?? 100,
            "hue-rotate": command.effect["hue-rotate"] ?? 0,
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
        const scene = findSceneGroup(next, command.sceneId);
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
        let camera = findLayer(next, command.cameraId);
        if (!camera) {
          const atoms = defaultTransform(command.transform);
          camera = {
            id: command.cameraId,
            type: "camera",
            parentLayerId: null,
            zIndex: next.layers.filter((layer) => layer.parentLayerId === null).length,
            timing: scene.timing ?? { start: 0, duration: 1 },
            transform: atoms.transform,
            appearance: atoms.appearance,
            payload: {
              zoom: command.zoom ?? 1,
              projection: "orthographic",
              ...(command.parallaxStrength !== undefined
                ? { parallaxStrength: command.parallaxStrength }
                : {}),
            },
          };
          next.layers.push(camera);
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
          const ext = getAiExt(next);
          ext.activeCameraLayerId = command.cameraId;
          ext.space = "layered-2.5d";
          setAiExt(next, ext);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        if (!sceneLayers(scene).some((node) => node.id === parsed.data.targetLayerId)) {
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
        const scene = findSceneGroup(next, command.sceneId);
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
        void baked.drivers;
        if (baked.tracks.length > 0) {
          const clipId =
            command.clipId ??
            `clip.recipe.${command.recipeId}.${command.targetLayerId}`;
          const ext = getAiExt(next);
          ext.motionUnits.push({
            id: clipId,
            layerId: command.targetLayerId,
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
          setAiExt(next, ext);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        if (sceneLayers(scene).some((node) => node.id === command.layerId)) {
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
        const parentLayerId = command.parentLayerId ?? scene.id;
        if (
          parentLayerId !== scene.id &&
          !sceneLayers(scene).some((node) => node.id === parentLayerId)
        ) {
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
          ...defaultTransform(command.transform),
          payload: {
            assetId: command.assetId,
            ...(command.fit ? { fit: command.fit } : {}),
            ...(command.crop ? { crop: command.crop } : {}),
          },
          ...(semantic ? { semantic } : {}),
        };
        insertLayer(scene, node);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        if (sceneLayers(scene).some((node) => node.id === command.layerId)) {
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
        const parentLayerId = command.parentLayerId ?? scene.id;
        if (
          parentLayerId !== scene.id &&
          !sceneLayers(scene).some((node) => node.id === parentLayerId)
        ) {
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
          ...defaultTransform(command.transform),
          payload: {
            contours: command.contours,
          },
          ...(style ? { style } : {}),
          ...(semantic ? { semantic } : {}),
        };
        insertLayer(scene, node);
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
        const scene = findSceneGroup(next, command.sceneId);
        const node = scene
          ? sceneLayers(scene).find((item) => item.id === command.layerId)
          : undefined;
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
        const scene = findSceneGroup(next, command.sceneId);
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
        const scene = findSceneGroup(next, command.sceneId);
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
        const existing = sceneLayers(scene).find((n) => n.id === bgId);
        const width = next.composition.width;
        const height = next.composition.height;
        if (existing && existing.type === "solid") {
          existing.payload = { color: command.fill };
          Object.assign(existing, visualLayerAtoms({ x: width / 2, y: height / 2, width, height }));
        } else {
          insertLayer(scene, {
            id: bgId,
            type: "solid",
            name: "Scene Background",
            parentLayerId: scene.id,
            ...visualLayerAtoms({ x: width / 2, y: height / 2, width, height }),
            payload: { color: command.fill },
          });
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
