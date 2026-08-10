/**
 * CLI: render PNG contact-sheet frames for AI critic (P0.4 / zero-template).
 * Usage: tsx src/cli-contact-sheet.ts <project.mt.json> [outDir]
 * Prints JSON { ok, frames: [{ time, path }] } on last line.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { parseMotionProjectV2 } from "@motionvideo/motion-protocol";
import { drawSceneFrame } from "./runtime/draw";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function stageSize(aspect: string): { width: number; height: number } {
  if (aspect === "16:9") return { width: 640, height: 360 };
  if (aspect === "1:1") return { width: 480, height: 480 };
  return { width: 360, height: 640 };
}

async function main(): Promise<void> {
  const mtPath = process.argv[2];
  if (!mtPath) {
    console.log(JSON.stringify({ ok: false, error: "Usage: cli-contact-sheet <project.mt.json> [outDir]" }));
    process.exitCode = 1;
    return;
  }
  const outDir = resolve(process.argv[3] ?? resolve(REPO_ROOT, "tmp", "ai-contact-sheets", String(Date.now())));
  await mkdir(outDir, { recursive: true });

  const project = parseMotionProjectV2(JSON.parse(await readFile(resolve(mtPath), "utf8")));
  const runtime = compileMotionProject(project);
  const scene = runtime.scenes[0];
  if (!scene) {
    console.log(JSON.stringify({ ok: false, error: "No scenes" }));
    process.exitCode = 1;
    return;
  }

  const { width, height } = stageSize(project.metadata.aspectRatio);
  const fractions = [0, 0.1, 0.5, 0.85, Math.max(0, 1 - 1 / Math.max(1, project.metadata.fps))];
  const frames: Array<{ time: number; path: string }> = [];

  for (const fraction of fractions) {
    const time = Math.min(scene.duration - 1e-4, Math.max(0, scene.duration * fraction));
    const png = await drawSceneFrame(
      scene,
      runtime.metadata,
      runtime.assets,
      time,
      width,
      height,
      REPO_ROOT,
    );
    const file = resolve(outDir, `t${time.toFixed(3).replace(".", "_")}.png`);
    await writeFile(file, png);
    frames.push({ time, path: file });
  }

  console.log(JSON.stringify({ ok: true, outDir, frames, sceneId: scene.id }));
}

main().catch((error: unknown) => {
  console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
