/**
 * PixiFramePainter — paints EvaluatedFrame.paint into a Pixi Container.
 * Stage hosts inject the root container; no Application lifecycle here.
 */

import {
  type EvaluatedFrame,
  type EvaluatedFramePainter,
  type PaintCommand,
  type PaintCommandBuffer,
  type RuntimeEffect,
} from "@motionvideo/motion-runtime";
import {
  BlurFilter,
  Container,
  FillGradient,
  Graphics,
  Matrix,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { createPixiAssetStore, type PixiAssetStore } from "./PixiAssetStore";

type CachedObject = {
  kind: string;
  display: Container | Text | Graphics | Sprite;
};

export type PixiFramePainterOptions = {
  root: Container;
  /** Called when beginFrame sets background (host applies to renderer). */
  onBackground?: (color: string | undefined) => void;
  /** Fallback background when beginFrame omits one. */
  getBackground?: () => string;
  /** Observes unsupported paint ops (preview diagnostic overlay). */
  onUnsupported?: (info: {
    key: string;
    nodeId: string;
    nodeType: string;
    message: string;
  }) => void;
  /** Optional injected asset store (tests / shared host cache). */
  assetStore?: PixiAssetStore;
};

export type PixiFramePainter = EvaluatedFramePainter & {
  paintCommands(buffer: PaintCommandBuffer): void;
  getLiveKeys(): readonly string[];
  getUnsupported(): readonly {
    key: string;
    nodeId: string;
    nodeType: string;
    message: string;
  }[];
  clear(): void;
  dispose(): void;
};

function hexToNumber(color: string | undefined, fallback = 0xffffff): number {
  if (!color) return fallback;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return fallback;
  return Number.parseInt(m[1]!, 16);
}

/** Apply full affine via Pixi Matrix + setFromMatrix (preserves skew). */
export function applyAffineMatrix(
  display: Container | Text | Graphics | Sprite,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
  alpha: number,
  visible: boolean,
  zIndex: number,
  blendMode?: "normal" | "multiply" | "screen" | "add" | "darken" | "lighten" | "overlay",
): void {
  const m = new Matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  display.setFromMatrix(m);
  display.alpha = alpha;
  display.visible = visible;
  display.zIndex = zIndex;
  if (blendMode === "multiply") display.blendMode = "multiply";
  else if (blendMode === "screen") display.blendMode = "screen";
  else if (blendMode === "add") display.blendMode = "add";
  else if (blendMode === "darken") display.blendMode = "darken";
  else if (blendMode === "lighten") display.blendMode = "lighten";
  else if (blendMode === "overlay") display.blendMode = "overlay";
  else display.blendMode = "normal";
}

/** @deprecated Prefer {@link applyAffineMatrix}. */
export const applyMatrixDecomposed = applyAffineMatrix;

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
    return new FillGradient({
      type: "linear",
      start: { x: width / 2 - dx, y: height / 2 - dy },
      end: { x: width / 2 + dx, y: height / 2 + dy },
      colorStops: fillPaint.stops.map((s) => ({
        offset: s.offset,
        color: hexToNumber(s.color),
      })),
    });
  }
  if (fillPaint?.type === "radial-gradient" && fillPaint.stops?.length) {
    const cx = (fillPaint.cx ?? 0.5) * width;
    const cy = (fillPaint.cy ?? 0.5) * height;
    const r = (fillPaint.radius ?? 0.5) * Math.min(width, height);
    return new FillGradient({
      type: "radial",
      center: { x: cx, y: cy },
      innerRadius: 0,
      outerRadius: r,
      colorStops: fillPaint.stops.map((s) => ({
        offset: s.offset,
        color: hexToNumber(s.color),
      })),
    });
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

export function createPixiFramePainter(
  options: PixiFramePainterOptions,
): PixiFramePainter {
  const { root } = options;
  const cache = new Map<string, CachedObject>();
  const assetStore = options.assetStore ?? createPixiAssetStore();
  let lastPaint: PaintCommandBuffer | null = null;
  let lastLiveKeys: string[] = [];
  let unsupported: Array<{
    key: string;
    nodeId: string;
    nodeType: string;
    message: string;
  }> = [];

  const clear = () => {
    for (const entry of cache.values()) {
      entry.display.destroy({ children: true });
    }
    cache.clear();
    root.removeChildren();
    lastLiveKeys = [];
    unsupported = [];
  };

  const ensureObject = <T extends Container | Text | Graphics | Sprite>(
    key: string,
    kind: string,
    factory: () => T,
  ): T => {
    const existing = cache.get(key);
    if (existing && existing.kind === kind) return existing.display as T;
    if (existing) {
      root.removeChild(existing.display);
      existing.display.destroy({ children: true });
      cache.delete(key);
    }
    const display = factory();
    display.label = key;
    root.addChild(display);
    cache.set(key, { kind, display });
    return display;
  };

  const paintCommands = (buffer: PaintCommandBuffer) => {
    lastPaint = buffer;
    const live = new Set<string>();
    unsupported = [];
    let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null =
      null;

    for (const cmd of buffer.commands) {
      if (cmd.op === "beginFrame") {
        options.onBackground?.(cmd.background ?? options.getBackground?.());
        continue;
      }
      if (cmd.op === "endFrame") continue;
      if (cmd.op === "beginLayer" || cmd.op === "endLayer") continue;
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
          applyAffineMatrix(
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
        const info = {
          key: cmd.key,
          nodeId: cmd.nodeId,
          nodeType: cmd.nodeType,
          message: cmd.message,
        };
        unsupported.push(info);
        options.onUnsupported?.(info);
        continue;
      }

      live.add(cmd.key);
      const xf = pendingTransform?.key === cmd.key ? pendingTransform : null;
      if (pendingTransform?.key === cmd.key) pendingTransform = null;

      if (cmd.op === "drawText") {
        const displayText =
          cmd.runs && cmd.runs.length > 0 ? cmd.runs.map((r) => r.text).join("") : cmd.text;
        const text = ensureObject(
          cmd.key,
          "text",
          () =>
            new Text({
              text: displayText,
              style: {
                fontSize: cmd.fontSize,
                fill: cmd.fill,
                align: cmd.align ?? "left",
                wordWrap: cmd.wrap !== "none",
                wordWrapWidth: Math.max(8, cmd.width),
                lineHeight: cmd.lineHeight ?? cmd.fontSize * 1.2,
                letterSpacing: cmd.letterSpacing ?? 0,
              },
            }),
        );
        text.text = displayText;
        text.style.fontSize = cmd.fontSize;
        text.style.fill = cmd.runs?.[0]?.fill ?? cmd.fill;
        if (cmd.fontWeight != null) {
          (text.style as { fontWeight?: number | string }).fontWeight = cmd.fontWeight;
        }
        if (cmd.lineHeight != null) text.style.lineHeight = cmd.lineHeight;
        if (cmd.letterSpacing != null) text.style.letterSpacing = cmd.letterSpacing;
        text.style.wordWrap = cmd.wrap !== "none";
        text.style.wordWrapWidth = Math.max(8, cmd.width);
        if (xf) {
          applyAffineMatrix(
            text,
            xf.matrix,
            xf.alpha,
            xf.visible,
            xf.zIndex,
            xf.blendMode,
          );
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
        } else if (cmd.op === "drawShape" && cmd.shape === "polygon") {
          g.moveTo(w / 2, 0);
          g.lineTo(0, h);
          g.lineTo(w, h);
          g.closePath();
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
          applyAffineMatrix(
            g,
            xf.matrix,
            xf.alpha,
            xf.visible,
            xf.zIndex,
            xf.blendMode,
          );
        }
        applyEffects(g, cmd.effects);
        continue;
      }

      if (cmd.op === "drawPath") {
        const g = ensureObject(cmd.key, "path", () => new Graphics());
        g.clear();
        strokePathContours(g, cmd.contours);
        if (cmd.fill || cmd.fillPaint) {
          const boundsW = Math.max(
            1,
            ...cmd.contours.flatMap((c) => [
              c.start.x,
              ...c.segments.map((s) => s.to.x),
            ]),
          );
          const boundsH = Math.max(
            1,
            ...cmd.contours.flatMap((c) => [
              c.start.y,
              ...c.segments.map((s) => s.to.y),
            ]),
          );
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
          applyAffineMatrix(
            g,
            xf.matrix,
            xf.alpha,
            xf.visible,
            xf.zIndex,
            xf.blendMode,
          );
        }
        applyEffects(g, cmd.effects);
        continue;
      }

      if (cmd.op === "drawImage" || cmd.op === "drawVideo") {
        let texture = Texture.WHITE;
        if (cmd.uri) {
          const cached = assetStore.get(cmd.uri);
          if (cached) {
            texture = cached;
          } else if (cmd.op === "drawImage") {
            void assetStore.load(cmd.uri, () => {
              if (lastPaint) paintCommands(lastPaint);
            });
          }
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
          applyAffineMatrix(
            sprite,
            xf.matrix,
            xf.alpha,
            xf.visible,
            xf.zIndex,
            xf.blendMode,
          );
        }
        applyEffects(sprite, cmd.effects);
      }
    }

    for (const [key, entry] of cache) {
      if (live.has(key)) continue;
      root.removeChild(entry.display);
      entry.display.destroy({ children: true });
      cache.delete(key);
    }
    lastLiveKeys = [...live].sort();
  };

  return {
    paintFrame(evaluated: EvaluatedFrame) {
      paintCommands(evaluated.paint);
    },
    paintCommands,
    getLiveKeys: () => lastLiveKeys,
    getUnsupported: () => unsupported,
    clear,
    dispose() {
      clear();
      assetStore.dispose();
      lastPaint = null;
    },
  };
}

export { hexToNumber };
