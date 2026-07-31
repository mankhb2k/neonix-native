/**
 * Imperative stage renderer port — React owns mount/revision; ticks paint DOM.
 */

import { nodeText, type TimelineClip, type TimelineLane } from "@motionvideo/editor-core";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import {
  buildVisualLaneIndex,
  composeAtTime,
  resolveScene,
} from "../preview/compose-layers";
import {
  matrixToCss,
  previewParitySnapshot,
  stageSizeForAspect,
  type PreviewParityNode,
} from "../preview/preview-evaluate";
import type { MotionProject, MotionScene } from "@motionvideo/motion-schema";

export type StageRendererPort = {
  setDocument(input: {
    project: MotionProject;
    clips: TimelineClip[];
    lanes: TimelineLane[];
  }): void;
  setScale(scale: number): void;
  setBackground(color: string): void;
  paintFrame(frameIndex: number): void;
  dispose(): void;
};

function nodeLabel(node: PreviewParityNode, scene: MotionScene | null): string {
  if (node.type === "text") {
    const authored = scene?.nodes.find((candidate) => candidate.id === node.id);
    return nodeText(authored) || node.id;
  }
  if (node.type === "shape" || node.type === "path") return node.type;
  if (node.type === "group" || node.type === "bone") return "";
  return node.id;
}

function appendNode(
  parent: HTMLElement,
  node: PreviewParityNode,
  scene: MotionScene | null,
  clipId: string,
): void {
  if (!node.visible || node.worldOpacity <= 0) return;
  if (node.type === "group" || node.type === "bone" || node.type === "camera") {
    return;
  }
  const el = document.createElement("div");
  el.dataset.testid = `runtime-node-${node.id}`;
  el.dataset.nodeType = node.type;
  el.className = "preview-layer-node";
  const width = Math.max(8, node.transform.width || node.worldBounds.width);
  const height = Math.max(8, node.transform.height || node.worldBounds.height);
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.opacity = String(node.worldOpacity);
  el.style.transform = matrixToCss(node.worldMatrix);
  el.style.justifyContent = node.type === "text" ? "flex-start" : "center";
  el.style.fontSize = node.type === "text" ? "42px" : "18px";
  el.style.background =
    node.type === "text" ? "transparent" : "rgba(255,255,255,0.12)";
  el.style.border =
    node.type === "text" ? "none" : "1px solid rgba(255,255,255,0.35)";
  el.style.padding = node.type === "text" ? "0 12px" : "0";
  el.textContent = nodeLabel(node, scene);
  el.dataset.clipId = clipId;
  parent.appendChild(el);
}

export function createDomStageRenderer(host: HTMLElement): StageRendererPort {
  let project: MotionProject | null = null;
  let clips: TimelineClip[] = [];
  let lanes: TimelineLane[] = [];
  let scale = 0.25;
  let background = "#000";
  let lastFrame = -1;

  const canvas = document.createElement("div");
  canvas.dataset.testid = "runtime-preview-canvas";
  canvas.className = "preview-canvas";
  host.appendChild(canvas);

  const paintFrame = (frameIndex: number) => {
    if (!project) return;
    lastFrame = frameIndex;
    const fps = Math.max(1, Math.round(project.metadata.fps ?? 30));
    const previewTime = frameIndex / fps;
    let compiled;
    try {
      compiled = compileMotionProject(project);
    } catch {
      canvas.replaceChildren();
      return;
    }
    const scenesById = new Map(project.scenes.map((s) => [s.id, s]));
    const visualIndex = buildVisualLaneIndex(clips, lanes);
    const composed = composeAtTime(visualIndex, previewTime);
    const stage = stageSizeForAspect(project.metadata.aspectRatio);
    canvas.dataset.composeLayers = String(composed.length);
    canvas.style.width = `${stage.width}px`;
    canvas.style.height = `${stage.height}px`;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.background = background;
    canvas.replaceChildren();
    for (const layer of composed) {
      const scene = resolveScene(scenesById, project.scenes, layer.sceneId);
      if (!scene || !compiled) continue;
      const frame = quantizeTimeToFrame(layer.localTime, fps);
      const snapshot = previewParitySnapshot(compiled, scene.id, frame.time);
      const layerEl = document.createElement("div");
      layerEl.dataset.testid = `preview-layer-${layer.role}`;
      layerEl.dataset.sceneId = layer.sceneId;
      layerEl.className = "preview-compose-layer";
      layerEl.style.zIndex = String(
        layer.role === "base" ? 0 : 10 + layer.zOrder,
      );
      for (const node of snapshot?.nodes ?? []) {
        appendNode(layerEl, node, scene, layer.clipId);
      }
      canvas.appendChild(layerEl);
    }
  };

  return {
    setDocument(input) {
      project = input.project;
      clips = input.clips;
      lanes = input.lanes;
      if (lastFrame >= 0) paintFrame(lastFrame);
    },
    setScale(next) {
      scale = next;
      if (lastFrame >= 0) paintFrame(lastFrame);
    },
    setBackground(color) {
      background = color;
      if (lastFrame >= 0) paintFrame(lastFrame);
    },
    paintFrame,
    dispose() {
      canvas.remove();
      project = null;
    },
  };
}
