/**
 * V3 project-wide reference validation.
 */
import type { MotionProjectV3 } from "../project";
import type { LayerV3 } from "../layers";
import { isVariableReference } from "../values";
import type { ProjectVariableV3 } from "../variables";
import {
  defaultAnimatableForPropKind,
  defaultInterpolationForPropKind,
  type ComponentPropV3,
} from "../components";
import { isPropKeyframesValue } from "../prop-values";
import { duplicates } from "./helpers";
import { validateLayerGraphV3 } from "./layer-graph";
import { validateLayerAssetsV3 } from "./layer-assets";
import type { ReferenceIssue } from "./types";

const TRANSFORM_PUBLIC_PROPERTIES = new Set([
  "transform.x",
  "transform.y",
  "transform.z",
  "transform.depth",
  "transform.width",
  "transform.height",
  "transform.rotation",
  "transform.rotationX",
  "transform.rotationY",
  "transform.rotationZ",
  "transform.scaleX",
  "transform.scaleY",
  "transform.anchorX",
  "transform.anchorY",
  "transform.anchorZ",
  "transform.opacity",
  "transform.visible",
  "transform.flipX",
  "transform.flipY",
]);

const BASE_PUBLIC_PROPERTIES = new Set(["visible", "locked", "name", "zIndex"]);

const PAINT_STYLE_PUBLIC_PROPERTIES = new Set([
  "style.fill",
  "style.fillOpacity",
  "style.stroke",
  "style.strokeWidth",
  "style.strokeOpacity",
  "style.lineCap",
  "style.lineJoin",
  "style.miterLimit",
  "style.dash",
  "style.dashOffset",
]);

const NODE_PUBLIC_PAYLOAD_PROPERTIES: Record<LayerV3["type"], Set<string>> = {
  group: new Set(["payload.compositing.mode"]),
  bone: new Set([
    "payload.length",
    "payload.restRotation",
    "payload.rotationLimits.min",
    "payload.rotationLimits.max",
  ]),
  text: new Set([
    "payload.content",
    "payload.content.text",
    "payload.fontAssetId",
    "payload.fontSize",
    "payload.color",
    "payload.alignment",
    "payload.wrap",
    "payload.lineHeight",
    "payload.letterSpacing",
    "payload.maxLines",
    "payload.overflow",
  ]),
  shape: new Set(["payload.shape", "payload.cornerRadius", "payload.points"]),
  path: new Set(["payload.contours", "payload.morphTargets"]),
  image: new Set([
    "payload.assetId",
    "payload.fit",
    "payload.crop",
    "payload.crop.x",
    "payload.crop.y",
    "payload.crop.width",
    "payload.crop.height",
  ]),
  svg: new Set([
    "payload.assetId",
    "payload.fit",
    "payload.crop",
    "payload.crop.x",
    "payload.crop.y",
    "payload.crop.width",
    "payload.crop.height",
  ]),
  video: new Set([
    "payload.assetId",
    "payload.fit",
    "payload.crop",
    "payload.crop.x",
    "payload.crop.y",
    "payload.crop.width",
    "payload.crop.height",
    "payload.trimStart",
    "payload.trimEnd",
    "payload.loop",
    "payload.muted",
    "payload.framePolicy",
  ]),
  camera: new Set([
    "payload.projection",
    "payload.zoom",
    "payload.parallaxStrength",
    "payload.focalLength",
    "payload.fieldOfView",
    "payload.near",
    "payload.far",
  ]),
  solid: new Set(["payload.width", "payload.height", "payload.color"]),
  adjustment: new Set([
    "payload.brightness",
    "payload.contrast",
    "payload.saturation",
  ]),
  component: new Set([]),
};

function isPublicTargetPropertyValid(node: LayerV3, property: string): boolean {
  if (BASE_PUBLIC_PROPERTIES.has(property)) return true;
  if (TRANSFORM_PUBLIC_PROPERTIES.has(property)) return true;
  if (
    (node.type === "shape" || node.type === "path") &&
    PAINT_STYLE_PUBLIC_PROPERTIES.has(property)
  ) {
    return true;
  }
  return NODE_PUBLIC_PAYLOAD_PROPERTIES[node.type].has(property);
}

