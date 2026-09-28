import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { Readable } from "node:stream";
import { ExportRendererError } from "../errors";

type AudioSourceMaterializer = {
  resolve(uri: string): Promise<string>;
  cleanup(): Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ExportRendererError(`Missing ${name} for R2 audio source '${name}'.`, "ASSET_NOT_FOUND");
  return value;
}

function isRemoteAudioUri(uri: string): boolean {
  return uri.startsWith("r2://") || uri.startsWith("s3://");
}

function r2Key(uri: string, bucket: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new ExportRendererError(`Invalid remote audio URI '${uri}'.`, "ASSET_NOT_FOUND", { uri });
  }
  const host = decodeURIComponent(parsed.hostname);
  const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const key = host && host !== bucket ? `${host}/${path}` : path;
  if (!key || key.split("/").some((part) => part === "..")) {
    throw new ExportRendererError(`Invalid R2 audio object key '${key}'.`, "ASSET_NOT_FOUND", { uri });
  }
  return key;
}

function extensionFor(uri: string, contentType?: string): string {
  const extension = extname(new URL(uri).pathname);
  if (extension && extension.length <= 8) return extension;
  if (contentType?.includes("mpeg")) return ".mp3";
  if (contentType?.includes("mp4")) return ".m4a";
  if (contentType?.includes("wav")) return ".wav";
  return ".audio";
}

async function writeRemoteBody(body: unknown, path: string): Promise<void> {
  if (!body) throw new Error("R2 returned an empty object body.");
  if (typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") {
    const stream = (body as { transformToWebStream(): ReadableStream<Uint8Array> }).transformToWebStream();
    await pipeline(Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(path));
    return;
  }
  await pipeline(Readable.from(body as AsyncIterable<Uint8Array>), createWriteStream(path));
}

export function createAudioSourceMaterializer(assetRoot: string): AudioSourceMaterializer {
  const bucket = process.env.R2_USER_ASSETS_BUCKET?.trim() || process.env.R2_BUCKET?.trim();
  let client: S3Client | undefined;
  const getClient = (): S3Client => {
    if (!bucket) throw new ExportRendererError("R2 is not configured for remote audio.", "ASSET_NOT_FOUND");
    client ??= new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
    return client;
  };
  const cache = new Map<string, Promise<string>>();
  let directoryPromise: Promise<string> | undefined;

  const directory = async (): Promise<string> => {
    directoryPromise ??= mkdtemp(join(tmpdir(), "neonix-audio-"));
    return directoryPromise;
  };

  return {
    async resolve(uri) {
      if (!isRemoteAudioUri(uri)) {
        const { resolveLocalPreviewAssetPath } = await import("./skia-assets");
        return resolveLocalPreviewAssetPath(uri, assetRoot);
      }
      if (!bucket) throw new ExportRendererError(`R2 is not configured for audio URI '${uri}'.`, "ASSET_NOT_FOUND", { uri });
      const existing = cache.get(uri);
      if (existing) return existing;
      const pending = (async () => {
        const key = r2Key(uri, bucket);
        const result = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const targetDirectory = await directory();
        const target = join(targetDirectory, `${cache.size}-${basename(key) || `audio${extensionFor(uri, result.ContentType)}`}`);
        await mkdir(targetDirectory, { recursive: true });
        await writeRemoteBody(result.Body, target);
        return target;
      })();
      cache.set(uri, pending);
      return pending;
    },
    async cleanup() {
      if (directoryPromise) await directoryPromise.then((path) => rm(path, { recursive: true, force: true }));
      client?.destroy();
    },
  };
}
