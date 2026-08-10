import { motionPropertyCapability } from "../../capabilities";
import type { MotionProjectV2 } from "../project";
import { validateNodeAssets } from "./assets";
import { validateClips } from "./clips";
import { duplicates } from "./helpers";
import { validateNodeGraph } from "./node-graph";
import { validatePropertyPath, validateVariableCapabilityValue } from "./property-path";
import type { ReferenceIssue } from "./types";

export function validateMotionProjectV2References(project: MotionProjectV2): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const variableIds = new Set(project.variables.map((variable) => variable.id));
  const dependencies = new Set(project.dependencies.components.map((dependency) => `${dependency.componentId}@${dependency.version}`));
  for (const id of new Set(duplicates(project.scenes.map((scene) => scene.id)))) issues.push({ path: "scenes", message: `Duplicate scene id: ${id}` });
  for (const id of new Set(duplicates(project.variables.map((variable) => variable.id)))) issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  for (const id of new Set(duplicates(project.assets.map((asset) => asset.id)))) issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  for (const id of new Set(duplicates(project.bindings.map((binding) => binding.id)))) issues.push({ path: "bindings", message: `Duplicate binding id: ${id}` });
  for (const sceneId of project.timeline.sceneOrder) if (!sceneById.has(sceneId)) issues.push({ path: "timeline.sceneOrder", message: `Unknown scene: ${sceneId}` });
  if (new Set(project.timeline.sceneOrder).size !== project.timeline.sceneOrder.length) issues.push({ path: "timeline.sceneOrder", message: "Scene order contains duplicates" });
  for (const sceneId of sceneById.keys()) if (!project.timeline.sceneOrder.includes(sceneId)) issues.push({ path: "timeline.sceneOrder", message: `Scene is not scheduled: ${sceneId}` });
  project.timeline.sceneOrder.forEach((sceneId, index) => {
    const scene = sceneById.get(sceneId);
    const transition = scene?.transition;
    if (!transition || transition.type === "cut") return;
    const next = sceneById.get(project.timeline.sceneOrder[index + 1] ?? "");
    if (!next) {
      issues.push({ path: `scenes.${sceneId}.transition`, message: "Transition requires a following scene" });
    } else if (transition.duration > next.duration) {
      issues.push({ path: `scenes.${sceneId}.transition.duration`, message: `Transition duration ${transition.duration} exceeds next scene duration ${next.duration}` });
    }
  });
  for (const audio of project.timeline.audioTracks) {
    const asset = project.assets.find((candidate) => candidate.id === audio.assetId);
    const path = `timeline.audioTracks.${audio.id}.assetId`;
    if (!asset) issues.push({ path, message: `Unknown asset: ${audio.assetId}` });
    else if (asset.assetType !== "audio") issues.push({ path, message: `Asset ${audio.assetId} has type ${asset.assetType}, expected audio` });
  }
  if (project.metadata.brand.logoAssetId) {
    const logo = project.assets.find((asset) => asset.id === project.metadata.brand.logoAssetId);
    if (!logo) issues.push({ path: "metadata.brand.logoAssetId", message: `Unknown asset: ${project.metadata.brand.logoAssetId}` });
    else if (logo.assetType !== "image" && logo.assetType !== "svg") issues.push({ path: "metadata.brand.logoAssetId", message: `Asset ${logo.id} has type ${logo.assetType}, expected image or svg` });
  }
  for (const scene of project.scenes) {
    issues.push(...validateNodeGraph(scene.nodes, `scenes.${scene.id}.nodes`));
    issues.push(...validateNodeAssets(scene.nodes, project.assets, `scenes.${scene.id}.nodes`));
    issues.push(...validateClips(scene.clips, scene.nodes, project.variables, `scenes.${scene.id}.clips`, { allowComponentAction: true }));
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    if (scene.activeCameraId) {
      const camera = scene.nodes.find((node) => node.id === scene.activeCameraId);
      if (!camera) issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Unknown camera: ${scene.activeCameraId}` });
      else if (camera.type !== "camera") issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Node ${scene.activeCameraId} has type ${camera.type}, expected camera` });
    }
    const transition = scene.transition;
    if (transition && transition.type !== "cut" && transition.duration > scene.duration) {
      issues.push({ path: `scenes.${scene.id}.transition.duration`, message: `Transition duration ${transition.duration} exceeds scene duration ${scene.duration}` });
    }
    for (const node of scene.nodes) {
      if (node.type === "component") {
        const dependency = `${node.payload.componentId}@${node.payload.componentVersion}`;
        if (!dependencies.has(dependency)) issues.push({ path: `scenes.${scene.id}.nodes.${node.id}.payload`, message: `Unpinned component dependency: ${dependency}` });
      }
    }
  }
  for (const binding of project.bindings) {
    if (!variableIds.has(binding.source.variableId)) issues.push({ path: `bindings.${binding.id}.source`, message: `Unknown variable: ${binding.source.variableId}` });
    const scene = sceneById.get(binding.target.sceneId);
    if (!scene) issues.push({ path: `bindings.${binding.id}.target.sceneId`, message: `Unknown scene: ${binding.target.sceneId}` });
    else {
      const target = scene.nodes.find((node) => node.id === binding.target.nodeId);
      if (!target) issues.push({ path: `bindings.${binding.id}.target.nodeId`, message: `Unknown node: ${binding.target.nodeId}` });
      else {
        const propertyPath = `bindings.${binding.id}.target.property`;
        issues.push(...validatePropertyPath(target, binding.target.property, "binding", propertyPath));
        const variable = project.variables.find((candidate) => candidate.id === binding.source.variableId);
        const capability = motionPropertyCapability(target.type, binding.target.property);
        if (variable && capability) {
          const message = validateVariableCapabilityValue(variable, capability, binding.target.property);
          if (message) issues.push({ path: propertyPath, message: message.replace("value for", "binding for") });
        }
      }
    }
  }
  const projectBindingTargets = new Map<string, string>();
  for (const binding of project.bindings) {
    const key = `${binding.target.sceneId}\u0000${binding.target.nodeId}\u0000${binding.target.property}`;
    const previous = projectBindingTargets.get(key);
    if (previous) {
      issues.push({
        path: `bindings.${binding.id}.target`,
        message: `Duplicate binding target ${binding.target.sceneId}/${binding.target.nodeId}.${binding.target.property} (also bound by ${previous})`,
      });
    } else {
      projectBindingTargets.set(key, binding.id);
    }
  }
  return issues;
}
