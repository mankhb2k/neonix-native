import { mkdir, readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { encodeOutputs } from "./ffmpeg";
import {
  renderRuntimeProjectV2,
  runtimeProjectV2Aspect,
} from "./runtime/render-v2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function emitProgress(stage: string, ratio: number): void {
  process.stderr.write(`progress\t${stage}\t${ratio}\n`);
}

async function readInput(): Promise<unknown> {
  const argPath = process.argv[2];
  if (argPath) return JSON.parse(await readFile(argPath, "utf8")) as unknown;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("No Protocol V2 JSON on stdin or argv path");
  return JSON.parse(text) as unknown;
}

/** Protocol V2 JSON -> Runtime IR V2 -> PNG sequence -> MP4. */
async function main(): Promise<void> {
  const raw = await readInput();
  emitProgress("planning", 0.05);
  const project = MotionProtocolV2Schema.parse(raw);
  const runtime = compileProtocolV2(project);
  const outDir = process.env.MOTIONVIDEO_EXPORT_OUT_DIR
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_OUT_DIR)
    : path.join(REPO_ROOT, "tmp");
  const finalMp4Path = process.env.MOTIONVIDEO_EXPORT_MP4_PATH
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_MP4_PATH)
    : undefined;
  const fpsEnv = Number(process.env.MOTIONVIDEO_EXPORT_FPS);
  const fps = Number.isFinite(fpsEnv) && fpsEnv > 0 ? fpsEnv : runtime.composition.fps;
  const frameDir = path.join(outDir, "frames", runtime.id);

  await mkdir(outDir, { recursive: true });
  emitProgress("rendering", 0.1);
  const rendered = await renderRuntimeProjectV2(runtime, {
    fps,
    outDir: frameDir,
    onProgress: (ratio) => emitProgress("rendering", 0.1 + ratio * 0.65),
  });

  emitProgress("encoding", 0.8);
  const files = await encodeOutputs(rendered, runtimeProjectV2Aspect(runtime));
  let mp4Path = files[0]?.path;
  if (!mp4Path) throw new Error("Encode produced no file");
  if (finalMp4Path) {
    await mkdir(path.dirname(finalMp4Path), { recursive: true });
    await copyFile(mp4Path, finalMp4Path);
    mp4Path = finalMp4Path;
  }

  emitProgress("done", 1);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mp4Path,
    projectId: runtime.id,
    runtimeFormat: "motion-runtime",
    runtimeVersion: 2,
  })}\n`);
}

main().catch((error: unknown) => {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exit(1);
});
