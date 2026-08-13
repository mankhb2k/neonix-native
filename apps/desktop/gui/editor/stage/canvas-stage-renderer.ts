/**
 * Canvas2D StageRendererPort — `canvas-experimental` backend (P21).
 * Uses composeAtTime(frame) so paint differs across frames when clips change.
 */

import {
  buildVisualLaneIndex,
  composeAtTime,
  type VisualLaneIndex,
} from "@motionvideo/editor-core";
import type { StageRendererPort } from "./stage-renderer-port";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-protocol";

type NodePaint = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  visible: boolean;
};

export type CanvasPaintStats = {
  frameIndex: number;
  nodeCount: number;
};

/** Canvas backend port — includes test/contract paint stats (not on StageRendererPort). */
export type CanvasStageRendererPort = StageRendererPort & {
  getPaintStats(): CanvasPaintStats;
};

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 42% 48%)`;
}

export function createCanvasStageRenderer(
  host: HTMLElement,
): CanvasStageRendererPort {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.replaceChildren(canvas);
  const ctx = canvas.getContext("2d");

  let project: MotionProject | null = null;
  let clips: TimelineClip[] = [];
  let lanes: TimelineLane[] = [];
  let laneIndex: VisualLaneIndex | null = null;
  let bg = "#111";
  let scale = 1;
  let disposed = false;
  let lastFrame = 0;
  let layers: NodePaint[] = [];
  let fps = 30;

  const paint = () => {
    if (disposed || !ctx) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (const n of layers) {
      if (!n.visible) continue;
      ctx.fillStyle = n.fill;
      ctx.fillRect(n.x, n.y, n.w, n.h);
    }
  };

  const resize = () => {
    if (disposed) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const rebuildFrame = (frameIndex: number) => {
    layers = [];
    if (!project || !laneIndex) return;
    const time = frameIndex / Math.max(1, fps);
    const layers = composeAtTime(laneIndex, time);
    const scenes = new Map(project.scenes.map((s) => [s.id, s]));
    let i = 0;
    for (const layer of layers) {
      const scene = scenes.get(layer.sceneId);
      if (!scene) continue;
      for (const node of scene.layers) {
        const t = node.transform;
        layers.push({
          id: `${layer.clipId}:${node.id}`,
          x: ((t?.x ?? 40) + (i % 8) * 4) * scale,
          y: ((t?.y ?? 40) + Math.floor(i / 8) * 4) * scale,
          w: Math.max(4, (t?.width ?? 72) * scale),
          h: Math.max(4, (t?.height ?? 48) * scale),
          fill: colorForId(node.id),
          visible: t?.visible !== false && (t?.opacity ?? 1) > 0.01,
        });
        i += 1;
      }
    }
  };

  return {
    setDocument(next) {
      if (disposed) return;
      project = next.project;
      clips = next.clips;
      lanes = next.lanes;
      fps = Math.max(1, Math.round(project.metadata.fps ?? 30));
      laneIndex = buildVisualLaneIndex(clips, lanes);
      rebuildFrame(lastFrame);
      paint();
    },
    setBackground(color) {
      if (disposed) return;
      bg = color;
      paint();
    },
    setScale(next) {
      if (disposed) return;
      scale = Math.max(0.01, next);
      rebuildFrame(lastFrame);
      paint();
    },
    paintFrame(frameIndex) {
      if (disposed) return;
      lastFrame = frameIndex;
      rebuildFrame(frameIndex);
      paint();
    },
    getLastEvaluatedFrame() {
      return null;
    },
    /** Test/contract helper — node count after last rebuild. */
    getPaintStats() {
      return { frameIndex: lastFrame, nodeCount: layers.length };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ro.disconnect();
      host.replaceChildren();
    },
  };
}