/**
 * Infer the expected value kind for a public-target property path.
 * Returns `undefined` when no confident inference is possible.
 */
function inferPublicTargetValueKind(property: string): string | undefined {
  const segments = property.toLowerCase().split(".");
  const last = segments[segments.length - 1];
  if (!last) return undefined;

  if (last === "visible" || last === "flipx" || last === "flipy") {
    return "boolean";
  }
  if (
    last === "enabled" ||
    last === "muted" ||
    last === "loop" ||
    last === "locked"
  ) {
    return "boolean";
  }
  if (
    last.includes("color") ||
    last === "fill" ||
    last === "stroke" ||
    last === "tint" ||
    last === "background"
  ) {
    return "color";
  }
  if (last === "text" || last === "label" || last === "name") {
    return "string";
  }
  if (last === "assetid" || last === "fontassetid") {
    return "asset";
  }
  if (
    /^(?:opacity|width|height|scalex|scaley|rotation|x|y|z|depth|fontsize|letterspacing|lineheight|rate|volume|duration|start|end|progress|radius|length|fov|zoom|near|far|anchorx|anchory|anchorz|rotationx|rotationy|rotationz|trimstart|trimend|cornerradius|strokewidth|fillopacity|strokeopacity|maxlines)$/.test(
      last,
    )
  ) {
    return "number";
  }
  return undefined;
}

/** Check whether a literal JSON value matches an expected value kind. */
function literalMatchesValueKind(value: unknown, kind: string): boolean {
  switch (kind) {
    case "number":
    case "angle":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "string":
    case "color":
    case "asset":
      return typeof value === "string";
    case "vec2":
      return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((v) => typeof v === "number")
      );
    case "path":
    case "gradient":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    default:
      return true;
  }
}

/** Check whether a variable type is compatible with an expected value kind. */
function variableTypeMatchesValueKind(
  variableType: string,
  kind: string,
): boolean {
  switch (kind) {
    case "number":
    case "angle":
      return variableType === "number";
    case "boolean":
      return variableType === "boolean";
    case "string":
      return variableType === "string" || variableType === "enum";
    case "color":
      return variableType === "color";
    case "asset":
      return variableType === "asset";
    case "vec2":
    case "path":
    case "gradient":
      return variableType === "list";
    default:
      return true;
  }
}

function isPropAnimatable(prop: ComponentPropV3): boolean {
  return prop.animatable ?? defaultAnimatableForPropKind(prop.kind);
}

function assetTypeMatchesAssetKind(
  assetType: string,
  assetKind: string,
): boolean {
  if (assetKind === "media") {
    return assetType === "image" || assetType === "video";
  }
  return assetType === assetKind;
}

