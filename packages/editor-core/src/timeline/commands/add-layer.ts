/**
 * Command family: thêm layer (add-scene-node) trong layer mode.
 */
import type { MotionLayer } from "@motionvideo/motion-protocol";
import { selectionNode } from "../../selection/editor-selection";
import {
  createNodeFromFrameDraft,
  stageSizeForProject,
} from "../internal/scene-utils";
import type { CommandResult, TimelineCommand } from "./command-types";
import type { CommandRunnerState } from "./runner-state";

export function addSceneNode(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "add-scene-node" }>,
): CommandResult {
  const { project, ctx } = state;
  const scene = project.layers.find(
    (l) => l.id === command.sceneId && l.type !== "audio",
  );
  if (!scene || scene.type !== "group") {
    return {
      status: "rejected",
      reason: "missing_lane",
      message: "Scene không tồn tại.",
    };
  }
  const composition = stageSizeForProject(project);
  const layerId = ctx.createId("node");
  const node = createNodeFromFrameDraft(command.draft, layerId, composition);
  const parentLayerId = command.parentLayerId ?? scene.id;
  let parentGroup: Extract<MotionLayer, { type: "group" }> | undefined;
  if (command.parentLayerId != null) {
    const found = scene.children.find((n) => n.id === parentLayerId);
    if (!found || found.type !== "group") {
      return {
        status: "rejected",
        reason: "invalid_document",
        message: "Parent layer must be an existing group node.",
      };
    }
    parentGroup = found;
  }
  const siblingLayers =
    parentGroup != null ? parentGroup.children : scene.children;
  const maxZ = siblingLayers.reduce((m, n) => Math.max(m, n.zIndex ?? 0), -1);
  const zIndex =
    command.zIndex != null && Number.isFinite(command.zIndex)
      ? Math.floor(command.zIndex)
      : maxZ + 1;
  const sceneDuration = Math.max(0.001, scene.timing.duration);
  const layerById = new Map(scene.children.map((n) => [n.id, n]));
  const timingCache = new Map<string, { start: number; end: number }>();
  const effectiveTimingFor = (
    existingLayer: (typeof scene.children)[number],
  ): { start: number; end: number } => {
    const cached = timingCache.get(existingLayer.id);
    if (cached) return cached;
    const parent = existingLayer.parentLayerId
      ? layerById.get(existingLayer.parentLayerId)
      : undefined;
    const parentTiming = parent
      ? effectiveTimingFor(parent)
      : { start: 0, end: sceneDuration };
    const start =
      parentTiming.start + Math.max(0, existingLayer.timing?.start ?? 0);
    const duration =
      existingLayer.timing?.duration ?? parentTiming.end - parentTiming.start;
    const end = Math.min(parentTiming.end, start + Math.max(0, duration));
    const result = { start, end };
    timingCache.set(existingLayer.id, result);
    return result;
  };
  const parentWindow =
    parentGroup != null
      ? effectiveTimingFor(parentGroup)
      : { start: 0, end: sceneDuration };
  const parentDuration = Math.max(0, parentWindow.end - parentWindow.start);
  if (parentDuration < 0.001) {
    return {
      status: "rejected",
      reason: "invalid_document",
      message: "Parent layer has no active duration.",
    };
  }
  const timing =
    command.timing &&
    Number.isFinite(command.timing.start) &&
    Number.isFinite(command.timing.duration) &&
    command.timing.duration > 0
      ? {
          start: Math.max(
            0,
            Math.min(command.timing.start, Math.max(0, parentDuration - 0.001)),
          ),
          duration: Math.max(
            0.001,
            Math.min(
              command.timing.duration,
              parentDuration - Math.max(0, command.timing.start),
            ),
          ),
        }
      : { start: 0, duration: parentDuration };
  const nextNode = { ...node, parentLayerId, zIndex, timing };
  const layers = project.layers.slice();
  const idx = layers.findIndex((l) => l.id === scene.id);
  const nextChildren =
    parentGroup != null
      ? scene.children.map((n) =>
          n.id === parentGroup.id && n.type === "group"
            ? { ...n, children: [...n.children, nextNode] }
            : n,
        )
      : [...scene.children, nextNode];
  layers[idx] = {
    ...scene,
    children: nextChildren,
  };
  state.nextProject = { ...project, layers };
  state.events.push({
    type: "scene-node-added",
    sceneId: command.sceneId,
    layerId,
  });
  return state.finish(selectionNode(layerId));
}
