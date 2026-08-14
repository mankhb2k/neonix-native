/**
 * CLI: render PNG contact-sheet frames for AI critic (P0.4 / zero-template).
 * Usage: tsx src/cli-contact-sheet.ts <project.mt.json> [outDir]
 * Prints JSON { ok, frames: [{ time, path }] } on last line.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import { parseMotionProject } from "@motionvideo/motion-protocol";
import { layerGraphFromRuntime } from "@motionvideo/motion-runtime";
import { drawSceneFrame } from "./runtime/draw";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Derive a contact-sheet preview size from composition dimensions.
 * Caps at 640px on the longest edge.
 */
function contactSheetSize(composition: { width: number; height: number }): {
  width: number;
  height: number;
} {
  const maxDim = Math.max(composition.width, composition.height);
  if (maxDim <= 640)
    return { width: composition.width, height: composition.height };
  const scale = 640 / maxDim;
  return {
    width: Math.round(composition.width * scale),
    height: Math.round(composition.height * scale),
  };
}

async function main(): Promise<void> {
  const mtPath = process.argv[2];
  if (!mtPath) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "Usage: cli-contact-sheet <project.mt.json> [outDir]",
      }),
    );
    process.exitCode = 1;
    return;
  }
  const outDir = resolve(
    process.argv[3] ??
      resolve(REPO_ROOT, "tmp", "ai-contact-sheets", String(Date.now())),
  );
  await mkdir(outDir, { recursive: true });

  const project = parseMotionProject(
    JSON.parse(await readFile(resolve(mtPath), "utf8")),
  );
  const result = compileMotionProjectV1(project);
  if (!result.ok) {
    console.log(
      JSON.stringify({
        ok: false,
        error: result.diagnostics.map((d) => d.message).join("; "),
      }),
    );
    process.exitCode = 1;
    return;
  }
  const runtime = result.project;
  const scene = layerGraphFromRuntime(runtime);
  if (scene.layers.length === 0 && !(scene.duration > 0)) {
    console.log(JSON.stringify({ ok: false, error: "No layers" }));
    process.exitCode = 1;
    return;
  }

  const { width, height } = contactSheetSize(project.composition);
  const fps = project.composition.fps;
  const fractions = [0, 0.1, 0.5, 0.85, Math.max(0, 1 - 1 / Math.max(1, fps))];
  const frames: Array<{ time: number; path: string }> = [];

  for (const fraction of fractions) {
    const time = Math.min(
      scene.duration - 1e-4,
      Math.max(0, scene.duration * fraction),
    );
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

  console.log(JSON.stringify({ ok: true, outDir, frames, graphId: scene.id }));
}

main().catch((error: unknown) => {
  console.log(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
