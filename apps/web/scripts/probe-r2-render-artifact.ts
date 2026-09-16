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

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const jobId = requiredEnv("PHASE7_PROBE_JOB_ID");
  const key = requiredEnv("PHASE7_PROBE_R2_KEY");
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = process.env.R2_USER_EXPORTS_BUCKET?.trim() || requiredEnv("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY") },
  });
  const outputRoot = resolve(process.cwd(), `../../tmp/phase7/${jobId}`);
  const filePath = join(outputRoot, "remote-final.mp4");
  await mkdir(outputRoot, { recursive: true });
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) throw new Error(`R2 object has no body: ${key}`);
    await pipeline(object.Body as NodeJS.ReadableStream, createWriteStream(filePath));
    const bytes = (await readFile(filePath)).byteLength;
    const checksum = createHash("sha256").update(await readFile(filePath)).digest("hex");
    const probe = await execFile(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
      "-v", "error", "-count_frames", "-show_entries",
      "stream=index,codec_type,codec_name,width,height,avg_frame_rate,nb_read_frames,sample_rate,channels,duration:format=duration,size",
      "-of", "json", filePath,
    ]);
    const report = { generatedAt: new Date().toISOString(), jobId, bucket, key, localPath: filePath, bytes, checksum, ffprobe: JSON.parse(probe.stdout) };
    await import("node:fs/promises").then(({ writeFile }) => writeFile(join(outputRoot, "remote-final-probe.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.destroy();
  }
}

void main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
