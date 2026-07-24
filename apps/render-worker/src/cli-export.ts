import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMotionProject,
  serializeMotionProject,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import { compileMotionProject } from "./compiler";
import { encodeOutputs } from "./ffmpeg";
import { renderCompiledProject } from "./runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

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
 * Prints JSON { ok, mp4Path, projectId } to stdout.
 */
async function main() {
  const raw = await readInput();
  const project = parseMotionProject(raw);
  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    const detail = presetCheck.unknown
      .map((u) => `${u.sceneId}/${u.nodeId}:${u.preset}`)
      .join(", ");
    throw new Error(`Unknown animation presets: ${detail}`);
  }

  const outDir = path.join(REPO_ROOT, "tmp");
  await mkdir(outDir, { recursive: true });
  const mtPath = path.join(outDir, `${project.metadata.id}.mt`);
  await writeFile(mtPath, serializeMotionProject(project), "utf8");

  const compiled = compileMotionProject(project);
  const rendered = await renderCompiledProject(compiled, {
    fps: 24,
    scale: 0.5,
    outDir: path.join(outDir, "frames", project.metadata.id),
  });
  const files = await encodeOutputs(rendered, project.metadata.aspectRatio, compiled);
  const mp4Path = files[0]?.path;
  if (!mp4Path) throw new Error("Encode produced no file");

  process.stdout.write(
    `${JSON.stringify({ ok: true, mp4Path, projectId: project.metadata.id, mtPath })}\n`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
});