function literalMatchesPropKind(value: unknown, propKind: string): boolean {
  switch (propKind) {
    case "text":
    case "color":
    case "asset":
    case "choice":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
}

function variableTypeMatchesPropKind(
  variableType: string,
  propKind: string,
): boolean {
  switch (propKind) {
    case "text":
      return variableType === "string" || variableType === "enum";
    case "choice":
      return variableType === "enum" || variableType === "string";
    case "color":
      return variableType === "color";
    case "number":
      return variableType === "number";
    case "boolean":
      return variableType === "boolean";
    case "asset":
      return variableType === "asset";
    default:
      return true;
  }
}

function propKindsCompatible(parentKind: string, childKind: string): boolean {
  if (parentKind === childKind) return true;
  if (parentKind === "choice" && childKind === "text") return true;
  if (parentKind === "text" && childKind === "choice") return true;
  return false;
}

function allowedKeyframeInterpolations(propKind: string): Set<string> {
  if (propKind === "number") return new Set(["linear", "step"]);
  if (propKind === "color") return new Set(["color", "step"]);
  return new Set(["step"]);
}

type AssetLike = { id: string; assetType: string };

function validateAssetIdForProp(
  assetId: string,
  prop: ComponentPropV3,
  assetById: Map<string, AssetLike> | undefined,
  path: string,
): ReferenceIssue[] {
  if (!assetById) return [];
  const asset = assetById.get(assetId);
  if (!asset) {
    return [
      {
        path,
        message: `props "${prop.id}" references unknown asset "${assetId}"`,
      },
    ];
  }
  if (
    prop.assetKind &&
    !assetTypeMatchesAssetKind(asset.assetType, prop.assetKind)
  ) {
    return [
      {
        path,
        message: `props "${prop.id}" asset "${assetId}" has type "${asset.assetType}", expected assetKind "${prop.assetKind}"`,
      },
    ];
  }
  return [];
}

function validateVariableAgainstProp(
  variable: ProjectVariableV3,
  prop: ComponentPropV3,
  assetById: Map<string, AssetLike> | undefined,
  path: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  if (!variableTypeMatchesPropKind(variable.type, prop.kind)) {
    issues.push({
      path,
      message: `props "${prop.id}" references variable "${variable.id}" of type "${variable.type}", expected kind "${prop.kind}"`,
    });
    return issues;
  }

  if (prop.kind === "choice" && prop.options) {
    if (variable.type === "enum") {
      const extra = variable.options.filter(
        (option) => !prop.options!.includes(option),
      );
      if (extra.length > 0) {
        issues.push({
          path,
          message: `props "${prop.id}" enum variable "${variable.id}" has options not in prop options: ${extra.join(", ")}`,
        });
      }
      if (!prop.options.includes(variable.value)) {
        issues.push({
          path,
          message: `props "${prop.id}" enum variable "${variable.id}" value "${variable.value}" is not in options`,
        });
      }
    } else if (
      variable.type === "string" &&
      !prop.options.includes(variable.value)
    ) {
      issues.push({
        path,
        message: `props "${prop.id}" string variable "${variable.id}" value "${variable.value}" is not in options`,
      });
    }
  }

  if (prop.kind === "asset" && variable.type === "asset") {
    if (
      prop.assetKind &&
      !assetTypeMatchesAssetKind(variable.assetKind, prop.assetKind)
    ) {
      issues.push({
        path,
        message: `props "${prop.id}" asset variable "${variable.id}" has assetKind "${variable.assetKind}", expected "${prop.assetKind}"`,
      });
    }
    issues.push(
      ...validateAssetIdForProp(variable.value, prop, assetById, path),
    );
  }

  return issues;
}

function validatePropValue(
  value: unknown,
  prop: ComponentPropV3,
  variableById: Map<string, ProjectVariableV3>,
  assetById: Map<string, AssetLike> | undefined,
  path: string,
  sceneDuration?: number,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];

  if (isPropKeyframesValue(value)) {
    if (!isPropAnimatable(prop)) {
      issues.push({
        path,
        message: `Prop "${prop.id}" is not animatable; keyframes are not allowed`,
      });
      return issues;
    }
    const allowed = allowedKeyframeInterpolations(prop.kind);
    const interpolation =
      value.interpolation ?? defaultInterpolationForPropKind(prop.kind);
    if (!allowed.has(interpolation)) {
      issues.push({
        path,
        message: `Prop "${prop.id}" keyframes interpolation "${interpolation}" is invalid for kind "${prop.kind}"`,
      });
    }
    let prevT: number | undefined;
    for (let i = 0; i < value.keys.length; i++) {
      const key = value.keys[i]!;
      if (prevT !== undefined) {
        if (key.t === prevT) {
          issues.push({
            path: `${path}.keys.${i}.t`,
            message: `Prop "${prop.id}" keyframes must not duplicate t=${key.t}`,
          });
        } else if (key.t < prevT) {
          issues.push({
            path: `${path}.keys.${i}.t`,
            message: `Prop "${prop.id}" keyframes must be sorted by increasing t`,
          });
        }
      }
      prevT = key.t;
      if (sceneDuration !== undefined && key.t > sceneDuration) {
        issues.push({
          path: `${path}.keys.${i}.t`,
          message: `Prop "${prop.id}" keyframe t=${key.t} exceeds scene duration ${sceneDuration}`,
        });
      }
      issues.push(
        ...validatePropValue(
          key.value,
          prop,
          variableById,
          assetById,
          `${path}.keys.${i}.value`,
        ),
      );
    }
    return issues;
  }

  if (isVariableReference(value)) {
    const refId = extractVariableReferenceId(value);
    if (!refId) return issues;
    const variable = variableById.get(refId);
    if (!variable) {
      issues.push({
        path,
        message: `props "${prop.id}" references unknown variable "${refId}"`,
      });
      return issues;
    }
    issues.push(
      ...validateVariableAgainstProp(variable, prop, assetById, path),
    );
    return issues;
  }

  if (!literalMatchesPropKind(value, prop.kind)) {
    issues.push({
      path,
      message: `props "${prop.id}" value is incompatible with expected kind "${prop.kind}"`,
    });
    return issues;
  }

  if (prop.kind === "choice" && prop.options && typeof value === "string") {
    if (!prop.options.includes(value)) {
      issues.push({
        path,
        message: `props "${prop.id}" value "${value}" is not in options`,
      });
    }
  }

  if (prop.kind === "asset" && typeof value === "string") {
    issues.push(...validateAssetIdForProp(value, prop, assetById, path));
  }

  return issues;
}

