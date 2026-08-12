/**
 * V3 project-wide reference validation.
 */
import type { MotionProjectV3 } from "../project";
import type { NodeV3 } from "../nodes";
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

export function validateMotionProjectV3References(
  project: MotionProjectV3,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const componentById = new Map(
    project.components.map((component) => [component.id, component]),
  );
  const variableIds = new Set(project.variables.map((variable) => variable.id));
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
        if (!sceneById.has(clip.source.sceneId)) {
          issues.push({
            path,
            message: `Unknown scene: ${clip.source.sceneId}`,
          });
        }
      } else if (!componentById.has(clip.source.componentId)) {
        issues.push({
          path,
          message: `Unknown component: ${clip.source.componentId}`,
        });
      }
    }
  }

  // ── audio tracks ─────────────────────────────────────────────────────
  for (const audio of project.timeline.audioTracks) {
    const asset = assetById.get(audio.assetId);
    const path = `timeline.audioTracks.${audio.id}.assetId`;
    if (!asset) {
      issues.push({ path, message: `Unknown asset: ${audio.assetId}` });
    } else if (asset.assetType !== "audio") {
      issues.push({
        path,
        message: `Asset ${audio.assetId} has type ${asset.assetType}, expected audio`,
      });
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
