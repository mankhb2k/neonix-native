/**
 * V3 project-wide reference validation.
 */
import type { MotionProjectV3 } from "../index";
import { duplicates } from "../../v2/references/helpers";
import { validateNodeGraphV3 } from "./node-graph";
import { validateNodeAssetsV3 } from "./node-assets";
import type { ReferenceIssue } from "./types";

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
    issues.push({ path: "components", message: `Duplicate component id: ${id}` });
  }
  const trackIds = project.timeline.visualTracks.map((track) => track.id);
  for (const id of new Set(duplicates(trackIds))) {
    issues.push({
      path: "timeline.visualTracks",
      message: `Duplicate visual track id: ${id}`,
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
    if (!variableIds.has(binding.source.variableId)) {
      issues.push({
        path: `${path}.source.variableId`,
        message: `Unknown variable: ${binding.source.variableId}`,
      });
    }
    if (binding.target.kind === "scene") {
      const scene = sceneById.get(binding.target.sceneId);
      if (!scene) {
        issues.push({
          path: `${path}.target.sceneId`,
          message: `Unknown scene: ${binding.target.sceneId}`,
        });
      } else if (!scene.nodes.some((node) => node.id === binding.target.nodeId)) {
        issues.push({
          path: `${path}.target.nodeId`,
          message: `Unknown node: ${binding.target.nodeId}`,
        });
      }
    } else {
      const component = componentById.get(binding.target.componentId);
      if (!component) {
        issues.push({
          path: `${path}.target.componentId`,
          message: `Unknown component: ${binding.target.componentId}`,
        });
      } else if (
        !component.nodes.some((node) => node.id === binding.target.nodeId)
      ) {
        issues.push({
          path: `${path}.target.nodeId`,
          message: `Unknown node: ${binding.target.nodeId}`,
        });
      }
    }
  }

  // ── scenes ───────────────────────────────────────────────────────────
  for (const scene of project.scenes) {
    issues.push(...validateNodeGraphV3(scene.nodes, `scenes.${scene.id}.nodes`));
    issues.push(
      ...validateNodeAssetsV3(scene.nodes, project.assets, `scenes.${scene.id}.nodes`),
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
      ...validateNodeGraphV3(component.nodes, `components.${component.id}.nodes`),
    );
    issues.push(
      ...validateNodeAssetsV3(
        component.nodes,
        project.assets,
        `components.${component.id}.nodes`,
      ),
    );
  }

  return issues;
}
