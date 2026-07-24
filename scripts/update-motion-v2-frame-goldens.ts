import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import { parseMotionProjectV2 } from "../packages/motion-schema/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outputRoot = resolve(fixturesRoot, "expected-frames");

export const HIERARCHY_FRAME_GOLDENS = [
  { time: 0, file: "hierarchy-transform-t0.png" },
  { time: 1, file: "hierarchy-transform-t1.png" },
  { time: 1.5, file: "hierarchy-transform-t1_5.png" },
] as const;

async function main(): Promise<void> {
  const source = parseMotionProjectV2(JSON.parse(await readFile(resolve(fixturesRoot, "projects", "hierarchy-transform.mt.json"), "utf8")));
  const runtime = compileMotionProject(source);
  const scene = runtime.scenes[0]!;
  await mkdir(outputRoot, { recursive: true });
  for (const golden of HIERARCHY_FRAME_GOLDENS) {
    const png = drawSceneFrame(scene, runtime.metadata, runtime.assets, golden.time, 270, 480, fixturesRoot);
    await writeFile(resolve(outputRoot, golden.file), png);
    console.log(`WROTE expected-frames/${golden.file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
