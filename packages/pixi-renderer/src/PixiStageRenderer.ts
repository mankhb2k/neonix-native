/**
 * PixiStageRenderer — real pixi.js Application + stable-key display cache.
 * Consumes EvaluatedFrame / PaintCommandBuffer from motion-runtime (no compile).
 */

import {
  type EvaluatedFrame,
  type EvaluatedFramePainter,
  type PaintCommand,
  type PaintCommandBuffer,
  type RuntimeEffect,
} from "@motionvideo/motion-runtime";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  Application,
  Assets,
  BlurFilter,
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";

export type StageViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type PixiStageRenderer = EvaluatedFramePainter & {
  mount(host: HTMLElement): Promise<void>;
  /** Optional metadata for canvas resize; paint uses EvaluatedFrame only. */
  setProject(runtime: NormalizedMotionProjectV2 | null): void;
  setViewport(viewport: StageViewport): void;
  setQuality(tier: "interactive" | "high"): void;
  setBackground(color: string): void;
  setSceneId(sceneId: string | undefined): void;
  dispose(): void;
};

type CachedObject = {
  kind: string;
  display: Container | Text | Graphics | Sprite;
};

function hexToNumber(color: string | undefined, fallback = 0xffffff): number {
  if (!color) return fallback;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return fallback;
  return Number.parseInt(m[1]!, 16);
}

function applyMatrix(
  display: Container | Text | Graphics | Sprite,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
  alpha: number,
  visible: boolean,
  zIndex: number,
  blendMode?: "normal" | "multiply" | "screen" | "add",
): void {
  display.position.set(matrix.e, matrix.f);
  display.rotation = Math.atan2(matrix.b, matrix.a);
  display.scale.set(
    Math.hypot(matrix.a, matrix.b) || 1,
    Math.hypot(matrix.c, matrix.d) || 1,
  );
  display.alpha = alpha;
  display.visible = visible;
  display.zIndex = zIndex;
  if (blendMode === "multiply") display.blendMode = "multiply";
  else if (blendMode === "screen") display.blendMode = "screen";
  else if (blendMode === "add") display.blendMode = "add";
  else display.blendMode = "normal";
}

function paintFillStyle(
  fill: string | undefined,
  fillPaint:
    | {
        type: "solid" | "linear-gradient" | "radial-gradient";
        color?: string;
        angle?: number;
        cx?: number;
        cy?: number;
        radius?: number;
        stops?: Array<{ offset: number; color: string }>;
      }
    | undefined,
  width: number,
  height: number,
): number | FillGradient {
  if (fillPaint?.type === "linear-gradient" && fillPaint.stops?.length) {
    const angle = ((fillPaint.angle ?? 0) * Math.PI) / 180;
    const extent = Math.hypot(width, height) / 2;
    const dx = Math.cos(angle) * extent;
    const dy = Math.sin(angle) * extent;
    const gradient = new FillGradient({
      type: "linear",
      start: { x: width / 2 - dx, y: height / 2 - dy },
      end: { x: width / 2 + dx, y: height / 2 + dy },
      colorStops: fillPaint.stops.map((s) => ({
        offset: s.offset,
        color: hexToNumber(s.color),
      })),
    });
    return gradient;
  }
  if (fillPaint?.type === "radial-gradient" && fillPaint.stops?.length) {
    const cx = (fillPaint.cx ?? 0.5) * width;
    const cy = (fillPaint.cy ?? 0.5) * height;
    const r = (fillPaint.radius ?? 0.5) * Math.min(width, height);
    const gradient = new FillGradient({
      type: "radial",
      center: { x: cx, y: cy },
      innerRadius: 0,
      outerRadius: r,
      colorStops: fillPaint.stops.map((s) => ({
        offset: s.offset,
        color: hexToNumber(s.color),
      })),
    });
    return gradient;
  }
  return hexToNumber(fill ?? fillPaint?.color ?? "#ffffff");
}

function applyEffects(
  display: Container | Text | Graphics | Sprite,
  effects: RuntimeEffect[] | undefined,
): void {
  if (!effects?.length) {
    display.filters = null;
    return;
  }
  const filters = [];
  for (const effect of effects) {
    if (effect.type === "blur" && effect.radius > 0) {
      filters.push(new BlurFilter({ strength: effect.radius }));
    }
  }
  display.filters = filters.length ? filters : null;
}

