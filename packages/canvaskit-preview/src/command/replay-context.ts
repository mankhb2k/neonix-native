import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import type { SkiaProjectionContext } from "./geometry";
import type { MaskSource } from "./masks";
import type { ReplayLayer, SkiaFontResolver, SkiaReplayResources, SkiaReplayStats } from "./types";

export type SetTransformCommand = Extract<PaintCommand, { op: "setTransform" }>;
export type ReplaySurface = ReturnType<SkiaCanvasKit["MakeSurface"]>;

/**
 * Everything one `replaySkiaCommands()` call shares across its command
 * handlers (box-effect.ts, layers.ts, draw-ops.ts). The inputs never change
 * during a replay; the frame fields are reset by each `beginFrame`, and
 * `pendingTransform` is set by `setTransform` and consumed by the next draw.
 */
export type ReplayContext = {
  readonly kit: SkiaCanvasKit;
  readonly canvas: SkiaCanvas;
  readonly buffer: PaintCommandBuffer;
  readonly assets: ReadonlyMap<string, SkiaAsset>;
  readonly defaultBackground: string;
  readonly fontFor: SkiaFontResolver;
  readonly deviceScale: number;
  readonly resources: SkiaReplayResources | undefined;
  readonly stats: SkiaReplayStats;
  readonly layers: ReplayLayer[];
  readonly layerTransforms: ReadonlyMap<string, SetTransformCommand>;
  pendingTransform: SetTransformCommand | null;
  frameWidth: number;
  frameHeight: number;
  graphId: string;
  projectionContext: SkiaProjectionContext | undefined;
  semanticSources: Map<string, MaskSource>;
  /** Arrow functions, safe to destructure off the context. */
  readonly isBlocked: () => boolean;
  readonly addDiagnostic: (value: string) => void;
  readonly acquireSurface: (surfaceWidth: number, surfaceHeight: number) => ReplaySurface;
  readonly releaseSurface: (surfaceWidth: number, surfaceHeight: number, value: NonNullable<ReplaySurface>) => void;
};

export function createReplayContext(input: {
  kit: SkiaCanvasKit;
  canvas: SkiaCanvas;
  buffer: PaintCommandBuffer;
  assets: ReadonlyMap<string, SkiaAsset>;
  defaultBackground: string;
  fontFor: SkiaFontResolver;
  deviceScale: number;
  resources: SkiaReplayResources | undefined;
}): ReplayContext {
  const { kit, buffer, resources } = input;
  const stats: SkiaReplayStats = {
    drawCalls: 0,
    textTimeMs: 0,
    layerTimeMs: 0,
    endLayerTimeMs: 0,
    pathTimeMs: 0,
    shapeTimeMs: 0,
    skippedCommands: 0,
    textureUploads: 0,
    videoTextureUploads: 0,
    nativeTextGlyphs: 0,
    nativeColorTextGlyphs: 0,
    outlineTextGlyphs: 0,
    colorTextGlyphs: 0,
    imageCacheHits: 0,
    filterCacheHits: 0,
    maskCacheHits: 0,
    projectiveMeshCacheHits: 0,
    offscreenSurfaceCreates: 0,
    offscreenSurfaceReuses: 0,
    diagnostics: [],
    noiseRegions: [],
  };
  const layers: ReplayLayer[] = [];
  const layerTransforms = new Map<string, SetTransformCommand>();
  for (const command of buffer.commands) {
    if (command.op === "setTransform") layerTransforms.set(command.key, command);
  }
  return {
    ...input,
    stats,
    layers,
    layerTransforms,
    pendingTransform: null,
    frameWidth: 0,
    frameHeight: 0,
    graphId: "",
    projectionContext: undefined,
    semanticSources: new Map<string, MaskSource>(),
    isBlocked: () => layers.some((layer) => layer.blocked),
    addDiagnostic: (value) => { stats.diagnostics.push(value); },
    acquireSurface: (surfaceWidth, surfaceHeight) => {
      const result = resources?.surfacePool.acquire(surfaceWidth, surfaceHeight) ?? { surface: kit.MakeSurface(surfaceWidth, surfaceHeight), reused: false };
      if (result.reused) stats.offscreenSurfaceReuses++;
      else if (result.surface) stats.offscreenSurfaceCreates++;
      return result.surface;
    },
    releaseSurface: (surfaceWidth, surfaceHeight, value) => {
      if (resources && value) resources.surfacePool.release(surfaceWidth, surfaceHeight, value);
      else value?.dispose();
    },
  };
}
