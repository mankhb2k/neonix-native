/**
 * Canvas2D StageRendererPort — alternate backend behind the Pixi seam (P17).
 * Lazy-loaded so the default DOM path can code-split this chunk.
 */

import type { StageRendererPort } from "./stage-renderer-port";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";

type NodePaint = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
};

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 42% 48%)`;
}

export function createCanvasStageRenderer(host: HTMLElement): StageRendererPort {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.replaceChildren(canvas);
  const ctx = canvas.getContext("2d");

  let project: MotionProject | null = null;
  let clips: TimelineClip[] = [];
  let bg = "#111";
  let scale = 1;
  let disposed = false;
  let nodes: NodePaint[] = [];

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const rebuild = () => {
    nodes = [];
    if (!project) return;
    const scenes = new Map(project.scenes.map((s) => [s.id, s]));
    let i = 0;
    for (const clip of clips) {
      if (clip.kind !== "scene") continue;
      const scene = scenes.get(clip.sceneId);
      if (!scene) continue;
      for (const node of scene.nodes) {
        nodes.push({
          id: `${clip.id}:${node.id}`,
          x: (40 + (i % 8) * 28) * scale,
          y: (40 + Math.floor(i / 8) * 28) * scale,
          w: 72 * scale,
          h: 48 * scale,
          fill: colorForId(node.id),
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
      void (next.lanes as TimelineLane[]);
      rebuild();
    },
    setBackground(color) {
      bg = color;
    },
    setScale(next) {
      scale = Math.max(0.01, next);
      rebuild();
    },
    paintFrame(_frameIndex) {
      if (disposed || !ctx) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      for (const n of nodes) {
        ctx.fillStyle = n.fill;
        ctx.fillRect(n.x, n.y, n.w, n.h);
      }
    },
    dispose() {
      disposed = true;
      ro.disconnect();
      host.replaceChildren();
    },
  };
}
