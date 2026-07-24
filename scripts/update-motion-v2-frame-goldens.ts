import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import { parseMotionComponentV2, parseMotionProjectV2 } from "../packages/motion-schema/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outputRoot = resolve(fixturesRoot, "expected-frames");

export const FRAME_GOLDENS = [
  { project: "hierarchy-transform.mt.json", time: 0, file: "hierarchy-transform-t0.png", width: 270, height: 480 },
  { project: "hierarchy-transform.mt.json", time: 1, file: "hierarchy-transform-t1.png", width: 270, height: 480 },
  { project: "hierarchy-transform.mt.json", time: 1.5, file: "hierarchy-transform-t1_5.png", width: 270, height: 480 },
  { project: "geometry-paths.mt.json", time: 1, file: "geometry-paths-t1.png", width: 540, height: 540 },
  { project: "mask-compositing.mt.json", time: 0, file: "mask-compositing-t0.png", width: 540, height: 540 },
  { project: "repeater-layouts.mt.json", time: 1, file: "repeater-layouts-t1.png", width: 540, height: 540 },
  { project: "text-animator-unicode.mt.json", time: 1.5, file: "text-animator-unicode-t1_5.png", width: 540, height: 540 },
] as const;

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const componentRoot = resolve(fixturesRoot, "components");
  const components = await Promise.all((await readdir(componentRoot)).filter((file) => file.endsWith(".json")).map(async (file) => (
    parseMotionComponentV2(JSON.parse(await readFile(resolve(componentRoot, file), "utf8")))
  )));
  const runtimes = new Map<string, ReturnType<typeof compileMotionProject>>();
  for (const golden of FRAME_GOLDENS) {
    let runtime = runtimes.get(golden.project);
    if (!runtime) {
      const source = parseMotionProjectV2(JSON.parse(await readFile(resolve(fixturesRoot, "projects", golden.project), "utf8")));
      runtime = compileMotionProject(source, { components });
      runtimes.set(golden.project, runtime);
    }
    const png = drawSceneFrame(runtime.scenes[0]!, runtime.metadata, runtime.assets, golden.time, golden.width, golden.height, fixturesRoot);
    await writeFile(resolve(outputRoot, golden.file), png);
    console.log(`WROTE expected-frames/${golden.file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