function collectDirectChildComponentIds(
  layers: LayerV3[],
): Array<{ layerId: string; componentId: string }> {
  return layers
    .filter(
      (n): n is Extract<LayerV3, { type: "component" }> =>
        n.type === "component",
    )
    .map((n) => ({ layerId: n.id, componentId: n.payload.componentId }));
}

function detectComponentCycles(
  componentById: Map<string, import("../components").ComponentDefinitionV3>,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(componentId: string, stack: string[]): void {
    if (visited.has(componentId)) return;
    if (visiting.has(componentId)) {
      issues.push({
        path: `components.${componentId}`,
        message: `Component cycle detected: ${[...stack, componentId].join(" → ")}`,
      });
      return;
    }
    visiting.add(componentId);
    const component = componentById.get(componentId);
    if (component) {
      for (const child of collectDirectChildComponentIds(component.layers)) {
        dfs(child.componentId, [...stack, componentId]);
      }
    }
    visiting.delete(componentId);
    visited.add(componentId);
  }

  for (const componentId of componentById.keys()) {
    dfs(componentId, []);
  }
  return issues;
}

/** Extract the variable id from a top-level `{ ref: { kind: "variable", id } }` shape. */
function extractVariableReferenceId(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const ref = (value as Record<string, unknown>).ref;
  if (ref === null || typeof ref !== "object" || Array.isArray(ref)) {
    return undefined;
  }
  const record = ref as Record<string, unknown>;
  if (record.kind === "variable" && typeof record.id === "string") {
    return record.id;
  }
  return undefined;
}

/**
 * Validate component layers within a scene (or component) node list.
 *
 * Each `type: "component"` node must reference an existing component, its
 * `variantId` (when present) must be declared, and `payload.props` keys must
 * match declared prop ids with compatible values.
 */
