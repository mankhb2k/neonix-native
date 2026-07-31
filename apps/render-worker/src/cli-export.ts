import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMotionComponentV2,
  parseMotionProject,
  serializeMotionProject,
  type MotionComponentV2,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import { compileMotionProject } from "./compiler";
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

async function loadFixtureComponents(): Promise<MotionComponentV2[]> {
  const componentRoot = path.join(REPO_ROOT, "docs", "fixtures", "v2", "components");
  try {
    const files = (await readdir(componentRoot)).filter((file) => file.endsWith(".json"));
    return Promise.all(
      files.map(async (file) =>
        parseMotionComponentV2(JSON.parse(await readFile(path.join(componentRoot, file), "utf8"))),
      ),
    );
  } catch {
    return [];
  }
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
 * - MOTIONVIDEO_EXPORT_ASSET_BASE — assetBaseDir (default docs/fixtures/v2)
 * - MOTIONVIDEO_EXPORT_MP4_PATH — copy final MP4 here after encode
 *
 * Prints JSON { ok, mp4Path, projectId } to stdout.
 */
async function main() {
  const raw = await readInput();
  emitProgress("planning", 0.2);
  const project = parseMotionProject(raw);
  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    const detail = presetCheck.unknown
      .map((u) => `${u.sceneId}/${u.nodeId}:${u.preset}`)
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

  await mkdir(outDir, { recursive: true });
  const mtPath = path.join(outDir, `${project.metadata.id}.mt`);
  await writeFile(mtPath, serializeMotionProject(project), "utf8");

  const components = await loadFixtureComponents();
  const compiled = compileMotionProject(project, { components });

  emitProgress("rendering", 0.45);
  const rendered = await renderCompiledProject(compiled, {
    fps: 24,
    scale: 0.5,
    outDir: path.join(outDir, "frames", project.metadata.id),
    assetBaseDir,
  });

  emitProgress("encoding", 0.75);
  const files = await encodeOutputs(
    rendered,
    project.metadata.aspectRatio,
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
    `${JSON.stringify({ ok: true, mp4Path, projectId: project.metadata.id, mtPath })}\n`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
});
