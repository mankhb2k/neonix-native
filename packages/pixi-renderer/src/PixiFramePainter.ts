/**
 * PixiFramePainter — paints PaintCommandBuffer into a Pixi Container tree.
 *
 * Phase 5 (Task 5.1–5.8):
 *   - Proper beginLayer/endLayer container nesting (was skipped)
 *   - beginGroup/endGroup push/pop stack (was flat)
 *   - Offscreen RenderTexture for isolation/mask/effect layers
 *   - Pixi mask wiring (alpha/luma/clip/inverse)
 *   - Transition layer support (multiple scenes in one frame)
 *   - Complete text (fontWeight, rich runs, wrapping, letter spacing)
 *   - Image/Video: trim, fit, crop, stale guard
 *   - Unsupported diagnostic overlay pattern
 *   - Dispose: textures, filters, offscreen, assets
 *
 * Phase 8 (Task 8.1–8.3):
 *   - Dirty diff via fingerprint: skip clear/updates when unchanged
 *   - Render on-demand: pause stops ticker rendering
 *   - Adaptive resolution: composition size vs CSS display size
 */

import {
  type EvaluatedFrame,
  type EvaluatedFramePainter,
  type PaintCommand,
  type PaintCommandBuffer,
  type PaintDrawCommand,
  type RuntimeEffect,
  type PaintPatch,
  isPatchStale,
  type PatchSequence,
  computePaintItemFingerprint,
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
import {
  createCompositingContext,
  type CompositingContext,
} from "./pixi-compositing";
import { createInnerGlowFilter } from "./filters/inner-glow-filter";
import { createNoiseFilter } from "./filters/noise-filter";

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
    layerId: string;
    nodeType: string;
    message: string;
  }) => void;
  /** Optional injected asset store (tests / shared host cache). */
  assetStore?: PixiAssetStore;
  /**
   * CSS display size (may differ from composition resolution in
   * interactive quality mode). When set, the painter renders at
   * composition resolution but scales the output to this size.
   * @since Phase 8 (adaptive resolution)
   */
  displayWidth?: number;
  /** CSS display size height. */
  displayHeight?: number;
  /**
   * Optional renderer reference for canvas capture (Phase 10).
   * When provided, captureImage() and captureDataURL() become available.
   */
  renderer?: {
    extract: {
      canvas(root: Container): HTMLCanvasElement;
      image(root: Container): HTMLImageElement;
      pixels(root: Container): Uint8ClampedArray;
    };
    width: number;
    height: number;
    render?(args: {
      container: Container;
      target: import("pixi.js").RenderTexture;
      clear?: boolean;
    }): void;
  };
};

export type PixiFramePainter = EvaluatedFramePainter & {
  paintCommands(buffer: PaintCommandBuffer): void;
  getLiveKeys(): readonly string[];
  getCompositingLayers(): ReadonlyMap<
    string,
    import("./pixi-compositing").CompositingLayer
  >;
  getUnsupported(): readonly {
    key: string;
    layerId: string;
    nodeType: string;
    message: string;
  }[];
  /**
   * Apply a paint-only patch without clearing the display cache.
   * Stale patches (sequence < current) are silently dropped.
   * Returns the new sequence number if applied, or current sequence if dropped.
   * @since Phase 2
   */
  applyPatch(patch: PaintPatch): PatchSequence;
  /** Clear all cached display objects. */
  clear(): void;
  /** Dispose all resources. */
  dispose(): void;
  /**
   * Whether the painter should skip rendering (paused state).
   * When true, paintCommands is a no-op.
   * @since Phase 8 (render on-demand)
   */
  setPaused(paused: boolean): void;
  readonly paused: boolean;
  /**
   * Get dirty diff statistics from the last paint frame.
   * @since Phase 8 (dirty diff)
   */
  getDiffStats(): {
    changed: number;
    unchanged: number;
    new_: number;
    removed: number;
    skipped: number;
  };
  /**
   * Capture the current frame as an ImageBitmap (if renderer provided).
   * Returns null if no renderer is available or capture fails.
   * @since Phase 10
   */
  captureImage(): Promise<ImageBitmap | null>;
  /**
   * Capture the current frame as a base64 data URL (if renderer provided).
   * Returns null if no renderer is available or capture fails.
   * @since Phase 10
   */
  captureDataURL(type?: string, quality?: number): string | null;
  /**
   * Get the root container (for external capture).
   * @since Phase 10
   */
  getRoot(): Container;
};

