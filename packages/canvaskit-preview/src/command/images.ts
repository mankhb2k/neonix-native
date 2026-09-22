import type { PaintCommand } from "@motionvideo/motion-runtime";
import type { SkiaCanvas, SkiaCanvasKit, SkiaImage } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { projectiveTextureMesh, projectiveTextureShaderMatrix, type ProjectiveTextureMesh, type SkiaProjectionContext } from "./geometry";
import type { SkiaReplayResources } from "./types";

function imageRectForCommand(
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
): { source: [number, number, number, number]; destination: [number, number, number, number]; clip?: [number, number, number, number] } {
  const viewportWidth = command.width;
  const viewportHeight = command.height;
  const fit = command.op === "drawImage" ? command.fit : undefined;
  const videoFit = command.op === "drawVideo" ? command.fit : undefined;
  const preserve = command.op === "drawImage" ? command.preserveAspectRatio : undefined;
  const align = preserve?.align ?? "xMidYMid";
  const alignX = align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5;
  const alignY = align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5;
  if (fit === "none") {
    const x0 = command.op === "drawImage" ? command.x : 0;
    const y0 = command.op === "drawImage" ? command.y : 0;
    const x = x0 + (viewportWidth - asset.width) * alignX;
    const y = y0 + (viewportHeight - asset.height) * alignY;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + asset.width, y + asset.height],
      clip: [x0, y0, x0 + viewportWidth, y0 + viewportHeight],
    };
  }
  const none = videoFit === "none" || align === "none";
  if (none) {
    const x = command.op === "drawImage" ? command.x : 0;
    const y = command.op === "drawImage" ? command.y : 0;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + viewportWidth, y + viewportHeight],
    };
  }
  const forceFill = fit === "fill" || (command.op === "drawVideo" && !videoFit);
  if (forceFill) {
    const x = command.op === "drawImage" ? command.x : 0;
    const y = command.op === "drawImage" ? command.y : 0;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + viewportWidth, y + viewportHeight],
    };
  }
  const slice = fit === "cover" || preserve?.meetOrSlice === "slice";
  const scale = slice
    ? Math.max(viewportWidth / asset.width, viewportHeight / asset.height)
    : Math.min(viewportWidth / asset.width, viewportHeight / asset.height);
  const drawWidth = asset.width * scale;
  const drawHeight = asset.height * scale;
  const x = command.op === "drawImage" ? command.x : 0;
  const y = command.op === "drawImage" ? command.y : 0;
  const xFactor = align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5;
  const yFactor = align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5;
  return {
    source: [0, 0, asset.width, asset.height],
    destination: [x + (viewportWidth - drawWidth) * xFactor, y + (viewportHeight - drawHeight) * yFactor, x + (viewportWidth - drawWidth) * xFactor + drawWidth, y + (viewportHeight - drawHeight) * yFactor + drawHeight],
    clip: slice ? [x, y, x + viewportWidth, y + viewportHeight] : undefined,
  };
}

function snapshotVideoSource(asset: SkiaAsset): TexImageSource | null {
  if (
    asset.kind !== "video" ||
    typeof HTMLVideoElement === "undefined" ||
    !(asset.source instanceof HTMLVideoElement)
  ) return asset.source ?? null;

  const width = Math.max(1, Math.floor(asset.width));
  const height = Math.max(1, Math.floor(asset.height));
  // Use a DOM canvas here rather than OffscreenCanvas: CanvasKit 0.42's
  // MakeImageFromCanvasImageSource path reads the browser canvas backing store
  // and some builds do not expose the same internal fields for OffscreenCanvas.
  const snapshot = Object.assign(document.createElement("canvas"), { width, height });
  const context = snapshot.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) return asset.source ?? null;
  context.drawImage(asset.source, 0, 0, width, height);
  return snapshot;
}

export type DrawAssetResult = {
  drawn: boolean;
  imageCacheHit: boolean;
  projectiveMeshCacheHit: boolean;
  uploaded: boolean;
};

function assetIdentity(asset: SkiaAsset): string {
  const revision = asset.decodedFrameRevision ?? asset.frameVersion ?? asset.contentRevision ?? asset.resourceGeneration;
  // A video without a host frame revision must not be cached: its pixels can
  // change while the HTMLVideoElement object remains the same.
  if (asset.kind === "video" && revision === undefined) return `video:uncacheable:${asset.width}:${asset.height}`;
  return JSON.stringify({
    kind: asset.kind ?? "image",
    width: asset.width,
    height: asset.height,
    revision: revision ?? 0,
    encodedLength: asset.encoded?.byteLength ?? 0,
  });
}

