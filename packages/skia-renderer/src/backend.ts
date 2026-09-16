import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { loadCanvasKit, type SkiaSurface, type SkiaTypeface } from "./canvas-kit";
import { replaySkiaCommands, type SkiaReplayResources } from "./command";
import type { SkiaDiagnostic, SkiaRenderer, SkiaRendererOptions, SkiaRenderStats, SkiaAsset, SkiaFontAsset } from "./types";
import { createSkiaSurface } from "./surface";

function fract(value: number): number {
  return value - Math.floor(value);
}

function noiseHash(x: number, y: number): number {
  let vx = fract(x * 0.1031);
  let vy = fract(y * 0.1031);
  let vz = fract((x + y) * 0.1031);
  const dot = vx * (vy + 33.33) + vy * (vz + 33.33) + vz * (vx + 33.33);
  vx += dot;
  vy += dot;
  vz += dot;
  return fract((vx + vy) * vz);
}

function applyNoise(
  pixels: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  regions: Array<{ effect: { scale: number; amount: number; opacity: number; seed: number }; bounds: { left: number; top: number; right: number; bottom: number } }>,
  dpr: number,
): void {
  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.bounds.left * dpr));
    const top = Math.max(0, Math.floor(region.bounds.top * dpr));
    const right = Math.min(pixelWidth, Math.ceil(region.bounds.right * dpr));
    const bottom = Math.min(pixelHeight, Math.ceil(region.bounds.bottom * dpr));
    const scale = Math.max(region.effect.scale, 0.25);
    const strength = region.effect.amount * region.effect.opacity;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * pixelWidth + x) * 4;
        const alpha = pixels[index + 3]! / 255;
        if (alpha <= 0.000001) continue;
        const cellX = Math.floor(x / scale);
        const cellY = Math.floor(y / scale);
        const value = noiseHash(cellX + region.effect.seed, cellY + region.effect.seed * 1.37);
        const delta = (value - 0.5) * 2 * strength;
        pixels[index] = Math.round(Math.max(0, Math.min(255, pixels[index]! / alpha + delta * 255)));
        pixels[index + 1] = Math.round(Math.max(0, Math.min(255, pixels[index + 1]! / alpha + delta * 255)));
        pixels[index + 2] = Math.round(Math.max(0, Math.min(255, pixels[index + 2]! / alpha + delta * 255)));
      }
    }
  }
}