function hexToNumber(color: string | undefined, fallback = 0xffffff): number {
  if (!color) return fallback;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return fallback;
  return Number.parseInt(m[1]!, 16);
}

/** Apply full affine via Pixi Matrix + setFromMatrix (preserves skew). */

// ── Phase 11: Perspective 3D helpers ─────────────────────────────

/**
 * Project a point through a 4×4 matrix (column-major, 16 elements).
 * Returns [x, y] after perspective divide.
 */
function projectPoint(
  m: number[],
  x: number,
  y: number,
  z: number,
): [number, number] {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (Math.abs(w) < 1e-10) return [0, 0];
  const sx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  const sy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  return [sx, sy];
}

/**
 * Build a 2D affine matrix from 4 projected screen-space corners
 * (top-left, top-right, bottom-right, bottom-left of the source rect).
 * Uses least-squares fit on the three control points.
 */
function affineFromCorners(
  tl: [number, number],
  tr: [number, number],
  br: [number, number],
  srcW: number,
  srcH: number,
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  // Use 3 points: top-left (0,0), top-right (w,0), bottom-left (0,h)
  const a = (tr[0] - tl[0]) / Math.max(srcW, 1);
  const b = (tr[1] - tl[1]) / Math.max(srcW, 1);
  const c = (br[0] - tl[0]) / Math.max(srcH, 1);
  const d = (br[1] - tl[1]) / Math.max(srcH, 1);
  return { a, b, c, d, e: tl[0], f: tl[1] };
}

/**
 * Compute a 2D screen-space affine approximation from the full MVP chain:
 *   projectionMatrix_4x4 × viewMatrix_4x4 × worldMatrix4 × localPoint
 */
function projectTo2DAffine(
  projMatrix4: number[],
  viewMatrix4: number[],
  worldMatrix4: number[],
  width: number,
  height: number,
  viewportW: number,
  viewportH: number,
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  // Compose view * world (row-major convention: multiply as column-major)
  const vw = multiplyMat4(viewMatrix4, worldMatrix4);
  // Compose projection * view * world
  const mvp = multiplyMat4(projMatrix4, vw);

  // Project 4 corners of the source rect
  const tl = projectPoint(mvp, 0, 0, 0);
  const tr = projectPoint(mvp, width, 0, 0);
  const br = projectPoint(mvp, width, height, 0);

  // Convert from NDC [-1,1] to screen [0, viewportSize]
  const toScreen = (x: number, y: number): [number, number] => [
    (x + 1) * 0.5 * viewportW,
    (1 - y) * 0.5 * viewportH,
  ];
  const stl = toScreen(tl[0], tl[1]);
  const str = toScreen(tr[0], tr[1]);
  const sbr = toScreen(br[0], br[1]);

  return affineFromCorners(stl, str, sbr, width, height);
}

/** 4×4 column-major matrix multiply: C = A × B */
function multiplyMat4(a: number[], b: number[]): number[] {
  const r = new Array<number>(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      r[j * 4 + i] =
        a[0 * 4 + i] * b[j * 4 + 0]! +
        a[1 * 4 + i] * b[j * 4 + 1]! +
        a[2 * 4 + i] * b[j * 4 + 2]! +
        a[3 * 4 + i] * b[j * 4 + 3]!;
    }
  }
  return r;
}

// ── End Phase 11 helpers ─────────────────────────────────────────

export function applyAffineMatrix(
  display: Container | Text | Graphics | Sprite,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
  alpha: number,
  visible: boolean,
  zIndex: number,
  blendMode?:
    | "normal"
    | "multiply"
    | "screen"
    | "add"
    | "darken"
    | "lighten"
    | "overlay",
): void {
  const m = new Matrix(
    matrix.a,
    matrix.b,
    matrix.c,
    matrix.d,
    matrix.e,
    matrix.f,
  );
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
    } else if (effect.type === "inner-glow" && effect.radius > 0) {
      filters.push(
        createInnerGlowFilter({
          radius: effect.radius,
          color: effect.color,
          opacity: effect.opacity,
        }),
      );
    } else if (effect.type === "noise") {
      filters.push(
        createNoiseFilter({
          amount: effect.amount,
          scale: effect.scale,
          opacity: effect.opacity,
          seed: (effect.seed ?? hashSeed(effect.id) * 4294967295) / 4294967296,
        }),
      );
    }
  }
  display.filters = filters.length ? filters : null;
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
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

