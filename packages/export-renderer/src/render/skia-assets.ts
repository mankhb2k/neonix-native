import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { Readable } from "node:stream";
import sharp from "sharp";
import type {
  PaintCommand,
  PaintCommandBuffer,
  RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import type { SkiaAsset } from "@motionvideo/skia-renderer";
import { ExportRendererError } from "../errors";

type MediaCommand = Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>;

export type SkiaAssetResolverOptions = {
  /** The app's `public` directory, for example `apps/web/public`. */
  assetRoot: string;
  ffmpegPath: string;
  /** Input-side seek is substantially faster for non-sequential access. */
  videoSeekMode?: "fast" | "accurate";
  /** Maximum number of raw and resized video frames retained per resolver. */
  maxVideoCacheEntries?: number;
};

export type SkiaAssetResolverStats = {
  imageCacheHits: number;
  imageCacheMisses: number;
  videoCacheHits: number;
  videoCacheMisses: number;
  videoDecodeCount: number;
  videoDecodeMilliseconds: number;
  videoResizeCount: number;
  videoResizeMilliseconds: number;
  resolveCount: number;
  resolveMilliseconds: number;
  resolveSamplesMilliseconds: number[];
  videoCacheEntries: number;
  videoOutputCacheHits: number;
  videoOutputCacheMisses: number;
  videoOutputCacheEntries: number;
  videoDecoderSessionStarts: number;
  videoDecoderSessionResets: number;
  videoCacheEvictions: number;
  videoOutputCacheEvictions: number;
};

type DecodedImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

function pathInside(root: string, candidate: string): boolean {
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  const rel = relative(rootPath, candidatePath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Maps the preview app's URL namespace to local files. Keeping this mapping in
 * the server/export boundary means Runtime and PaintCommand stay URL-based and
 * browser-compatible.
 */
export function resolveLocalPreviewAssetPath(uri: string, assetRoot: string): string {
  let rawPath: string;
  try {
    rawPath = decodeURIComponent(uri.split(/[?#]/, 1)[0] ?? uri);
  } catch {
    throw new ExportRendererError(`Invalid media URI '${uri}'.`, "ASSET_NOT_FOUND", { uri });
  }
  if (rawPath.split(/[\\/]+/).some((segment) => segment === "..")) {
    throw new ExportRendererError(`Media URI escapes the configured asset root: '${uri}'.`, "ASSET_NOT_FOUND", { uri });
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(uri, "https://runtime.invalid").pathname);
  } catch {
    throw new ExportRendererError(`Invalid media URI '${uri}'.`, "ASSET_NOT_FOUND", { uri });
  }

  const relativePath = pathname === "/api/v1/docs/audio"
    ? "preview/audio/Music-MBB-Island-Tropical_128k.mp3"
    : pathname.replace(/^\/+/, "");
  const candidate = resolve(assetRoot, relativePath);
  if (!pathInside(assetRoot, candidate)) {
    throw new ExportRendererError(`Media URI escapes the configured asset root: '${uri}'.`, "ASSET_NOT_FOUND", { uri });
  }
  return candidate;
}

function mediaResourceUri(project: RuntimeProjectV3, command: MediaCommand): string | undefined {
  if (command.uri) return command.uri;
  if (command.op !== "drawVideo") return undefined;
  const media = project.mediaCatalog.assets.find((asset) => asset.mediaId === command.assetId);
  return media?.video?.[0]?.resource.uri;
}

function mediaVideoDimensions(project: RuntimeProjectV3, command: Extract<PaintCommand, { op: "drawVideo" }>): { width: number; height: number } {
  const stream = project.mediaCatalog.assets
    .find((asset) => asset.mediaId === command.assetId)
    ?.video?.[0];
  return {
    width: stream?.width ?? command.width,
    height: stream?.height ?? command.height,
  };
}

async function decodeImage(bytes: Uint8Array, uri: string, fallbackWidth: number, fallbackHeight: number): Promise<DecodedImage> {
  try {
    const image = sharp(bytes, { animated: false });
    const metadata = await image.metadata();
    // CanvasKit does not decode SVG resources directly. Sharp/libvips is only
    // used at this offline asset boundary to turn the resource into PNG; the
    // actual composition rasterization still happens in Skia.
    const isSvg = metadata.format === "svg" || /\.svg(?:$|[?#])/i.test(uri);
    const output = isSvg ? await image.png().toBuffer() : bytes;
    return {
      bytes: output,
      width: metadata.width ?? fallbackWidth,
      height: metadata.height ?? fallbackHeight,
    };
  } catch (error) {
    throw new ExportRendererError(`Could not decode image '${uri}': ${String(error)}`, "ASSET_DECODE_FAILED", { uri });
  }
}

async function extractVideoFrame(
  ffmpegPath: string,
  filePath: string,
  mediaTime: number,
  seekMode: "fast" | "accurate",
): Promise<Uint8Array> {
  const seekArgs = seekMode === "fast"
    ? ["-accurate_seek", "-ss", String(Math.max(0, mediaTime)), "-i", filePath]
    : ["-i", filePath, "-ss", String(Math.max(0, mediaTime))];
  const args = [
    "-hide_banner", "-loglevel", "error", ...seekArgs,
    "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1",
  ];
  const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  const chunks: Buffer[] = [];
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const result = await new Promise<{ code: number; error?: Error }>((resolveResult) => {
    child.once("error", (error) => resolveResult({ code: 1, error }));
    child.once("close", (code) => resolveResult({ code: code ?? 1 }));
  });
  const bytes = Buffer.concat(chunks);
  if (result.code !== 0 || bytes.length === 0) {
    throw new ExportRendererError(
      `FFmpeg could not extract video frame at ${mediaTime}s from '${filePath}': ${result.error?.message ?? stderr.trim()}`,
      "ASSET_DECODE_FAILED",
      { filePath, mediaTime, stderr },
    );
  }
  return bytes;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from("IEND", "ascii");

/** Reads one complete PNG from FFmpeg's concatenated image2pipe stream. */
class PngStreamReader {
  private buffer = Buffer.alloc(0);
  private readonly iterator: AsyncIterator<Buffer>;

  constructor(private readonly stdout: NodeJS.ReadableStream) {
    this.iterator = stdout[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  }

  async next(): Promise<Uint8Array> {
    for (;;) {
      const frame = this.takeFrame();
      if (frame) return frame;
      const chunk = await this.iterator.next();
      if (chunk.done) throw new Error("FFmpeg ended before producing the requested sequential frame.");
      this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk.value)]);
    }
  }

  private takeFrame(): Uint8Array | undefined {
    const signatureAt = this.buffer.indexOf(PNG_SIGNATURE);
    if (signatureAt < 0) {
      this.buffer = this.buffer.subarray(Math.max(0, this.buffer.length - PNG_SIGNATURE.length + 1));
      return undefined;
    }
    if (signatureAt > 0) this.buffer = this.buffer.subarray(signatureAt);
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= this.buffer.length) {
      const length = this.buffer.readUInt32BE(offset);
      const end = offset + 12 + length;
      if (end > this.buffer.length) return undefined;
      if (this.buffer.subarray(offset + 4, offset + 8).equals(PNG_IEND)) {
        const frame = this.buffer.subarray(0, end);
        this.buffer = this.buffer.subarray(end);
        return frame;
      }
      offset = end;
    }
    return undefined;
  }
}

class FfmpegSequentialFrameDecoder {
  private readonly child: ChildProcessByStdio<null, Readable, Readable>;
  private readonly reader: PngStreamReader;

  constructor(ffmpegPath: string, filePath: string, mediaTime: number) {
    this.child = spawn(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-accurate_seek", "-ss", String(Math.max(0, mediaTime)),
      "-i", filePath, "-an", "-vsync", "0", "-f", "image2pipe", "-vcodec", "png", "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    this.reader = new PngStreamReader(this.child.stdout);
  }

  next(): Promise<Uint8Array> {
    return this.reader.next();
  }

  dispose(): void {
    this.child.stdout.destroy();
    this.child.stderr.destroy();
    this.child.kill();
  }
}

async function resizeVideoFrame(bytes: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  try {
    // PreviewStage intentionally rasterizes HTMLVideoElement frames to the
    // protocol-declared dimensions before handing them to CanvasKit. Match
    // that contract here; local MP4 fixtures can have a higher source
    // resolution than their Runtime media metadata.
    return await sharp(bytes)
      .resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), fit: "fill" })
      .png()
      .toBuffer();
  } catch (error) {
    throw new ExportRendererError(`Could not normalize video frame: ${String(error)}`, "ASSET_DECODE_FAILED", { width, height });
  }
}

export class SkiaFrameAssetResolver {
  private readonly imageCache = new Map<string, Promise<DecodedImage>>();
  private readonly videoFrameCache = new Map<string, Promise<Uint8Array>>();
  private readonly videoOutputCache = new Map<string, Promise<Uint8Array>>();
  private readonly maxVideoCacheEntries: number;
  private sequentialDecoder: {
    filePath: string;
    nextMediaTime: number;
    frameStep: number;
    decoder: FfmpegSequentialFrameDecoder;
  } | null = null;
  private sequentialCandidate: { filePath: string; lastMediaTime: number; frameStep: number } | null = null;
  private readonly stats: Omit<SkiaAssetResolverStats, "videoCacheEntries" | "videoOutputCacheEntries"> = {
    imageCacheHits: 0,
    imageCacheMisses: 0,
    videoCacheHits: 0,
    videoCacheMisses: 0,
    videoDecodeCount: 0,
    videoDecodeMilliseconds: 0,
    videoResizeCount: 0,
    videoResizeMilliseconds: 0,
    resolveCount: 0,
    resolveMilliseconds: 0,
    resolveSamplesMilliseconds: [],
    videoOutputCacheHits: 0,
    videoOutputCacheMisses: 0,
    videoDecoderSessionStarts: 0,
    videoDecoderSessionResets: 0,
    videoCacheEvictions: 0,
    videoOutputCacheEvictions: 0,
  };

  constructor(private readonly options: SkiaAssetResolverOptions) {
    const configured = options.maxVideoCacheEntries;
    this.maxVideoCacheEntries = Number.isFinite(configured) && configured !== undefined
      ? Math.max(1, Math.floor(configured))
      : 48;
  }

  getStats(): SkiaAssetResolverStats {
    return {
      ...this.stats,
      resolveSamplesMilliseconds: [...this.stats.resolveSamplesMilliseconds],
      videoCacheEntries: this.videoFrameCache.size,
      videoOutputCacheEntries: this.videoOutputCache.size,
    };
  }

  dispose(): void {
    this.sequentialDecoder?.decoder.dispose();
    this.sequentialDecoder = null;
    this.sequentialCandidate = null;
  }

  async resolveFrameAssets(project: RuntimeProjectV3, buffer: PaintCommandBuffer): Promise<ReadonlyMap<string, SkiaAsset>> {
    const startedAt = performance.now();
    const assets = new Map<string, SkiaAsset>();
    try {
      for (const command of buffer.commands) {
        if (command.op === "drawImage") {
          if (assets.has(command.assetId)) continue;
          const uri = mediaResourceUri(project, command);
          if (!uri) {
            throw new ExportRendererError(`Image asset '${command.assetId}' has no URI.`, "ASSET_NOT_FOUND", { assetId: command.assetId });
          }
          const filePath = resolveLocalPreviewAssetPath(uri, this.options.assetRoot);
          const hadImage = this.imageCache.has(filePath);
          if (hadImage) this.stats.imageCacheHits += 1;
          else this.stats.imageCacheMisses += 1;
          const image = await this.loadImage(filePath, uri, command.width, command.height);
          assets.set(command.assetId, {
            encoded: image.bytes,
            width: image.width,
            height: image.height,
            kind: "image",
          });
        } else if (command.op === "drawVideo") {
          const uri = mediaResourceUri(project, command);
          if (!uri) {
            throw new ExportRendererError(`Video asset '${command.assetId}' has no URI.`, "ASSET_NOT_FOUND", { assetId: command.assetId });
          }
          const filePath = resolveLocalPreviewAssetPath(uri, this.options.assetRoot);
          const key = `${filePath}\0${Math.max(0, command.mediaTime).toFixed(6)}`;
          let frame = this.getVideoCacheEntry(this.videoFrameCache, key);
          if (frame) {
            this.stats.videoCacheHits += 1;
          } else {
            this.stats.videoCacheMisses += 1;
            this.stats.videoDecodeCount += 1;
            const decodeStartedAt = performance.now();
            frame = this.loadVideoFrame(project, filePath, command.mediaTime).then(
              (bytes) => {
                this.stats.videoDecodeMilliseconds += performance.now() - decodeStartedAt;
                return bytes;
              },
              (error) => {
                this.stats.videoDecodeMilliseconds += performance.now() - decodeStartedAt;
                throw error;
              },
            );
            this.setVideoCacheEntry(this.videoFrameCache, key, frame, false);
          }
          const dimensions = mediaVideoDimensions(project, command);
          const outputKey = `${key}\0${dimensions.width}x${dimensions.height}`;
          let encoded = this.getVideoCacheEntry(this.videoOutputCache, outputKey);
          if (encoded) {
            this.stats.videoOutputCacheHits += 1;
          } else {
            this.stats.videoOutputCacheMisses += 1;
            encoded = frame.then(async (decodedFrame) => {
              const resizeStartedAt = performance.now();
              const resized = await resizeVideoFrame(decodedFrame, dimensions.width, dimensions.height);
              this.stats.videoResizeCount += 1;
              this.stats.videoResizeMilliseconds += performance.now() - resizeStartedAt;
              return resized;
            });
            this.setVideoCacheEntry(this.videoOutputCache, outputKey, encoded, true);
          }
          const encodedBytes = await encoded;
          assets.set(command.assetId, {
            encoded: encodedBytes,
            width: dimensions.width,
            height: dimensions.height,
            kind: "video",
          });
        }
      }
      return assets;
    } finally {
      const elapsed = performance.now() - startedAt;
      this.stats.resolveCount += 1;
      this.stats.resolveMilliseconds += elapsed;
      this.stats.resolveSamplesMilliseconds.push(elapsed);
    }
  }

  private async loadVideoFrame(project: RuntimeProjectV3, filePath: string, mediaTime: number): Promise<Uint8Array> {
    const seekMode = this.options.videoSeekMode ?? "fast";
    const stream = project.mediaCatalog.assets
      .find((asset) => asset.video?.some((candidate) => candidate.resource.uri))
      ?.video?.[0];
    const frameStep = stream && Number.isFinite(stream.frameRate) && stream.frameRate > 0
      ? 1 / stream.frameRate
      : 1 / 30;
    const canContinue = seekMode === "fast"
      && this.sequentialDecoder
      && this.sequentialDecoder.filePath === filePath
      && Math.abs(mediaTime - this.sequentialDecoder.nextMediaTime) <= Math.max(1e-4, frameStep / 10);
    const canStartSession = seekMode === "fast"
      && !this.sequentialDecoder
      && this.sequentialCandidate
      && this.sequentialCandidate.filePath === filePath
      && Math.abs(mediaTime - (this.sequentialCandidate.lastMediaTime + this.sequentialCandidate.frameStep))
        <= Math.max(1e-4, frameStep / 10);

    if (!canContinue) {
      if (this.sequentialDecoder) {
        this.stats.videoDecoderSessionResets += 1;
        this.sequentialDecoder.decoder.dispose();
        this.sequentialDecoder = null;
      }
      if (canStartSession) {
        const decoder = new FfmpegSequentialFrameDecoder(this.options.ffmpegPath, filePath, mediaTime);
        this.stats.videoDecoderSessionStarts += 1;
        this.sequentialDecoder = { filePath, nextMediaTime: mediaTime + frameStep, frameStep, decoder };
        this.sequentialCandidate = null;
        try {
          return await decoder.next();
        } catch (error) {
          decoder.dispose();
          this.sequentialDecoder = null;
          throw new ExportRendererError(
            `FFmpeg could not extract video frame at ${mediaTime}s from '${filePath}': ${String(error)}`,
            "ASSET_DECODE_FAILED",
            { filePath, mediaTime },
          );
        }
      }
      const frame = await extractVideoFrame(this.options.ffmpegPath, filePath, mediaTime, seekMode);
      this.sequentialCandidate = { filePath, lastMediaTime: mediaTime, frameStep };
      return frame;
    }

    const session = this.sequentialDecoder;
    if (!session) throw new Error("Sequential decoder session was lost.");
    const frame = await session.decoder.next();
    session.nextMediaTime = mediaTime + session.frameStep;
    this.sequentialCandidate = { filePath, lastMediaTime: mediaTime, frameStep: session.frameStep };
    return frame;
  }

  private getVideoCacheEntry<T>(cache: Map<string, T>, key: string): T | undefined {
    const value = cache.get(key);
    if (value !== undefined) {
      cache.delete(key);
      cache.set(key, value);
    }
    return value;
  }

  private setVideoCacheEntry<T>(cache: Map<string, T>, key: string, value: T, output: boolean): void {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > this.maxVideoCacheEntries) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      cache.delete(oldest);
      if (output) this.stats.videoOutputCacheEvictions += 1;
      else this.stats.videoCacheEvictions += 1;
    }
  }

  private loadImage(filePath: string, uri: string, fallbackWidth: number, fallbackHeight: number): Promise<DecodedImage> {
    let image = this.imageCache.get(filePath);
    if (!image) {
      image = readFile(filePath)
        .then((bytes) => decodeImage(bytes, uri, fallbackWidth, fallbackHeight))
        .catch((error) => {
          throw new ExportRendererError(`Could not read image '${uri}': ${String(error)}`, "ASSET_NOT_FOUND", { uri });
        });
      this.imageCache.set(filePath, image);
    }
    return image;
  }
}

export async function loadRuntimeFontAssets(project: RuntimeProjectV3, assetRoot: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const fonts = new Map<string, Uint8Array>();
  const pending = new Map<string, string>();
  for (const node of project.visual.nodes) {
    if (node.content.kind !== "text") continue;
    pending.set(node.content.fontAssetId, node.content.fontUri);
    for (const fallback of node.content.fontFallbacks ?? []) pending.set(fallback.assetId, fallback.uri);
  }
  for (const [assetId, uri] of pending) {
    const filePath = resolveLocalPreviewAssetPath(uri, assetRoot);
    try {
      fonts.set(assetId, await readFile(filePath));
    } catch (error) {
      throw new ExportRendererError(`Could not read font '${uri}': ${String(error)}`, "ASSET_NOT_FOUND", { assetId, uri });
    }
  }
  return fonts;
}
