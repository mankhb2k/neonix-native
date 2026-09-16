import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { execFile as nodeExecFile } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const execFile = promisify(nodeExecFile);
const outputRoot = resolve(process.cwd(), "../../tmp/phase6/determinism");
const keys = {
  p2: "phase5-e2e/rnd_phase5_mu25ik79.mp4",
  p4: "phase5-e2e/rnd_phase5_mu24wv9p.mp4",
  p8: "phase5-e2e/rnd_phase5_mu25obhm.mp4",
  p4Threads1A: "phase5-e2e/rnd_phase5_mu26cmje.mp4",
  p4Threads1B: "phase5-e2e/rnd_phase5_mu26h2kg.mp4",
} as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function createClient(): { client: S3Client; bucket: string } {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return {
    bucket: process.env.R2_USER_EXPORTS_BUCKET?.trim() || requiredEnv("R2_BUCKET"),
    client: new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY") },
    }),
  };
}

async function download(client: S3Client, bucket: string, key: string, target: string): Promise<void> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) throw new Error(`Missing R2 body: ${key}`);
  await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(target));
}

async function decodedFrameDigest(filePath: string): Promise<string> {
  const result = await execFile(process.env.FFMPEG_PATH?.trim() || "ffmpeg", [
    "-v", "error", "-i", filePath, "-map", "0:v:0", "-an", "-vsync", "0", "-f", "framemd5", "-",
  ], { maxBuffer: 4 * 1024 * 1024 });
  return createHash("sha256").update(result.stdout).digest("hex");
}

async function probe(filePath: string): Promise<Record<string, unknown>> {
  const result = await execFile(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error", "-count_frames", "-show_entries", "stream=codec_type,codec_name,nb_read_frames,duration:format=duration:format_tags", "-of", "json", filePath,
  ]);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  await mkdir(outputRoot, { recursive: true });
  const { client, bucket } = createClient();
  const result: Record<string, unknown> = { schemaVersion: 1, bucket, outputs: {} };
  try {
    for (const [label, key] of Object.entries(keys)) {
      const filePath = join(outputRoot, `${label}.mp4`);
      await download(client, bucket, key, filePath);
      const bytes = (await readFile(filePath)).byteLength;
      const byteChecksum = createHash("sha256").update(await readFile(filePath)).digest("hex");
      const frameChecksum = await decodedFrameDigest(filePath);
      const metadata = await probe(filePath);
      result.outputs = { ...(result.outputs as object), [label]: { key, bytes, byteChecksum, frameChecksum, metadata } };
    }
  } finally {
    client.destroy();
  }
  const outputs = result.outputs as Record<string, { byteChecksum: string; frameChecksum: string }>;
  result.byteDeterministic = new Set(Object.values(outputs).map((output) => output.byteChecksum)).size === 1;
  result.frameDeterministic = new Set(Object.values(outputs).map((output) => output.frameChecksum)).size === 1;
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
