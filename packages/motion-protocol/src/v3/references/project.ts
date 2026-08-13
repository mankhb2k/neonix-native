/**
 * V3 project-wide reference validation.
 */
import type { MotionProjectV3 } from "../project";
import type { NodeV3 } from "../nodes";
import { isVariableReference } from "../values";
import type { ProjectVariableV3 } from "../variables";
import { duplicates } from "./helpers";
import { validateNodeGraphV3 } from "./node-graph";
import { validateNodeAssetsV3 } from "./node-assets";
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

const NODE_PUBLIC_PAYLOAD_PROPERTIES: Record<NodeV3["type"], Set<string>> = {
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

function isPublicTargetPropertyValid(node: NodeV3, property: string): boolean {
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
 * Validate component nodes within a scene (or component) node list.
 *
 * Each `type: "component"` node must reference an existing component, its
 * `variantId` (when present) must be declared by that component, and its
 * `publicProps` keys must be declared `publicTargets`.
 */
function validateComponentNodeReferences(
  nodes: NodeV3[],
  componentById: Map<string, import("../components").EmbeddedComponentV3>,
  variableById: Map<string, ProjectVariableV3>,
  pathPrefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  for (const node of nodes) {
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
    const publicTargetById = new Map(
      component.publicTargets.map((t) => [t.id, t] as const),
    );
    for (const [targetId, value] of Object.entries(
      node.payload.publicProps ?? {},
    )) {
      const target = publicTargetById.get(targetId);
      if (!target) {
        issues.push({
          path: `${path}.payload.publicProps.${targetId}`,
          message: `Component "${component.id}" does not expose public target "${targetId}"`,
        });
        continue;
      }
      const kind =
        target.valueKind ?? inferPublicTargetValueKind(target.property);
      if (!kind) continue;
      if (isVariableReference(value)) {
        const refId = extractVariableReferenceId(value);
        if (refId) {
          const variable = variableById.get(refId);
          if (variable && !variableTypeMatchesValueKind(variable.type, kind)) {
            issues.push({
              path: `${path}.payload.publicProps.${targetId}`,
              message: `publicProps "${targetId}" references variable "${refId}" of type "${variable.type}", expected value kind "${kind}"`,
            });
          }
        }
      } else if (!literalMatchesValueKind(value, kind)) {
        issues.push({
          path: `${path}.payload.publicProps.${targetId}`,
          message: `publicProps "${targetId}" value is incompatible with expected value kind "${kind}"`,
        });
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
      if (clip.source.kind === "scene") {
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
      } else if (clip.source.kind === "component") {
        const component = componentById.get(clip.source.componentId);
        if (!component) {
          issues.push({
            path,
            message: `Unknown component: ${clip.source.componentId}`,
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
        !scene.nodes.some((node) => node.id === bindingTarget.nodeId)
      ) {
        issues.push({
          path: `${path}.target.nodeId`,
          message: `Unknown node: ${bindingTarget.nodeId}`,
        });
      }
    } else if (bindingTarget.kind === "componentNode") {
      const scene = sceneById.get(bindingTarget.sceneId);
      const node = scene?.nodes.find((n) => n.id === bindingTarget.nodeId);
      if (!scene) {
        issues.push({
          path: `${path}.target.sceneId`,
          message: `Unknown scene: ${bindingTarget.sceneId}`,
        });
      } else if (!node) {
        issues.push({
          path: `${path}.target.nodeId`,
          message: `Unknown node: ${bindingTarget.nodeId}`,
        });
      } else if (node.type !== "component") {
        issues.push({
          path: `${path}.target.nodeId`,
          message: `Node "${bindingTarget.nodeId}" is not a component node (type "${node.type}")`,
        });
      } else {
        const component = componentById.get(node.payload.componentId);
        if (!component) {
          issues.push({
            path: `${path}.target.nodeId`,
            message: `Component node "${bindingTarget.nodeId}" references unknown component "${node.payload.componentId}"`,
          });
        } else if (
          !component.publicTargets.some((t) => t.id === bindingTarget.targetId)
        ) {
          issues.push({
            path: `${path}.target.targetId`,
            message: `Component "${node.payload.componentId}" does not expose public target "${bindingTarget.targetId}"`,
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
      } else {
        // Consumer bindings must go through public targets only
        const publicTarget = component.publicTargets.find(
          (t) => t.id === bindingTarget.targetId,
        );
        if (!publicTarget) {
          issues.push({
            path: `${path}.target.targetId`,
            message: `Component "${bindingTarget.componentId}" does not expose public target "${bindingTarget.targetId}"`,
          });
        }
      }
    }
  }

  // ── scenes ───────────────────────────────────────────────────────────
  for (const scene of project.scenes) {
    issues.push(
      ...validateNodeGraphV3(scene.nodes, `scenes.${scene.id}.nodes`),
    );
    issues.push(
      ...validateNodeAssetsV3(
        scene.nodes,
        project.assets,
        `scenes.${scene.id}.nodes`,
      ),
    );
    issues.push(
      ...validateComponentNodeReferences(
        scene.nodes,
        componentById,
        variableById,
        `scenes.${scene.id}.nodes`,
      ),
    );
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    for (const clip of scene.clips) {
      if (clip.targetId && !nodeIds.has(clip.targetId)) {
        issues.push({
          path: `scenes.${scene.id}.clips.${clip.id}.targetId`,
          message: `Unknown node: ${clip.targetId}`,
        });
      }
    }
  }

  // ── components ───────────────────────────────────────────────────────
  for (const component of project.components) {
    issues.push(
      ...validateNodeGraphV3(
        component.nodes,
        `components.${component.id}.nodes`,
      ),
    );
    issues.push(
      ...validateNodeAssetsV3(
        component.nodes,
        project.assets,
        `components.${component.id}.nodes`,
      ),
    );
    issues.push(
      ...validateComponentNodeReferences(
        component.nodes,
        componentById,
        variableById,
        `components.${component.id}.nodes`,
      ),
    );

    // Validate publicTargets
    const targetIds = component.publicTargets.map((t) => t.id);
    for (const dupId of new Set(duplicates(targetIds))) {
      issues.push({
        path: `components.${component.id}.publicTargets`,
        message: `Duplicate publicTarget id: ${dupId}`,
      });
    }
    const componentNodeIds = new Set(component.nodes.map((n) => n.id));
    for (const target of component.publicTargets) {
      const node = component.nodes.find((n) => n.id === target.nodeId);
      if (!node) {
        issues.push({
          path: `components.${component.id}.publicTargets.${target.id}.nodeId`,
          message: `publicTarget "${target.id}" references unknown node: ${target.nodeId}`,
        });
      } else if (!isPublicTargetPropertyValid(node, target.property)) {
        issues.push({
          path: `components.${component.id}.publicTargets.${target.id}.property`,
          message: `publicTarget "${target.id}" exposes unsupported property "${target.property}" for ${node.type} node "${node.id}"`,
        });
      }
    }

    // M16: component root nodes must have parentId === null
    for (const node of component.nodes) {
      if (node.parentId !== null && !componentNodeIds.has(node.parentId)) {
        issues.push({
          path: `components.${component.id}.nodes.${node.id}.parentId`,
          message: `Component root node "${node.id}" references external parent "${node.parentId}" — component nodes must not reference nodes outside the component`,
        });
      }
    }
    // Validate publicParam duplicate ids
    const paramIds = component.publicParams.map((p) => p.id);
    for (const dupId of new Set(duplicates(paramIds))) {
      issues.push({
        path: `components.${component.id}.publicParams`,
        message: `Duplicate publicParam id: ${dupId}`,
      });
    }

    // Validate variant duplicate ids
    const variantIds = component.variants.map((v) => v.id);
    for (const dupId of new Set(duplicates(variantIds))) {
      issues.push({
        path: `components.${component.id}.variants`,
        message: `Duplicate variant id: ${dupId}`,
      });
    }
    // Variant overrides must target declared public targets only.
    const publicTargetIdSet = new Set(component.publicTargets.map((t) => t.id));
    for (const variant of component.variants) {
      for (const targetId of Object.keys(variant.overrides ?? {})) {
        if (!publicTargetIdSet.has(targetId)) {
          issues.push({
            path: `components.${component.id}.variants.${variant.id}.overrides.${targetId}`,
            message: `Variant "${variant.id}" overrides unknown public target "${targetId}"`,
          });
        }
      }
    }
    // Validate publicParams — variableId must reference a component-local
    // variable OR a project-level variable (fallback for shared params)
    const componentVariableIds = new Set(component.variables.map((v) => v.id));
    for (const param of component.publicParams) {
      if (
        !componentVariableIds.has(param.variableId) &&
        !variableIds.has(param.variableId)
      ) {
        issues.push({
          path: `components.${component.id}.publicParams.${param.id}.variableId`,
          message: `publicParam "${param.id}" references unknown variable: ${param.variableId}`,
        });
      }
    }
  }

  return issues;
}
