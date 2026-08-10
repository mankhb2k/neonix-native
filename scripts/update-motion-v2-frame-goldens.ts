import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import { parseMotionComponentV2, parseMotionProjectV2 } from "../packages/motion-protocol/src/index";

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
  { project: "motion-path.mt.json", time: 0, file: "motion-path-t0.png", width: 540, height: 540 },
  { project: "motion-path.mt.json", time: 1, file: "motion-path-t1.png", width: 540, height: 540 },
  { project: "motion-path.mt.json", time: 2, file: "motion-path-t2.png", width: 540, height: 540 },
  { project: "effects-stack.mt.json", time: 0.5, file: "effects-stack-t0_5.png", width: 540, height: 540 },
  { project: "path-morph.mt.json", time: 0, file: "path-morph-t0.png", width: 540, height: 540 },
  { project: "path-morph.mt.json", time: 1, file: "path-morph-t1.png", width: 540, height: 540 },
  { project: "path-morph.mt.json", time: 2, file: "path-morph-t2.png", width: 540, height: 540 },
  { project: "bone-secondary-motion.mt.json", time: 0.5, file: "bone-secondary-motion-t0_5.png", width: 540, height: 540 },
  { project: "bone-secondary-motion.mt.json", time: 1.5, file: "bone-secondary-motion-t1_5.png", width: 540, height: 540 },
  { project: "camera-transition.mt.json", time: 0, file: "camera-transition-t0.png", width: 540, height: 540 },
  { project: "camera-transition.mt.json", time: 1.5, file: "camera-transition-t1_5.png", width: 540, height: 540 },
  { project: "trim-path-reveal.mt.json", time: 1, file: "trim-path-reveal-t1.png", width: 540, height: 540 },
  { project: "blend-mode-glow.mt.json", time: 1, file: "blend-mode-glow-t1.png", width: 540, height: 540 },
  { project: "path-bend-ribbon.mt.json", time: 1, file: "path-bend-ribbon-t1.png", width: 540, height: 540 },
  { project: "accept-process-trim.mt.json", time: 1, file: "accept-process-trim-t1.png", width: 540, height: 540 },
  { project: "accept-bignumber-paint.mt.json", time: 1, file: "accept-bignumber-paint-t1.png", width: 540, height: 540 },
  { project: "accept-compare-blend.mt.json", time: 1, file: "accept-compare-blend-t1.png", width: 540, height: 540 },
  { project: "accept-tvc-hook.mt.json", time: 1, file: "accept-tvc-hook-t1.png", width: 270, height: 480 },
  { project: "accept-showcase-lookat.mt.json", time: 1, file: "accept-showcase-lookat-t1.png", width: 540, height: 540 },
  { project: "accept-ribbon-promo.mt.json", time: 1, file: "accept-ribbon-promo-t1.png", width: 540, height: 540 },
  { project: "accept-cutout-talk.mt.json", time: 1, file: "accept-cutout-talk-t1.png", width: 540, height: 540 },
  { project: "accept-prop-mask.mt.json", time: 1, file: "accept-prop-mask-t1.png", width: 270, height: 480 },
  { project: "accept-look-at.mt.json", time: 1, file: "accept-look-at-t1.png", width: 540, height: 540 },
  { project: "accept-secondary-wave.mt.json", time: 1, file: "accept-secondary-wave-t1.png", width: 540, height: 540 },
  { project: "accept-path-morph.mt.json", time: 1, file: "accept-path-morph-t1.png", width: 540, height: 540 },
  { project: "accept-action-loop.mt.json", time: 1, file: "accept-action-loop-t1.png", width: 540, height: 540 },
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
    const png = await drawSceneFrame(runtime.scenes[0]!, runtime.metadata, runtime.assets, golden.time, golden.width, golden.height, fixturesRoot);
    await writeFile(resolve(outputRoot, golden.file), png);
    console.log(`WROTE expected-frames/${golden.file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