function strokePathContours(
  g: Graphics,
  contours: Array<{
    start: { x: number; y: number };
    closed: boolean;
    segments: Array<
      | { kind: "line"; to: { x: number; y: number } }
      | {
          kind: "cubic";
          control1: { x: number; y: number };
          control2: { x: number; y: number };
          to: { x: number; y: number };
        }
    >;
  }>,
): void {
  for (const contour of contours) {
    g.moveTo(contour.start.x, contour.start.y);
    for (const segment of contour.segments) {
      if (segment.kind === "line") {
        g.lineTo(segment.to.x, segment.to.y);
      } else {
        g.bezierCurveTo(
          segment.control1.x,
          segment.control1.y,
          segment.control2.x,
          segment.control2.y,
          segment.to.x,
          segment.to.y,
        );
      }
    }
    if (contour.closed) g.closePath();
  }
}

export function createPixiStageRenderer(): PixiStageRenderer {
  let app: Application | null = null;
  let host: HTMLElement | null = null;
  let runtime: NormalizedMotionProjectV2 | null = null;
  let sceneId: string | undefined;
  let background = "#ffffff";
  let quality: "interactive" | "high" = "interactive";
  let viewport: StageViewport = { scale: 1, offsetX: 0, offsetY: 0 };
  let lastPaint: PaintCommandBuffer | null = null;

  const cache = new Map<string, CachedObject>();
  const world = new Container({ sortableChildren: true });
  const textureCache = new Map<string, Texture>();

  const clearCache = () => {
    for (const entry of cache.values()) {
      entry.display.destroy({ children: true });
    }
    cache.clear();
    world.removeChildren();
  };

  const ensureObject = <T extends Container | Text | Graphics | Sprite>(
    key: string,
    kind: string,
    factory: () => T,
  ): T => {
    const existing = cache.get(key);
    if (existing && existing.kind === kind) return existing.display as T;
    if (existing) {
      world.removeChild(existing.display);
      existing.display.destroy({ children: true });
      cache.delete(key);
    }
    const display = factory();
    display.label = key;
    world.addChild(display);
    cache.set(key, { kind, display });
    return display;
  };

  const paintCommands = (buffer: PaintCommandBuffer) => {
    const live = new Set<string>();
    let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null =
      null;

    for (const cmd of buffer.commands) {
      if (cmd.op === "beginFrame") {
        if (app) {
          app.renderer.background.color = hexToNumber(
            cmd.background ?? background,
          );
        }
        continue;
      }
      if (cmd.op === "endFrame") continue;
      if (cmd.op === "setTransform") {
        pendingTransform = cmd;
        continue;
      }
      if (cmd.op === "beginGroup" || cmd.op === "endGroup") {
        live.add(cmd.key);
        const c = ensureObject(
          cmd.key,
          "group",
          () => new Container({ sortableChildren: true }),
        );
        if (pendingTransform && pendingTransform.key === cmd.key) {
          applyMatrix(
            c,
            pendingTransform.matrix,
            pendingTransform.alpha,
            pendingTransform.visible,
            pendingTransform.zIndex,
            pendingTransform.blendMode,
          );
          pendingTransform = null;
        }
        continue;
      }
      if (cmd.op === "unsupported") {
        live.add(cmd.key);
        continue;
      }

      live.add(cmd.key);
      const xf = pendingTransform?.key === cmd.key ? pendingTransform : null;
      if (pendingTransform?.key === cmd.key) pendingTransform = null;

      if (cmd.op === "drawText") {
        const text = ensureObject(
          cmd.key,
          "text",
          () =>
            new Text({
              text: cmd.text,
              style: {
                fontSize: cmd.fontSize,
                fill: cmd.fill,
                align: cmd.align ?? "left",
                wordWrap: true,
                wordWrapWidth: Math.max(8, cmd.width),
              },
            }),
        );
        text.text = cmd.text;
        text.style.fontSize = cmd.fontSize;
        text.style.fill = cmd.fill;
        if (xf) {
          applyMatrix(text, xf.matrix, xf.alpha, xf.visible, xf.zIndex, xf.blendMode);
        }
        applyEffects(text, cmd.effects);
        continue;
      }

      if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
        const g = ensureObject(cmd.key, "graphics", () => new Graphics());
        g.clear();
        const w = cmd.width;
        const h = cmd.height;
        if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
          g.ellipse(w / 2, h / 2, w / 2, h / 2);
        } else if (cmd.op === "drawShape" && cmd.cornerRadius) {
          g.roundRect(0, 0, w, h, cmd.cornerRadius);
        } else {
          g.rect(0, 0, w, h);
        }
        const fillStyle =
          cmd.op === "drawShape"
            ? paintFillStyle(cmd.fill, cmd.fillPaint, w, h)
            : hexToNumber(cmd.fill);
        g.fill(fillStyle);
        if (xf) {
          applyMatrix(g, xf.matrix, xf.alpha, xf.visible, xf.zIndex, xf.blendMode);
        }
        applyEffects(g, cmd.effects);
        continue;
      }

      if (cmd.op === "drawPath") {
        const g = ensureObject(cmd.key, "path", () => new Graphics());
        g.clear();
        strokePathContours(g, cmd.contours);
        if (cmd.fill || cmd.fillPaint) {
          const boundsW = Math.max(1, ...(cmd.contours.flatMap((c) => [
            c.start.x,
            ...c.segments.map((s) => s.to.x),
          ])));
          const boundsH = Math.max(1, ...(cmd.contours.flatMap((c) => [
            c.start.y,
            ...c.segments.map((s) => s.to.y),
          ])));
          const style = paintFillStyle(cmd.fill, cmd.fillPaint, boundsW, boundsH);
          if (typeof style === "number") {
            g.fill({ color: style, alpha: cmd.fillOpacity ?? 1 });
          } else {
            g.fill({ fill: style, alpha: cmd.fillOpacity ?? 1 });
          }
        }
        if (cmd.stroke) {
          g.stroke({
            color: hexToNumber(cmd.stroke),
            width: cmd.strokeWidth ?? 1,
            alpha: cmd.strokeOpacity ?? 1,
          });
        }
        if (xf) {
          applyMatrix(g, xf.matrix, xf.alpha, xf.visible, xf.zIndex, xf.blendMode);
        }
        applyEffects(g, cmd.effects);
        continue;
      }

      if (cmd.op === "drawImage" || cmd.op === "drawVideo") {
        let texture = Texture.WHITE;
        if (cmd.uri && textureCache.has(cmd.uri)) {
          texture = textureCache.get(cmd.uri)!;
        } else if (cmd.uri && cmd.op === "drawImage") {
          void Assets.load(cmd.uri)
            .then((loaded) => {
              textureCache.set(cmd.uri!, loaded as Texture);
              if (lastPaint) paintCommands(lastPaint);
            })
            .catch(() => {
              /* placeholder WHITE */
            });
        }
        const sprite = ensureObject(
          cmd.key,
          cmd.op === "drawVideo" ? "video" : "sprite",
          () => new Sprite(texture),
        );
        sprite.texture = texture;
        sprite.width = cmd.width;
        sprite.height = cmd.height;
        if (xf) {
          applyMatrix(sprite, xf.matrix, xf.alpha, xf.visible, xf.zIndex, xf.blendMode);
        }
        applyEffects(sprite, cmd.effects);
      }
    }

    for (const [key, entry] of cache) {
      if (live.has(key)) continue;
      world.removeChild(entry.display);
      entry.display.destroy({ children: true });
      cache.delete(key);
    }
  };

  return {
    async mount(nextHost) {
      if (app) this.dispose();
      host = nextHost;
      app = new Application();
      await app.init({
        width: 1920,
        height: 1080,
        background: hexToNumber(background),
        antialias: quality === "high",
        resolution:
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        autoDensity: true,
        preference: "webgl",
      });
      host.appendChild(app.canvas as HTMLCanvasElement);
      app.stage.addChild(world);
      world.position.set(viewport.offsetX, viewport.offsetY);
      world.scale.set(viewport.scale);
    },

    setProject(next) {
      runtime = next;
      clearCache();
    },

    paintFrame(evaluated: EvaluatedFrame) {
      const size = {
        width: evaluated.interaction.width,
        height: evaluated.interaction.height,
      };
      if (
        app &&
        (app.screen.width !== size.width || app.screen.height !== size.height)
      ) {
        app.renderer.resize(size.width, size.height);
      }
      if (evaluated.interaction.background) {
        background = evaluated.interaction.background;
        if (app) app.renderer.background.color = hexToNumber(background);
      }
      lastPaint = evaluated.paint;
      paintCommands(evaluated.paint);
    },

    setViewport(next) {
      viewport = next;
      world.position.set(next.offsetX, next.offsetY);
      world.scale.set(next.scale);
    },

    setQuality(tier) {
      quality = tier;
    },

    setBackground(color) {
      background = color;
      if (app) app.renderer.background.color = hexToNumber(color);
    },

    setSceneId(id) {
      sceneId = id;
      void sceneId;
      void runtime;
    },

    dispose() {
      clearCache();
      textureCache.clear();
      if (app) {
        app.destroy(true, { children: true });
        app = null;
      }
      if (host) {
        host.replaceChildren();
        host = null;
      }
      runtime = null;
      lastPaint = null;
    },
  };
}
