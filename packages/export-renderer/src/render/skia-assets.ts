import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
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

  const relativePath = pathname === "/api/docs/audio"
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

async function extractVideoFrame(ffmpegPath: string, filePath: string, mediaTime: number): Promise<Uint8Array> {
  const args = [
    "-hide_banner", "-loglevel", "error", "-i", filePath, "-ss", String(Math.max(0, mediaTime)),
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

  constructor(private readonly options: SkiaAssetResolverOptions) {}

  async resolveFrameAssets(project: RuntimeProjectV3, buffer: PaintCommandBuffer): Promise<ReadonlyMap<string, SkiaAsset>> {
    const assets = new Map<string, SkiaAsset>();
    for (const command of buffer.commands) {
      if (command.op === "drawImage") {
        if (assets.has(command.assetId)) continue;
        const uri = mediaResourceUri(project, command);
        if (!uri) {
          throw new ExportRendererError(`Image asset '${command.assetId}' has no URI.`, "ASSET_NOT_FOUND", { assetId: command.assetId });
        }
        const filePath = resolveLocalPreviewAssetPath(uri, this.options.assetRoot);
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
        let frame = this.videoFrameCache.get(key);
        if (!frame) {
          frame = extractVideoFrame(this.options.ffmpegPath, filePath, command.mediaTime);
          this.videoFrameCache.set(key, frame);
        }
        const dimensions = mediaVideoDimensions(project, command);
        assets.set(command.assetId, {
          encoded: await resizeVideoFrame(await frame, dimensions.width, dimensions.height),
          width: dimensions.width,
          height: dimensions.height,
          kind: "video",
        });
      }
    }
    return assets;
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