function validateComponentLayerReferences(
  layers: LayerV3[],
  componentById: Map<string, import("../components").ComponentDefinitionV3>,
  variableById: Map<string, ProjectVariableV3>,
  assetById: Map<string, AssetLike>,
  pathPrefix: string,
  sceneDuration?: number,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  for (const node of layers) {
    if (node.type !== "component") continue;
    const path = `${pathPrefix}.${node.id}`;
    const component = componentById.get(node.payload.componentId);
    if (!component) {
      issues.push({
        path: `${path}.payload.componentId`,
        message: `Component node "${node.id}" references unknown component: ${node.payload.componentId}`,
      });
      continue;
    }
    if (
      node.payload.variantId !== undefined &&
      !component.variants.some((v) => v.id === node.payload.variantId)
    ) {
      issues.push({
        path: `${path}.payload.variantId`,
        message: `Component "${component.id}" does not declare variant "${node.payload.variantId}"`,
      });
    }
    const propById = new Map(component.props.map((p) => [p.id, p] as const));
    for (const [propId, value] of Object.entries(node.payload.props ?? {})) {
      const prop = propById.get(propId);
      if (!prop) {
        issues.push({
          path: `${path}.payload.props.${propId}`,
          message: `Component "${component.id}" does not declare prop "${propId}"`,
        });
        continue;
      }
      issues.push(
        ...validatePropValue(
          value,
          prop,
          variableById,
          assetById,
          `${path}.payload.props.${propId}`,
          sceneDuration,
        ),
      );
    }
  }
  return issues;
}

function collectScenePropTrackConflicts(
  project: MotionProjectV3,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  for (const scene of project.scenes) {
    for (const node of scene.layers) {
      if (node.type !== "component") continue;
      const keyframedProps = new Set<string>();
      for (const [propId, value] of Object.entries(node.payload.props ?? {})) {
        if (isPropKeyframesValue(value)) keyframedProps.add(propId);
      }
      if (keyframedProps.size === 0) continue;
      for (const clip of scene.clips ?? []) {
        if (clip.layerId !== node.id) continue;
        const source = clip.source;
        if (!source || source.kind !== "tracks") continue;
        for (const track of source.tracks ?? []) {
          const match = /^payload\.props\.(.+)$/.exec(track.property);
          if (!match) continue;
          const propId = match[1]!;
          if (keyframedProps.has(propId)) {
            issues.push({
              path: `scenes.${scene.id}.clips.${clip.id}`,
              message: `Conflict: component node "${node.id}" prop "${propId}" has both payload keyframes and scene track animation`,
            });
          }
        }
      }
    }
  }
  return issues;
}

