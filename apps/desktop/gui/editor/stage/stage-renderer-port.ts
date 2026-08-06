/**
 * Imperative stage renderer port — React owns mount/revision; ticks paint DOM.
 * G2: compile + lane index once per setDocument; paintFrame diffs keyed layer/node DOM.
 *
 * Shape aligned with Web `StageRendererPort` and
 * `@motionvideo/motion-runtime` StageRendererPortShape.
 */

import { nodeText, type TimelineClip, type TimelineLane } from "@motionvideo/editor-core";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  quantizeTimeToFrame,
  type StageRendererPortShape,
} from "@motionvideo/motion-runtime";
import {
  buildVisualLaneIndex,
  composeAtTime,
  resolveScene,
  type VisualLaneIndex,
} from "../preview/compose-layers";
import {
  matrixToCss,
  previewParitySnapshot,
  stageSizeForAspect,
  type PreviewParityNode,
} from "../preview/preview-evaluate";
import type { NormalizedMotionProjectV2 , MotionProject, MotionScene } from "@motionvideo/motion-schema";

export type StageRendererPort = StageRendererPortShape & {
  setDocument(input: {
    project: MotionProject;
    clips: TimelineClip[];
    lanes: TimelineLane[];
  }): void;
};

function nodeDomKey(clipId: string, nodeId: string): string {
  return `${clipId}\0${nodeId}`;
}

function isRenderableNode(node: PreviewParityNode): boolean {
  return (
    node.type !== "group" &&
    node.type !== "bone" &&
    node.type !== "camera"
  );
}

type SceneNode = MotionScene["nodes"][number];
type SceneNodeMap = Map<string, SceneNode>;

function nodeLabel(
  node: PreviewParityNode,
  sceneNodes: SceneNodeMap | null,
): string {
  if (node.type === "text") {
    const authored = sceneNodes?.get(node.id);
    return nodeText(authored) || node.id;
  }
  if (node.type === "shape" || node.type === "path") return node.type;
  if (node.type === "group" || node.type === "bone") return "";
  return node.id;
}

function applyStaticNodeChrome(el: HTMLDivElement, node: PreviewParityNode): void {
  el.dataset.testid = `runtime-node-${node.id}`;
  el.dataset.nodeType = node.type;
  el.className = "preview-layer-node";
  el.style.justifyContent = node.type === "text" ? "flex-start" : "center";
  el.style.fontSize = node.type === "text" ? "42px" : "18px";
  el.style.background =
    node.type === "text" ? "transparent" : "rgba(255,255,255,0.12)";
  el.style.border =
    node.type === "text" ? "none" : "1px solid rgba(255,255,255,0.35)";
  el.style.padding = node.type === "text" ? "0 12px" : "0";
}

function syncNodeElement(
  el: HTMLDivElement,
  node: PreviewParityNode,
  sceneNodes: SceneNodeMap | null,
  clipId: string,
): void {
  const width = Math.max(8, node.transform.width || node.worldBounds.width);
  const height = Math.max(8, node.transform.height || node.worldBounds.height);
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.opacity = String(node.worldOpacity);
  el.style.transform = matrixToCss(node.worldMatrix);
  el.style.visibility =
    !node.visible || node.worldOpacity <= 0 ? "hidden" : "visible";
  el.dataset.clipId = clipId;
  const label = nodeLabel(node, sceneNodes);
  if (el.textContent !== label) el.textContent = label;
}