// ── Unsupported overlay (Task 5.7) ────────────────────────────────────

function drawUnsupportedOverlay(g: Graphics, w: number, h: number): void {
  const size = 16;
  const c1 = 0xff00ff;
  const c2 = 0x000000;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const even = (x / size + y / size) % 2 === 0;
      g.rect(x, y, Math.min(size, w - x), Math.min(size, h - y));
      g.fill(even ? c1 : c2);
    }
  }
}
export function createPixiFramePainter(
  options: PixiFramePainterOptions,
): PixiFramePainter {
  const { root } = options;
  const cache = new Map<string, CachedObject>();
  const assetStore = options.assetStore ?? createPixiAssetStore();
  let compositingCtx: CompositingContext | null = null;
  let lastPaint: PaintCommandBuffer | null = null;
  let lastLiveKeys: string[] = [];
  let currentSequence: PatchSequence = 0;
  let paused = false;
  let unsupported: Array<{
    key: string;
    layerId: string;
    nodeType: string;
    message: string;
  }> = [];

  // ── Phase 8: Dirty diff state ──────────────────────────────────
  const lastFingerprints = new Map<string, string>();
  let diffStats = { changed: 0, unchanged: 0, new_: 0, removed: 0, skipped: 0 };

  const clear = () => {
    for (const entry of cache.values()) {
      entry.display.destroy({ children: true });
    }
    cache.clear();
    if (compositingCtx) {
      compositingCtx.dispose();
      compositingCtx = null;
    }
    root.removeChildren();
    lastLiveKeys = [];
    unsupported = [];
  };

  const ensureObject = <T extends Container | Text | Graphics | Sprite>(
    key: string,
    kind: string,
    factory: () => T,
    parent: Container,
  ): T => {
    const existing = cache.get(key);
    if (existing && existing.kind === kind) {
      if (existing.display.parent !== parent) {
        parent.addChild(existing.display);
      }
      compositingCtx?.registerDisplay(key, existing.display);
      return existing.display as T;
    }
    if (existing) {
      existing.display.parent?.removeChild(existing.display);
      existing.display.destroy({ children: true });
      cache.delete(key);
    }
    const display = factory();
    display.label = key;
    parent.addChild(display);
    cache.set(key, { kind, display });
    compositingCtx?.registerDisplay(key, display);
    return display;
  };

  // ── Phase 8: Dirty diff helpers ─────────────────────────────────

  /** Extract transform for a given key from the command buffer. */
  const findTransformFor = (
    key: string,
    commands: readonly PaintCommand[],
  ): {
    matrix: {
      a: number;
      b: number;
      c: number;
      d: number;
      e: number;
      f: number;
    };
    alpha: number;
    visible: boolean;
    zIndex: number;
    blendMode?: string;
  } => {
    for (const cmd of commands) {
      if (cmd.op === "setTransform" && cmd.key === key) {
        return {
          matrix: cmd.matrix,
          alpha: cmd.alpha,
          visible: cmd.visible,
          zIndex: cmd.zIndex,
          blendMode: cmd.blendMode,
        };
      }
    }
    return {
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      alpha: 1,
      visible: true,
      zIndex: 0,
    };
  };

  /** Whether the paint command is a draw op that can be diffed. */
  const isDrawOp = (cmd: PaintCommand): cmd is PaintDrawCommand =>
    "key" in cmd &&
    [
      "drawText",
      "drawShape",
      "drawSolid",
      "drawImage",
      "drawVideo",
      "drawPath",
    ].includes(cmd.op);

  /** Check if fingerprint changed since last frame. */
  const fpChanged = (key: string): boolean => {
    const lastFp = lastFingerprints.get(key);
    if (!lastFp) return true; // new item
    const thisFp = thisFingerprints.get(key);
    return lastFp !== thisFp;
  };

  // ── Phase 8: Track fingerprint map for diff computation ───────
  const thisFingerprints = new Map<string, string>();

  const paintCommands = (buffer: PaintCommandBuffer) => {
    // Phase 8: No-op when paused (render on-demand)
    if (paused) return;

    lastPaint = buffer;
    const live = new Set<string>();
    unsupported = [];

    // Dispose previous compositing context
    if (compositingCtx) {
      compositingCtx.dispose();
    }

    let frameW = 1920;
    let frameH = 1080;
    let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null =
      null;
    // Phase 11: perspective 3D projection from beginFrame
    let projection: {
      viewMatrix: number[];
      projectionMatrix: number[];
    } | null = null;

    // Find beginFrame for dimensions
    for (const cmd of buffer.commands) {
      if (cmd.op === "beginFrame") {
        frameW = cmd.width;
        frameH = cmd.height;
        break;
      }
    }

    // ── Phase 8: Pre-compute all fingerprints for dirty diff ─────
    thisFingerprints.clear();
    for (const cmd of buffer.commands) {
      if (isDrawOp(cmd)) {
        const xf = findTransformFor(cmd.key, buffer.commands);
        thisFingerprints.set(cmd.key, computePaintItemFingerprint(cmd, xf));
      }
    }

    // ── Phase 8: Compute diff vs last frame ──────────────────────
    let changed = 0;
    let unchanged = 0;
    let new_ = 0;
    let removed = 0;
    let skipped = 0;

    const seenFp = new Set<string>();
    for (const [key, fp] of thisFingerprints) {
      seenFp.add(key);
      const lastFp = lastFingerprints.get(key);
      if (!lastFp) new_++;
      else if (lastFp === fp) {
        unchanged++;
        skipped++;
      } else changed++;
    }
    for (const key of lastFingerprints.keys()) {
      if (!seenFp.has(key)) removed++;
    }
    diffStats = { changed, unchanged, new_: new_, removed, skipped };
    lastFingerprints.clear();
    for (const [k, v] of thisFingerprints) lastFingerprints.set(k, v);

    // Create compositing context with proper nesting stack
    compositingCtx = createCompositingContext({
      root,
      width: frameW,
      height: frameH,
      renderer: options.renderer?.render
        ? { render: options.renderer.render.bind(options.renderer) }
        : undefined,
    });

    for (const cmd of buffer.commands) {
      if (cmd.op === "beginFrame") {
        options.onBackground?.(cmd.background ?? options.getBackground?.());
        // Phase 11: store projection for 3D-aware transforms
        projection = cmd.projection
          ? {
              viewMatrix: cmd.projection.viewMatrix,
              projectionMatrix: cmd.projection.projectionMatrix,
            }
          : null;
        continue;
      }
      if (cmd.op === "endFrame") {
        compositingCtx.endFrame();
        projection = null;
        continue;
      }
      if (cmd.op === "setTransform") {
        // Phase 11: apply perspective 3D projection when available
        if (cmd.matrix4 && projection) {
          const obj = cache.get(cmd.key);
          const projected2D = projectTo2DAffine(
            projection.projectionMatrix,
            projection.viewMatrix,
            cmd.matrix4,
            obj?.display?.width ?? 100,
            obj?.display?.height ?? 100,
            frameW,
            frameH,
          );
          if (projected2D) {
            pendingTransform = {
              ...cmd,
              matrix: projected2D,
            };
          } else {
            pendingTransform = cmd;
          }
        } else {
          pendingTransform = cmd;
        }
        continue;
      }

      // ── beginLayer (Phase 5: was skipped, now proper nesting) ──
      if (cmd.op === "beginLayer") {
        live.add(cmd.key);
        compositingCtx.pushLayer({
          key: cmd.key,
          offscreen: Boolean(cmd.offscreen),
          isolation: Boolean(cmd.isolation),
          ...(cmd.mask ? { mask: cmd.mask } : {}),
        });
        continue;
      }
      if (cmd.op === "endLayer") {
        compositingCtx.popLayer(cmd.key);
        continue;
      }

      // ── beginGroup (Phase 5: was flat, now push/pop stack) ─────
      if (cmd.op === "beginGroup") {
        live.add(cmd.key);
        const groupContainer = compositingCtx.pushGroup(cmd.key, cmd.layerId);
        if (pendingTransform && pendingTransform.key === cmd.key) {
          applyAffineMatrix(
            groupContainer,
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
      if (cmd.op === "endGroup") {
        compositingCtx.popGroup(cmd.key);
        continue;
      }

      // ── unsupported (Phase 5: diagnostic overlay) ───────────────
      if (cmd.op === "unsupported") {
        live.add(cmd.key);
        const info = {
          key: cmd.key,
          layerId: cmd.layerId,
          nodeType: cmd.nodeType,
          message: cmd.message,
        };
        unsupported.push(info);
        options.onUnsupported?.(info);
        // Draw diagnostic checkerboard overlay
        const parent = compositingCtx.currentParent;
        const g = ensureObject(
          cmd.key,
          "unsupported-gfx",
          () => new Graphics(),
          parent,
        );
        g.clear();
        const w = 100;
        const h = 100;
        if (pendingTransform?.key === cmd.key) {
          applyAffineMatrix(
            g,
            pendingTransform.matrix,
            pendingTransform.alpha,
            pendingTransform.visible,
            pendingTransform.zIndex,
            pendingTransform.blendMode,
          );
          pendingTransform = null;
        }
        drawUnsupportedOverlay(g, w, h);
        continue;
      }

      // ── Draw ops (Phase 5: parent = compositingCtx.currentParent) ──
      live.add(cmd.key);
      const xf = pendingTransform?.key === cmd.key ? pendingTransform : null;
      if (pendingTransform?.key === cmd.key) pendingTransform = null;
      const parent = compositingCtx.currentParent;

      if (cmd.op === "drawText") {
        const displayText =
          cmd.runs && cmd.runs.length > 0
            ? cmd.runs.map((r) => r.text).join("")
            : cmd.text;
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
          parent,
        );
        // Phase 8: Skip updates if fingerprint unchanged
        if (fpChanged(cmd.key)) {
          text.text = displayText;
          text.style.fontSize = cmd.fontSize;
          text.style.fill = cmd.runs?.[0]?.fill ?? cmd.fill;
          if (cmd.fontWeight != null) {
            text.style.fontWeight = String(
              cmd.fontWeight,
            ) as typeof text.style.fontWeight;
          }
          if (cmd.lineHeight != null) text.style.lineHeight = cmd.lineHeight;
          if (cmd.letterSpacing != null)
            text.style.letterSpacing = cmd.letterSpacing;
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
        }
        continue;
      }

      if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
        const g = ensureObject(
          cmd.key,
          "graphics",
          () => new Graphics(),
          parent,
        );
        // Phase 8: Skip clear + redraw if fingerprint unchanged
        if (fpChanged(cmd.key)) {
          g.clear();
          const w = cmd.width;
          const h = cmd.height;
          if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
            g.ellipse(w / 2, h / 2, w / 2, h / 2);
          } else if (cmd.op === "drawShape" && cmd.shape === "polygon") {
            const pts =
              cmd.points && cmd.points.length >= 3
                ? cmd.points
                : [
                    { x: 0.5, y: 0 },
                    { x: 0, y: 1 },
                    { x: 1, y: 1 },
                  ];
            g.moveTo(pts[0]!.x * w, pts[0]!.y * h);
            for (let i = 1; i < pts.length; i++) {
              g.lineTo(pts[i]!.x * w, pts[i]!.y * h);
            }
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
        }
        continue;
      }

      if (cmd.op === "drawPath") {
        const g = ensureObject(cmd.key, "path", () => new Graphics(), parent);
        // Phase 8: Skip clear + redraw if fingerprint unchanged
        if (fpChanged(cmd.key)) {
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
            const style = paintFillStyle(
              cmd.fill,
              cmd.fillPaint,
              boundsW,
              boundsH,
            );
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
        }
        continue;
      }

      if (cmd.op === "drawImage" || cmd.op === "drawVideo") {
        let texture = Texture.WHITE;
        let staleAsset = false;
        if (cmd.uri) {
          const cached = assetStore.get(cmd.uri);
          if (cached) {
            texture = cached;
          } else if (cmd.op === "drawImage") {
            staleAsset = true;
            void assetStore.load(cmd.uri, () => {
              if (lastPaint) paintCommands(lastPaint);
            });
          }
        }
        const sprite = ensureObject(
          cmd.key,
          cmd.op === "drawVideo" ? "video" : "sprite",
          () => new Sprite(texture),
          parent,
        );
        // Phase 8: Skip texture/size updates if fingerprint unchanged
        if (fpChanged(cmd.key)) {
          // Stale guard: keep previous texture instead of flashing WHITE
          if (!staleAsset || sprite.texture === Texture.WHITE) {
            sprite.texture = texture;
          }
          sprite.width = cmd.width;
          sprite.height = cmd.height;

          // Stale asset diagnostic: magenta tint
          if (staleAsset && sprite.texture === Texture.WHITE) {
            sprite.tint = 0xff00ff;
          } else {
            sprite.tint = 0xffffff;
          }

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
        continue;
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
    getCompositingLayers: () => compositingCtx?.getLayers() ?? new Map(),
    getUnsupported: () => unsupported,
    setPaused(p: boolean) {
      paused = p;
    },
    get paused() {
      return paused;
    },
    getDiffStats: () => ({ ...diffStats }),
    async captureImage(): Promise<ImageBitmap | null> {
      if (!options.renderer) return null;
      try {
        const canvas = options.renderer.extract.canvas(root);
        return await createImageBitmap(canvas);
      } catch {
        return null;
      }
    },
    captureDataURL(type = "image/png", quality?: number): string | null {
      if (!options.renderer) return null;
      try {
        const canvas = options.renderer.extract.canvas(root);
        return canvas.toDataURL(type, quality);
      } catch {
        return null;
      }
    },
    getRoot: () => root,
    applyPatch(patch: PaintPatch): PatchSequence {
      // Drop stale patches
      if (isPatchStale(patch, currentSequence)) return currentSequence;

      // Find the cached display object by key
      const entry = cache.get(patch.layerId);
      if (!entry) return currentSequence;

      // Apply property update without clearing Graphics cache
      const display = entry.display;
      try {
        if (
          patch.property === "appearance.opacity" &&
          typeof patch.value === "number"
        ) {
          display.alpha = patch.value;
        } else if (
          patch.property === "appearance.visible" &&
          typeof patch.value === "boolean"
        ) {
          display.visible = patch.value;
        } else if (
          patch.property === "style.fill" &&
          entry.kind === "graphics" &&
          typeof patch.value === "string"
        ) {
          const g = display as Graphics;
          // Only update fill for shape/solid graphics
          if (lastPaint) {
            // Re-execute the relevant paint command for this key
            for (const cmd of lastPaint.commands) {
              if (
                "key" in cmd &&
                cmd.key === patch.layerId &&
                (cmd.op === "drawShape" || cmd.op === "drawSolid")
              ) {
                g.clear();
                const w = cmd.width;
                const h = cmd.height;
                if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
                  g.ellipse(w / 2, h / 2, w / 2, h / 2);
                } else if (cmd.op === "drawShape" && cmd.shape === "polygon") {
                  const pts =
                    cmd.points && cmd.points.length >= 3
                      ? cmd.points
                      : [
                          { x: 0.5, y: 0 },
                          { x: 0, y: 1 },
                          { x: 1, y: 1 },
                        ];
                  g.moveTo(pts[0]!.x * w, pts[0]!.y * h);
                  for (let i = 1; i < pts.length; i++) {
                    g.lineTo(pts[i]!.x * w, pts[i]!.y * h);
                  }
                  g.closePath();
                } else if (cmd.op === "drawShape" && cmd.cornerRadius) {
                  g.roundRect(0, 0, w, h, cmd.cornerRadius);
                } else {
                  g.rect(0, 0, w, h);
                }
                const fillStyle = paintFillStyle(
                  patch.value as string,
                  cmd.op === "drawShape" ? cmd.fillPaint : undefined,
                  w,
                  h,
                );
                g.fill(fillStyle);
                break;
              }
            }
          }
        }
        // For other properties, fall through to full re-paint
        currentSequence = patch.sequence;
      } catch {
        // On error, fallback to full re-paint next frame
        // (don't increment sequence so next valid patch applies)
      }

      return currentSequence;
    },
    clear,
    dispose() {
      clear();
      assetStore.dispose();
      if (compositingCtx) {
        compositingCtx.dispose();
        compositingCtx = null;
      }
      lastPaint = null;
    },
  };
}

export { hexToNumber };