export function validateMotionProjectV3References(
  project: MotionProjectV3,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const componentById = new Map(
    project.components.map((component) => [component.id, component]),
  );
  const variableIds = new Set(project.variables.map((variable) => variable.id));
  const variableById = new Map(
    project.variables.map((variable) => [variable.id, variable] as const),
  );
  for (const component of project.components) {
    for (const variable of component.variables) {
      if (!variableById.has(variable.id)) {
        variableById.set(variable.id, variable);
      }
    }
  }
  const assetById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const audioTrackById = new Map(
    project.timeline.audioTracks.map((track) => [track.id, track]),
  );

  // ── duplicates ───────────────────────────────────────────────────────
  for (const id of new Set(duplicates(project.scenes.map((s) => s.id)))) {
    issues.push({ path: "scenes", message: `Duplicate scene id: ${id}` });
  }
  for (const id of new Set(duplicates(project.variables.map((v) => v.id)))) {
    issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  }
  for (const id of new Set(duplicates(project.assets.map((a) => a.id)))) {
    issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  }
  for (const id of new Set(duplicates(project.bindings.map((b) => b.id)))) {
    issues.push({ path: "bindings", message: `Duplicate binding id: ${id}` });
  }
  for (const id of new Set(duplicates(project.components.map((c) => c.id)))) {
    issues.push({
      path: "components",
      message: `Duplicate component id: ${id}`,
    });
  }
  const trackIds = project.timeline.visualTracks.map((track) => track.id);
  for (const id of new Set(duplicates(trackIds))) {
    issues.push({
      path: "timeline.visualTracks",
      message: `Duplicate visual track id: ${id}`,
    });
  }

  // H6: audio track duplicate ids
  const audioIds = project.timeline.audioTracks.map((t) => t.id);
  for (const id of new Set(duplicates(audioIds))) {
    issues.push({
      path: "timeline.audioTracks",
      message: `Duplicate audio track id: ${id}`,
    });
  }

  // H7: caption track duplicate ids
  const captionIds = project.timeline.captionTracks.map((t) => t.id);
  for (const id of new Set(duplicates(captionIds))) {
    issues.push({
      path: "timeline.captionTracks",
      message: `Duplicate caption track id: ${id}`,
    });
  }

  // ── visual clips ─────────────────────────────────────────────────────
  for (const track of project.timeline.visualTracks) {
    for (const clip of track.clips) {
      const path = `timeline.visualTracks.${track.id}.clips.${clip.id}.source`;
      const scene = sceneById.get(clip.source.sceneId);
      if (!scene) {
        issues.push({
          path,
          message: `Unknown scene: ${clip.source.sceneId}`,
        });
        continue;
      }

      // When the clip does not loop, its source window must fit inside the
      // referenced scene: trimStart + duration * playbackRate ≤ scene.duration.
      if (!clip.loop) {
        const rate = clip.playbackRate ?? 1;
        const consumed = (clip.trimStart ?? 0) + clip.duration * rate;
        if (consumed > scene.duration + 1e-9) {
          issues.push({
            path: `timeline.visualTracks.${track.id}.clips.${clip.id}.trimStart`,
            message: `Visual clip "${clip.id}" consumes ${consumed}s of source scene "${scene.id}" (duration ${scene.duration}s) without looping`,
          });
        }
      }
    }
  }

  // ── audio clips ─────────────────────────────────────────────────────
  for (const audio of project.timeline.audioTracks) {
    for (const clip of audio.clips) {
      const asset = assetById.get(clip.assetId);
      const path = `timeline.audioTracks.${audio.id}.clips.${clip.id}.assetId`;
      if (!asset) {
        issues.push({ path, message: `Unknown asset: ${clip.assetId}` });
      } else if (asset.assetType !== "audio") {
        issues.push({
          path,
          message: `Asset ${clip.assetId} has type ${asset.assetType}, expected audio`,
        });
      }
    }
  }

  // ── caption tracks ───────────────────────────────────────────────────
  for (const caption of project.timeline.captionTracks) {
    if (caption.audioTrackId && !audioTrackById.has(caption.audioTrackId)) {
      issues.push({
        path: `timeline.captionTracks.${caption.id}.audioTrackId`,
        message: `Unknown audio track: ${caption.audioTrackId}`,
      });
    }
  }

  // ── bindings ─────────────────────────────────────────────────────────
  for (const binding of project.bindings) {
    const path = `bindings.${binding.id}`;
    const bindingTarget = binding.target;
    if (!variableIds.has(binding.source.variableId)) {
      issues.push({
        path: `${path}.source.variableId`,
        message: `Unknown variable: ${binding.source.variableId}`,
      });
    }
    if (bindingTarget.kind === "scene") {
      const scene = sceneById.get(bindingTarget.sceneId);
      if (!scene) {
        issues.push({
          path: `${path}.target.sceneId`,
          message: `Unknown scene: ${bindingTarget.sceneId}`,
        });
      } else if (
        !scene.layers.some((node) => node.id === bindingTarget.layerId)
      ) {
        issues.push({
          path: `${path}.target.layerId`,
          message: `Unknown node: ${bindingTarget.layerId}`,
        });
      }
    } else if (bindingTarget.kind === "componentLayer") {
      const scene = sceneById.get(bindingTarget.sceneId);
      const node = scene?.layers.find((n) => n.id === bindingTarget.layerId);
      if (!scene) {
        issues.push({
          path: `${path}.target.sceneId`,
          message: `Unknown scene: ${bindingTarget.sceneId}`,
        });
      } else if (!node) {
        issues.push({
          path: `${path}.target.layerId`,
          message: `Unknown node: ${bindingTarget.layerId}`,
        });
      } else if (node.type !== "component") {
        issues.push({
          path: `${path}.target.layerId`,
          message: `Node "${bindingTarget.layerId}" is not a component node (type "${node.type}")`,
        });
      } else {
        const component = componentById.get(node.payload.componentId);
        if (!component) {
          issues.push({
            path: `${path}.target.layerId`,
            message: `Component node "${bindingTarget.layerId}" references unknown component "${node.payload.componentId}"`,
          });
        } else if (
          !component.props.some((p) => p.id === bindingTarget.propId)
        ) {
          issues.push({
            path: `${path}.target.propId`,
            message: `Component "${node.payload.componentId}" does not declare prop "${bindingTarget.propId}"`,
          });
        }
      }
    } else {
      const component = componentById.get(bindingTarget.componentId);
      if (!component) {
        issues.push({
          path: `${path}.target.componentId`,
          message: `Unknown component: ${bindingTarget.componentId}`,
        });
      } else if (!component.props.some((p) => p.id === bindingTarget.propId)) {
        issues.push({
          path: `${path}.target.propId`,
          message: `Component "${bindingTarget.componentId}" does not declare prop "${bindingTarget.propId}"`,
        });
      }
    }
  }

  issues.push(...detectComponentCycles(componentById));

  // ── scenes ───────────────────────────────────────────────────────────
  for (const scene of project.scenes) {
    issues.push(
      ...validateLayerGraphV3(scene.layers, `scenes.${scene.id}.layers`),
    );
    issues.push(
      ...validateLayerAssetsV3(
        scene.layers,
        project.assets,
        `scenes.${scene.id}.layers`,
      ),
    );
    issues.push(
      ...validateComponentLayerReferences(
        scene.layers,
        componentById,
        variableById,
        assetById,
        `scenes.${scene.id}.layers`,
        scene.duration,
      ),
    );
    const layerIds = new Set(scene.layers.map((node) => node.id));
    for (const clip of scene.clips) {
      if (clip.layerId && !layerIds.has(clip.layerId)) {
        issues.push({
          path: `scenes.${scene.id}.clips.${clip.id}.layerId`,
          message: `Unknown node: ${clip.layerId}`,
        });
      }
    }
  }

  // ── components ───────────────────────────────────────────────────────
  for (const component of project.components) {
    issues.push(
      ...validateLayerGraphV3(
        component.layers,
        `components.${component.id}.layers`,
      ),
    );
    issues.push(
      ...validateLayerAssetsV3(
        component.layers,
        project.assets,
        `components.${component.id}.layers`,
      ),
    );
    issues.push(
      ...validateComponentLayerReferences(
        component.layers,
        componentById,
        variableById,
        assetById,
        `components.${component.id}.layers`,
      ),
    );

    const propById = new Map(component.props.map((p) => [p.id, p] as const));
    const componentLayerIds = new Set(component.layers.map((n) => n.id));

    // Validate prop duplicate ids
    const propIds = component.props.map((p) => p.id);
    for (const dupId of new Set(duplicates(propIds))) {
      issues.push({
        path: `components.${component.id}.props`,
        message: `Duplicate prop id: ${dupId}`,
      });
    }

    // Validate prop default values match kind (+ asset when present)
    for (const prop of component.props) {
      issues.push(
        ...validatePropValue(
          prop.default,
          prop,
          variableById,
          assetById,
          `components.${component.id}.props.${prop.id}.default`,
        ),
      );
    }

    // Validate propBindings
    const layerPropertySeen = new Map<string, string>();
    const childPropSeen = new Map<string, string>();
    for (const binding of component.propBindings) {
      const prop = propById.get(binding.propId);
      if (!prop) {
        issues.push({
          path: `components.${component.id}.propBindings`,
          message: `propBinding references unknown prop "${binding.propId}"`,
        });
        continue;
      }
      const target = binding.target;
      if (target.kind === "layerProperty") {
        const layerPropertyKey = `${target.layerId}\0${target.property}`;
        if (layerPropertySeen.has(layerPropertyKey)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `Duplicate layerProperty target "${target.layerId}" "${target.property}"`,
          });
        } else {
          layerPropertySeen.set(layerPropertyKey, binding.propId);
        }
        const node = component.layers.find((n) => n.id === target.layerId);
        if (!node) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" references unknown layer "${target.layerId}"`,
          });
        } else if (!isPublicTargetPropertyValid(node, target.property)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" targets unsupported property "${target.property}" on ${node.type} node "${node.id}"`,
          });
        }
      } else {
        const childPropKey = `${target.childLayerId}\0${target.propId}`;
        if (childPropSeen.has(childPropKey)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `Duplicate childProp target "${target.childLayerId}" "${target.propId}"`,
          });
        } else {
          childPropSeen.set(childPropKey, binding.propId);
        }
        const childNode = component.layers.find((n) => n.id === target.childLayerId);
        if (!childNode) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" references unknown child "${target.childLayerId}"`,
          });
        } else if (childNode.type !== "component") {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding childProp target "${target.childLayerId}" is not a component node (type "${childNode.type}")`,
          });
        } else {
          const childDef = componentById.get(childNode.payload.componentId);
          if (!childDef) {
            issues.push({
              path: `components.${component.id}.propBindings`,
              message: `propBinding child component "${childNode.payload.componentId}" is not defined in project`,
            });
          } else {
            const childProp = childDef.props.find((p) => p.id === target.propId);
            if (!childProp) {
              issues.push({
                path: `components.${component.id}.propBindings`,
                message: `propBinding forwards to unknown child prop "${target.propId}" on component "${childDef.id}"`,
              });
            } else if (!propKindsCompatible(prop.kind, childProp.kind)) {
              issues.push({
                path: `components.${component.id}.propBindings`,
                message: `propBinding kind mismatch: parent prop "${prop.id}" (${prop.kind}) → child prop "${childProp.id}" (${childProp.kind})`,
              });
            }
          }
        }
      }
    }

    for (const binding of component.internalBindings) {
      const bindPath = `components.${component.id}.internalBindings.${binding.id}`;
      if (binding.source.kind === "variable") {
        if (!variableById.has(binding.source.variableId)) {
          issues.push({
            path: `${bindPath}.source.variableId`,
            message: `Unknown variable: ${binding.source.variableId}`,
          });
        }
      }
      if (!componentLayerIds.has(binding.target.layerId)) {
        issues.push({
          path: `${bindPath}.target.layerId`,
          message: `internalBinding "${binding.id}" references unknown layer "${binding.target.layerId}"`,
        });
      }
    }

    // M16: component layers must reference parents within the same definition
    for (const node of component.layers) {
      if (node.parentLayerId !== null && !componentLayerIds.has(node.parentLayerId)) {
        issues.push({
          path: `components.${component.id}.layers.${node.id}.parentLayerId`,
          message: `Component root node "${node.id}" references external parent "${node.parentLayerId}" — component layers must not reference layers outside the component`,
        });
      }
    }
    // Validate variant duplicate ids
    const variantIds = component.variants.map((v) => v.id);
    for (const dupId of new Set(duplicates(variantIds))) {
      issues.push({
        path: `components.${component.id}.variants`,
        message: `Duplicate variant id: ${dupId}`,
      });
    }
    const propIdSet = new Set(component.props.map((p) => p.id));
    for (const variant of component.variants) {
      for (const propId of Object.keys(variant.props ?? {})) {
        if (!propIdSet.has(propId)) {
          issues.push({
            path: `components.${component.id}.variants.${variant.id}.props.${propId}`,
            message: `Variant "${variant.id}" sets unknown prop "${propId}"`,
          });
          continue;
        }
        const prop = propById.get(propId)!;
        const value = variant.props[propId];
        issues.push(
          ...validatePropValue(
            value,
            prop,
            variableById,
            assetById,
            `components.${component.id}.variants.${variant.id}.props.${propId}`,
          ),
        );
      }
    }
  }

  issues.push(...collectScenePropTrackConflicts(project));

  return issues;
}