export function drawAsset(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
  alpha: number,
  blendMode?: unknown,
  projective?: { matrix: readonly number[]; context?: Pick<SkiaProjectionContext, "projection" | "depthClip" | "width" | "height" | "localClip" | "outputSpace"> },
  resources?: SkiaReplayResources,
): DrawAssetResult {
  // CanvasKit's browser helper is reliable for Image/Canvas/ImageBitmap but
  // older CanvasKit builds can throw while reading an HTMLVideoElement. The
  // host still owns video decoding; snapshot only the already-seeked current
  // frame into a canvas before handing pixels to Skia.
  let source: TexImageSource | null = null;
  const sourceForImage = () => {
    if (!source) source = snapshotVideoSource(asset);
    return source;
  };
  const cacheKey = resources ? command.assetId : undefined;
  const identity = assetIdentity(asset);
  const cacheable = asset.kind !== "video" || asset.frameVersion !== undefined || asset.decodedFrameRevision !== undefined || asset.contentRevision !== undefined;
  let image: SkiaImage | null = null;
  let imageCacheHit = false;
  let uploaded = false;
  if (cacheKey && cacheable) {
    const cached = resources!.imageCache.get(cacheKey);
    if (cached?.identity === identity) {
      image = cached.image;
      imageCacheHit = true;
    } else {
      cached?.image.delete();
        image = asset.encoded && kit.MakeImageFromEncoded
        ? kit.MakeImageFromEncoded(asset.encoded)
        : sourceForImage()
          ? kit.MakeImageFromCanvasImageSource(sourceForImage()!)
          : null;
      if (image) {
        if (!resources!.imageCache.has(cacheKey) && resources!.imageCache.size >= 64) {
          const oldest = resources!.imageCache.keys().next().value as string | undefined;
          if (oldest !== undefined) {
            resources!.imageCache.get(oldest)?.image.delete();
            resources!.imageCache.delete(oldest);
          }
        }
        resources!.imageCache.set(cacheKey, { identity, image });
      }
      uploaded = Boolean(image);
    }
  } else {
    image = asset.encoded && kit.MakeImageFromEncoded
      ? kit.MakeImageFromEncoded(asset.encoded)
      : sourceForImage()
        ? kit.MakeImageFromCanvasImageSource(sourceForImage()!)
        : null;
    uploaded = Boolean(image);
  }
  if (!image) return { drawn: false, imageCacheHit, projectiveMeshCacheHit: false, uploaded };
  const rects = imageRectForCommand(command, asset);
  const imagePaint = createSkiaPaint(kit, "#ffffff", alpha, kit.PaintStyle.Fill);
  if (blendMode !== undefined) imagePaint.setBlendMode(blendMode);
  const fastSample = command.op === "drawImage"
    && (command.imageRendering === "optimizeSpeed" || command.imageRendering === "crisp-edges" || command.imageRendering === "pixelated");
  const projectiveContext = projective?.context && rects.clip
    ? { ...projective.context, localClip: rects.clip }
    : projective?.context;
  const geometryKey = projective
    ? JSON.stringify({ destination: rects.destination, source: rects.source, matrix: projective.matrix, context: projectiveContext })
    : undefined;
  let projectiveMesh: ProjectiveTextureMesh | null = null;
  let projectiveMeshCacheHit = false;
  if (projective && kit.MakeVertices && canvas.drawVertices && image.makeShaderOptions) {
    if (geometryKey && resources?.projectiveMeshCache.has(geometryKey)) {
      projectiveMesh = resources.projectiveMeshCache.get(geometryKey) ?? null;
      projectiveMeshCacheHit = true;
    } else {
      projectiveMesh = projectiveTextureMesh(rects.destination, rects.source, projective.matrix, projectiveContext);
      if (geometryKey && resources) {
        if (!resources.projectiveMeshCache.has(geometryKey) && resources.projectiveMeshCache.size >= 256) {
          const oldest = resources.projectiveMeshCache.keys().next().value as string | undefined;
          if (oldest !== undefined) resources.projectiveMeshCache.delete(oldest);
        }
        resources.projectiveMeshCache.set(geometryKey, projectiveMesh);
      }
    }
  }
  const projectiveShaderMatrix = projective && projectiveMesh && projectiveContext?.outputSpace === "screen"
    ? projectiveTextureShaderMatrix(rects.destination, rects.source, projective.matrix)
    : undefined;
  // A transformed clipRect is not reliable for a quad crossing w=0 in every
  // CanvasKit backend. The projective mesh owns the equivalent local clip in
  // homogeneous space; retain the canvas clip only for the affine/fallback
  // image path.
  const useCanvasClip = Boolean(rects.clip && !projectiveMesh);
  if (useCanvasClip) {
    canvas.save();
    canvas.clipRect(rects.clip!, kit.ClipOp.Intersect, true);
  }
  if (projectiveMesh && kit.MakeVertices && canvas.drawVertices && image.makeShaderOptions) {
    const shader = image.makeShaderOptions(
      kit.TileMode.Clamp,
      kit.TileMode.Clamp,
      fastSample ? kit.FilterMode?.Nearest ?? 0 : kit.FilterMode?.Linear ?? 1,
      kit.MipmapMode?.None ?? 0,
      projectiveShaderMatrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
    );
    const vertices = shader
      ? kit.MakeVertices(
        kit.VertexMode?.Triangles ?? 0,
        projectiveMesh.positions,
        projectiveShaderMatrix ? undefined : projectiveMesh.texCoords,
        undefined,
        projectiveMesh.indices,
        false,
      )
      : null;
    if (shader && vertices) {
      imagePaint.setShader(shader);
      canvas.drawVertices(vertices, blendMode ?? kit.BlendMode.SrcOver, imagePaint);
      vertices.delete();
      shader.delete();
    } else {
      canvas.drawImageRect(image, rects.source, rects.destination, imagePaint, fastSample);
    }
  } else {
    canvas.drawImageRect(image, rects.source, rects.destination, imagePaint, fastSample);
  }
  if (useCanvasClip) canvas.restore();
  imagePaint.delete();
  if (!resources || !cacheKey || !cacheable) image.delete();
  return { drawn: true, imageCacheHit, projectiveMeshCacheHit, uploaded };
}