export async function createSkiaRenderer(options: SkiaRendererOptions): Promise<SkiaRenderer> {
  const kit = options.canvasKit ?? await loadCanvasKit();
  let width = options.width ?? (options.canvas.width || 1);
  let height = options.height ?? (options.canvas.height || 1);
  let dpr = Number.isFinite(options.devicePixelRatio) && (options.devicePixelRatio ?? 0) > 0 ? options.devicePixelRatio! : 1;
  let backingWidth = Math.max(1, Math.round(width * dpr));
  let backingHeight = Math.max(1, Math.round(height * dpr));
  options.canvas.width = backingWidth;
  options.canvas.height = backingHeight;
  let usingDirectPresentation = false;
  const makeSurface = (): SkiaSurface | null => {
    const selected = createSkiaSurface(kit, options.canvas, backingWidth, backingHeight, options.directPresentation === true);
    usingDirectPresentation = selected.directPresentation;
    return selected.surface;
  };
  let surface: SkiaSurface | null = makeSurface();
  if (!surface) throw new Error("skia-renderer: CanvasKit surface unavailable");
  const diagnostics: SkiaDiagnostic[] = [];
  const maxDiagnostics = Math.max(1, options.maxDiagnostics ?? 100);
  const add = (diagnostic: SkiaDiagnostic) => {
    diagnostics.push(diagnostic);
    if (diagnostics.length > maxDiagnostics) diagnostics.splice(0, diagnostics.length - maxDiagnostics);
    options.onDiagnostic?.(diagnostic);
  };
  let stats: SkiaRenderStats = {
    backend: "skia",
    presentationMode: usingDirectPresentation ? "direct" : "readback",
    drawCalls: 0,
    textTimeMs: 0,
    layerTimeMs: 0,
    endLayerTimeMs: 0,
    pathTimeMs: 0,
    shapeTimeMs: 0,
    skippedCommands: 0,
    nativeTextGlyphs: 0,
    nativeColorTextGlyphs: 0,
    outlineTextGlyphs: 0,
    colorTextGlyphs: 0,
    frameTimeMs: 0,
    replayTimeMs: 0,
    flushTimeMs: 0,
    readbackTimeMs: 0,
    textureUploads: 0,
    videoTextureUploads: 0,
    imageCacheHits: 0,
    filterCacheHits: 0,
    maskCacheHits: 0,
    projectiveMeshCacheHits: 0,
    offscreenSurfaceCreates: 0,
    offscreenSurfaceReuses: 0,
    imageCacheEntries: 0,
    filterCacheEntries: 0,
    maskCacheEntries: 0,
    projectiveMeshCacheEntries: 0,
    pooledSurfaceCount: 0,
    estimatedCacheBytes: 0,
    diagnostics,
  };
  const assets = new Map<string, SkiaAsset>(options.assets ?? []);
  const fonts = new Map<string, SkiaFontAsset>(options.fonts ?? []);
  const typefaces = new Map<string, { source: SkiaFontAsset; typeface: SkiaTypeface }>();
  const fontCache = new Map<string, { source: SkiaFontAsset; font: import("./canvas-kit").SkiaFont }>();
  const imageCache = new Map<string, { identity: string; image: import("./canvas-kit").SkiaImage }>();
  const filterCache = new Map<string, { filter: import("./canvas-kit").SkiaImageFilter | null; supported: boolean }>();
  const maskCache = new Map<string, import("./canvas-kit").SkiaImage>();
  const projectiveMeshCache = new Map<string, import("./command/geometry").ProjectiveTextureMesh | null>();
  const pathCache = new Map<string, { signature: string; path: import("./canvas-kit").SkiaPath }>();
  const pooledSurfaces = new Map<string, SkiaSurface[]>();
  const maxPooledSurfaces = 8;
  const replayResources: SkiaReplayResources = {
    imageCache,
    filterCache,
    maskCache,
    projectiveMeshCache,
    pathCache,
    surfacePool: {
      acquire(surfaceWidth, surfaceHeight) {
        const key = `${surfaceWidth}x${surfaceHeight}`;
        const bucket = pooledSurfaces.get(key);
        const pooled = bucket?.pop();
        return { surface: pooled ?? kit.MakeSurface(surfaceWidth, surfaceHeight), reused: Boolean(pooled) };
      },
      release(surfaceWidth, surfaceHeight, value) {
        const key = `${surfaceWidth}x${surfaceHeight}`;
        const bucket = pooledSurfaces.get(key) ?? [];
        if (bucket.length >= maxPooledSurfaces) value.dispose();
        else {
          bucket.push(value);
          pooledSurfaces.set(key, bucket);
        }
      },
      dispose() {
        for (const bucket of pooledSurfaces.values()) for (const value of bucket) value.dispose();
        pooledSurfaces.clear();
      },
    },
  };
  const releaseTypeface = (fontAssetId: string) => {
    for (const [key, cachedFont] of fontCache) {
      if (!key.startsWith(`${fontAssetId}\0`)) continue;
      cachedFont.font.delete();
      fontCache.delete(key);
    }
    const cached = typefaces.get(fontAssetId);
    cached?.typeface.delete();
    typefaces.delete(fontAssetId);
  };
  const typefaceFor = (fontAssetId: string | undefined): SkiaTypeface | null => {
    if (!fontAssetId) return null;
    const source = fonts.get(fontAssetId);
    if (!source) return null;
    const cached = typefaces.get(fontAssetId);
    if (cached?.source === source) return cached.typeface;
    releaseTypeface(fontAssetId);
    const typeface = kit.Typeface.MakeTypefaceFromData(source);
    if (!typeface) return null;
    typefaces.set(fontAssetId, { source, typeface });
    return typeface;
  };
  const fontFor = (fontAssetId: string | undefined, fontSize: number): import("./canvas-kit").SkiaFont | null => {
    if (!fontAssetId || !Number.isFinite(fontSize) || fontSize <= 0) return null;
    const source = fonts.get(fontAssetId);
    const typeface = typefaceFor(fontAssetId);
    if (!source || !typeface) return null;
    const key = `${fontAssetId}\0${fontSize}`;
    const cached = fontCache.get(key);
    if (cached?.source === source) return cached.font;
    cached?.font.delete();
    const font = new kit.Font(typeface, fontSize);
    font.setSubpixel(true);
    fontCache.set(key, { source, font });
    return font;
  };
  const cacheMetrics = () => {
    const pooledSurfaceCount = [...pooledSurfaces.values()].reduce((total, bucket) => total + bucket.length, 0);
    const imageBytes = [...imageCache.keys()].reduce((total, assetId) => {
      const asset = assets.get(assetId);
      return total + (asset ? Math.max(1, Math.ceil(asset.width)) * Math.max(1, Math.ceil(asset.height)) * 4 : 0);
    }, 0);
    const maskBytes = [...maskCache.values()].reduce((total) => total + backingWidth * backingHeight * 4, 0);
    const meshBytes = [...projectiveMeshCache.values()].reduce((total, mesh) => total + (mesh ? mesh.positions.byteLength + mesh.texCoords.byteLength + mesh.indices.byteLength : 0), 0);
    return {
      imageCacheEntries: imageCache.size,
      filterCacheEntries: filterCache.size,
      maskCacheEntries: maskCache.size,
      projectiveMeshCacheEntries: projectiveMeshCache.size,
      pooledSurfaceCount,
      estimatedCacheBytes: imageBytes + maskBytes + meshBytes + pooledSurfaceCount * backingWidth * backingHeight * 4,
    };
  };
  const recreateSurface = (nextWidth: number, nextHeight: number, nextDpr: number) => {
    const normalizedDpr = Number.isFinite(nextDpr) && nextDpr > 0 ? nextDpr : 1;
    if (nextWidth === width && nextHeight === height && normalizedDpr === dpr) return;
    surface?.dispose();
    width = Math.max(1, Math.floor(nextWidth));
    height = Math.max(1, Math.floor(nextHeight));
    dpr = normalizedDpr;
    backingWidth = Math.max(1, Math.round(width * dpr));
    backingHeight = Math.max(1, Math.round(height * dpr));
    options.canvas.width = backingWidth;
    options.canvas.height = backingHeight;
    surface = makeSurface();
    if (!surface) throw new Error("skia-renderer: CanvasKit surface unavailable after resize");
  };
  const paint = (buffer: PaintCommandBuffer): SkiaRenderStats => {
    const started = performance.now();
    const activeSurface = surface;
    if (!activeSurface) throw new Error("skia-renderer: renderer has been disposed");
    const canvas = activeSurface.getCanvas();
    // Runtime coordinates are composition units. The Skia surface is physical
    // pixels, so keep the command buffer unchanged and apply the same logical
    // to physical scale used by the GPU preview backends.
    canvas.save();
    if (dpr !== 1) canvas.concat([dpr, 0, 0, 0, dpr, 0, 0, 0, 1]);
    const replayStarted = performance.now();
    const replay = replaySkiaCommands(kit, canvas, buffer, assets, options.background, fontFor, dpr, replayResources);
    const replayTimeMs = performance.now() - replayStarted;
    canvas.restore();
    if (replay.skippedCommands) {
      add({ severity: "warning", code: "skia_command_unsupported", message: `Skia skipped ${replay.skippedCommands} command(s)`, key: "skia" });
    }
    for (const replayDiagnostic of replay.diagnostics) {
      const code = replayDiagnostic.startsWith("text_color_glyph_fallback")
        ? "skia_text_color_glyph_fallback"
        : replayDiagnostic.startsWith("skia_mask_unsupported")
          ? "skia_mask_unsupported"
          : replayDiagnostic.startsWith("skia_effect_unsupported")
            ? "skia_effect_unsupported"
            : replayDiagnostic.startsWith("skia_clip_path_unsupported")
            ? "skia_clip_path_unsupported"
              : replayDiagnostic.startsWith("skia_mask_surface_unsupported")
                ? "skia_mask_surface_unsupported"
                : replayDiagnostic.startsWith("skia_mask_surface_unavailable")
                  ? "skia_mask_surface_unavailable"
                  : replayDiagnostic.startsWith("skia_mask_snapshot_unsupported")
                    ? "skia_mask_snapshot_unsupported"
                    : replayDiagnostic.startsWith("skia_mask_composite_unsupported")
                      ? "skia_mask_composite_unsupported"
                      : replayDiagnostic.startsWith("drawImage:") || replayDiagnostic.startsWith("drawVideo:")
                        ? "skia_asset_unsupported"
              : "skia_replay_diagnostic";
      add({ severity: "warning", code, message: replayDiagnostic, key: "skia" });
    }
    const flushStarted = performance.now();
    activeSurface.flush();
    const flushTimeMs = performance.now() - flushStarted;
    // A live browser preview should stay on the GPU presentation path. The
    // readback bridge is intentionally retained for export, pixel tests and
    // CPU post-processing callers that explicitly need RGBA bytes.
    if (usingDirectPresentation) {
      stats = {
        ...stats,
        presentationMode: "direct",
        drawCalls: replay.drawCalls,
        textTimeMs: replay.textTimeMs,
        layerTimeMs: replay.layerTimeMs,
        endLayerTimeMs: replay.endLayerTimeMs,
        pathTimeMs: replay.pathTimeMs,
        shapeTimeMs: replay.shapeTimeMs,
        skippedCommands: replay.skippedCommands,
        textureUploads: replay.textureUploads,
        videoTextureUploads: replay.videoTextureUploads,
        nativeTextGlyphs: replay.nativeTextGlyphs,
        nativeColorTextGlyphs: replay.nativeColorTextGlyphs,
        outlineTextGlyphs: replay.outlineTextGlyphs,
        colorTextGlyphs: replay.colorTextGlyphs,
        imageCacheHits: replay.imageCacheHits,
        filterCacheHits: replay.filterCacheHits,
        maskCacheHits: replay.maskCacheHits,
        projectiveMeshCacheHits: replay.projectiveMeshCacheHits,
        offscreenSurfaceCreates: replay.offscreenSurfaceCreates,
        offscreenSurfaceReuses: replay.offscreenSurfaceReuses,
        ...cacheMetrics(),
        frameTimeMs: performance.now() - started,
      };
      return stats;
    }
    const readbackStarted = performance.now();
    const pixels = canvas.readPixels(0, 0, {
      width: backingWidth,
      height: backingHeight,
      alphaType: kit.AlphaType.Unpremul,
      colorType: kit.ColorType.RGBA_8888,
      colorSpace: kit.ColorSpace.SRGB,
    });
    if (pixels && replay.noiseRegions.length) applyNoise(pixels, backingWidth, backingHeight, replay.noiseRegions, dpr);
    if (pixels) {
      options.onReadback?.(pixels, backingWidth, backingHeight);
      const target = typeof (options.canvas as { getContext?: unknown }).getContext === "function"
        ? options.canvas.getContext("2d") as CanvasRenderingContext2D | null
        : null;
      if (target && typeof ImageData !== "undefined") {
        target.putImageData(new ImageData(new Uint8ClampedArray(pixels), backingWidth, backingHeight), 0, 0);
      }
    }
    const readbackTimeMs = performance.now() - readbackStarted;
    stats = {
      ...stats,
      presentationMode: "readback",
      drawCalls: replay.drawCalls,
      textTimeMs: replay.textTimeMs,
      layerTimeMs: replay.layerTimeMs,
      endLayerTimeMs: replay.endLayerTimeMs,
      pathTimeMs: replay.pathTimeMs,
      shapeTimeMs: replay.shapeTimeMs,
      skippedCommands: replay.skippedCommands,
      textureUploads: replay.textureUploads,
      videoTextureUploads: replay.videoTextureUploads,
      nativeTextGlyphs: replay.nativeTextGlyphs,
      nativeColorTextGlyphs: replay.nativeColorTextGlyphs,
      outlineTextGlyphs: replay.outlineTextGlyphs,
      colorTextGlyphs: replay.colorTextGlyphs,
      imageCacheHits: replay.imageCacheHits,
      filterCacheHits: replay.filterCacheHits,
      maskCacheHits: replay.maskCacheHits,
      projectiveMeshCacheHits: replay.projectiveMeshCacheHits,
      offscreenSurfaceCreates: replay.offscreenSurfaceCreates,
      offscreenSurfaceReuses: replay.offscreenSurfaceReuses,
      ...cacheMetrics(),
      frameTimeMs: performance.now() - started,
      replayTimeMs,
      flushTimeMs,
      readbackTimeMs,
    };
    return stats;
  };
  add({ severity: "info", code: "skia_backend_selected", message: "Skia CanvasKit renderer selected", key: "skia" });
  return {
    backend: "skia",
    canvas: options.canvas,
    paintFrame(frame) {
      paint(frame);
    },
    paintCommands(buffer) {
      paint(buffer);
    },
    resize(nextWidth, nextHeight, nextDpr = dpr) {
      recreateSurface(nextWidth, nextHeight, nextDpr);
    },
    setAsset(assetId, asset) {
      imageCache.get(assetId)?.image.delete();
      imageCache.delete(assetId);
      assets.set(assetId, asset);
    },
    removeAsset(assetId) {
      imageCache.get(assetId)?.image.delete();
      imageCache.delete(assetId);
      assets.delete(assetId);
    },
    setFont(fontAssetId, font) {
      if (fonts.get(fontAssetId) !== font) releaseTypeface(fontAssetId);
      fonts.set(fontAssetId, font);
    },
    removeFont(fontAssetId) {
      releaseTypeface(fontAssetId);
      fonts.delete(fontAssetId);
    },
    getStats() {
      return stats;
    },
    captureImageBitmap() {
      if (typeof createImageBitmap !== "function") return Promise.resolve(null);
      return createImageBitmap(options.canvas);
    },
    dispose() {
      surface?.dispose();
      surface = null;
      for (const entry of imageCache.values()) entry.image.delete();
      imageCache.clear();
      for (const entry of fontCache.values()) entry.font.delete();
      fontCache.clear();
      for (const entry of filterCache.values()) entry.filter?.delete();
      filterCache.clear();
      for (const image of maskCache.values()) image.delete();
      maskCache.clear();
      projectiveMeshCache.clear();
      for (const entry of pathCache.values()) entry.path.delete();
      pathCache.clear();
      replayResources.surfacePool.dispose();
      assets.clear();
      for (const fontAssetId of [...typefaces.keys()]) releaseTypeface(fontAssetId);
      fonts.clear();
    },
  };
}
