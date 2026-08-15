import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMotionProject,
  serializeMotionProject,
} from "@motionvideo/motion-protocol";
import { validateMotionProjectPresets } from "@motionvideo/motion-compiler";
import { validateProjectAssetIntegrity } from "./runtime/asset-integrity";
import { compileProject } from "./compiler";
import { compositionAspectRatio } from "./aspect";
import { encodeOutputs } from "./ffmpeg";
import { renderCompiledProject } from "./runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Dev: monorepo root. Packaged CLI: prefer env / ignore fixtures when unset. */
const REPO_ROOT = process.env.MOTIONVIDEO_REPO_ROOT
  ? path.resolve(process.env.MOTIONVIDEO_REPO_ROOT)
  : path.resolve(__dirname, "../../..");

function emitProgress(stage: string, ratio: number): void {
  process.stderr.write(`progress\t${stage}\t${ratio}\n`);
}

async function readInput(): Promise<unknown> {
  const argPath = process.argv[2];
  if (argPath) {
    const raw = await readFile(argPath, "utf8");
    return JSON.parse(raw) as unknown;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("No project JSON on stdin or argv path");
  return JSON.parse(text) as unknown;
}

/**
 * CLI: motion JSON → MP4.
 * Usage: tsx src/cli-export.ts [path.mt]
 *        cat project.mt | tsx src/cli-export.ts
 *
 * Env (optional, backward compatible):
 * - MOTIONVIDEO_EXPORT_OUT_DIR — work dir (default repo tmp/)
 * - MOTIONVIDEO_EXPORT_ASSET_BASE — assetBaseDir (default docs/fixtures/assets)
 * - MOTIONVIDEO_EXPORT_MP4_PATH — copy final MP4 here after encode
 * - MOTIONVIDEO_EXPORT_FPS — render fps (default 24)
 * - MOTIONVIDEO_EXPORT_SCALE — scale vs FHD (default 0.5; 2 = 4K for 16:9/9:16)
 * - MOTIONVIDEO_PAINT_PATH — 1|true to use shared paint-command canvas path
 *
 * Prints JSON { ok, mp4Path, projectId } to stdout.
 */
async function main() {
  const raw = await readInput();
  emitProgress("planning", 0.05);
  const project = parseMotionProject(raw);
  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    const detail = presetCheck.unknown
      .map((u) => `${u.layerId}:${u.preset}`)
      .join(", ");
    throw new Error(`Unknown animation presets: ${detail}`);
  }

  const fixturesRoot = path.join(REPO_ROOT, "docs", "fixtures", "v2");
  const outDir = process.env.MOTIONVIDEO_EXPORT_OUT_DIR
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_OUT_DIR)
    : path.join(REPO_ROOT, "tmp");
  const assetBaseDir = process.env.MOTIONVIDEO_EXPORT_ASSET_BASE
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_ASSET_BASE)
    : fixturesRoot;
  const finalMp4Path = process.env.MOTIONVIDEO_EXPORT_MP4_PATH
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_MP4_PATH)
    : undefined;
  const fpsEnv = Number(process.env.MOTIONVIDEO_EXPORT_FPS);
  const scaleEnv = Number(process.env.MOTIONVIDEO_EXPORT_SCALE);
  const fps =
    Number.isFinite(fpsEnv) && fpsEnv > 0
      ? fpsEnv
      : (project.composition.fps ?? 24);
  const scale = Number.isFinite(scaleEnv) && scaleEnv > 0 ? scaleEnv : 0.5;

  const integrity = await validateProjectAssetIntegrity(project, assetBaseDir);
  if (!integrity.ok) {
    throw new Error(`Asset integrity failed: ${integrity.errors.join("; ")}`);
  }

  await mkdir(outDir, { recursive: true });
  const mtPath = path.join(outDir, `${project.metadata.id}.mt`);
  await writeFile(mtPath, serializeMotionProject(project), "utf8");

  const components = [];
  const compiled = compileProject(project);

  emitProgress("rendering", 0.1);
  const rendered = await renderCompiledProject(compiled, {
    fps,
    scale,
    outDir: path.join(outDir, "frames", project.metadata.id),
    assetBaseDir,
    onProgress: (ratio) => {
      emitProgress("rendering", 0.1 + ratio * 0.65);
    },
  });

  emitProgress("encoding", 0.8);
  const files = await encodeOutputs(
    rendered,
    compositionAspectRatio(project),
    compiled,
    assetBaseDir,
  );
  let mp4Path = files[0]?.path;
  if (!mp4Path) throw new Error("Encode produced no file");

  if (finalMp4Path) {
    await mkdir(path.dirname(finalMp4Path), { recursive: true });
    await copyFile(mp4Path, finalMp4Path);
    mp4Path = finalMp4Path;
  }

  emitProgress("done", 1);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      mp4Path,
      projectId: project.metadata.id,
      mtPath,
      paintPath: (process.env.MOTIONVIDEO_PAINT_PATH ?? "").length > 0,
      assetIntegrityChecked: integrity.checked,
    })}\n`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
});