export function createDomStageRenderer(host: HTMLElement): StageRendererPort {
  let project: MotionProject | null = null;
  let clips: TimelineClip[] = [];
  let lanes: TimelineLane[] = [];
  let scale = 0.25;
  let background = "#000";
  let lastFrame = -1;

  /** Invalidated only by setDocument. */
  let compiled: NormalizedMotionProjectV2 | null = null;
  let scenesById: Map<string, MotionScene> = new Map();
  /** Per-scene nodeId → authored node; avoids scene.nodes.find in paintFrame. */
  let sceneNodeMaps: Map<string, SceneNodeMap> = new Map();
  let visualIndex: VisualLaneIndex | null = null;

  const layerEls = new Map<string, HTMLDivElement>();
  const nodeEls = new Map<string, HTMLDivElement>();

  const canvas = document.createElement("div");
  canvas.dataset.testid = "runtime-preview-canvas";
  canvas.className = "preview-canvas";
  host.appendChild(canvas);

  const applyCanvasChrome = (stage?: { width: number; height: number }) => {
    if (stage) {
      canvas.style.width = `${stage.width}px`;
      canvas.style.height = `${stage.height}px`;
    }
    canvas.style.transform = `scale(${scale})`;
    canvas.style.background = background;
  };

  const clearDomCaches = () => {
    for (const el of nodeEls.values()) el.remove();
    for (const el of layerEls.values()) el.remove();
    nodeEls.clear();
    layerEls.clear();
    canvas.replaceChildren();
  };

  const paintFrame = (frameIndex: number) => {
    if (!project || !visualIndex) return;
    lastFrame = frameIndex;
    const fps = Math.max(1, Math.round(project.metadata.fps ?? 30));
    const previewTime = frameIndex / fps;
    const stage = stageSizeForAspect(project.metadata.aspectRatio);
    applyCanvasChrome(stage);

    if (!compiled) {
      clearDomCaches();
      canvas.dataset.composeLayers = "0";
      return;
    }

    const composed = composeAtTime(visualIndex, previewTime);
    canvas.dataset.composeLayers = String(composed.length);

    const liveLayerKeys = new Set<string>();
    const liveNodeKeys = new Set<string>();

    for (const layer of composed) {
      liveLayerKeys.add(layer.clipId);
      let layerEl = layerEls.get(layer.clipId);
      if (!layerEl) {
        layerEl = document.createElement("div");
        layerEl.className = "preview-compose-layer";
        canvas.appendChild(layerEl);
        layerEls.set(layer.clipId, layerEl);
      }
      layerEl.dataset.testid = `preview-layer-${layer.role}`;
      layerEl.dataset.sceneId = layer.sceneId;
      layerEl.style.zIndex = String(
        layer.role === "base" ? 0 : 10 + layer.zOrder,
      );

      const scene = resolveScene(scenesById, project.scenes, layer.sceneId);
      if (!scene) continue;
      const sceneNodes = sceneNodeMaps.get(scene.id) ?? null;

      const frame = quantizeTimeToFrame(layer.localTime, fps);
      const snapshot = previewParitySnapshot(compiled, scene.id, frame.time);

      for (const node of snapshot.nodes) {
        if (!isRenderableNode(node)) continue;
        const key = nodeDomKey(layer.clipId, node.id);
        liveNodeKeys.add(key);
        let el = nodeEls.get(key);
        if (!el) {
          el = document.createElement("div");
          applyStaticNodeChrome(el, node);
          layerEl.appendChild(el);
          nodeEls.set(key, el);
        } else if (el.parentElement !== layerEl) {
          layerEl.appendChild(el);
        }
        syncNodeElement(el, node, sceneNodes, layer.clipId);
      }
    }

    for (const [key, el] of nodeEls) {
      if (liveNodeKeys.has(key)) continue;
      el.remove();
      nodeEls.delete(key);
    }
    for (const [key, el] of layerEls) {
      if (liveLayerKeys.has(key)) continue;
      el.remove();
      layerEls.delete(key);
    }
  };

  return {
    setDocument(input) {
      project = input.project;
      clips = input.clips;
      lanes = input.lanes;
      try {
        compiled = compileMotionProject(project);
      } catch {
        compiled = null;
      }
      scenesById = new Map(project.scenes.map((s) => [s.id, s]));
      sceneNodeMaps = new Map(
        project.scenes.map((s) => [
          s.id,
          new Map(s.nodes.map((n) => [n.id, n])),
        ]),
      );
      visualIndex = buildVisualLaneIndex(clips, lanes);
      clearDomCaches();
      if (lastFrame >= 0) paintFrame(lastFrame);
    },
    setScale(next) {
      scale = next;
      applyCanvasChrome();
    },
    setBackground(color) {
      background = color;
      applyCanvasChrome();
    },
    paintFrame,
    getLastEvaluatedFrame() {
      return null;
    },
    dispose() {
      clearDomCaches();
      canvas.remove();
      project = null;
      compiled = null;
      scenesById = new Map();
      sceneNodeMaps = new Map();
      visualIndex = null;
      clips = [];
      lanes = [];
    },
  };
}
