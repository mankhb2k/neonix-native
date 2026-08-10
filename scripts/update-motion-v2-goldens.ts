import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { parseMotionComponentV2, parseMotionProjectV2 } from "../packages/motion-protocol/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outputRoot = resolve(fixturesRoot, "expected-runtime");

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(): Promise<void> {
  const componentRoot = resolve(fixturesRoot, "components");
  const components = await Promise.all(
    (await readdir(componentRoot))
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(async (file) => parseMotionComponentV2(await json(resolve(componentRoot, file)))),
  );
  const projectRoot = resolve(fixturesRoot, "projects");
  await mkdir(outputRoot, { recursive: true });
  for (const file of (await readdir(projectRoot)).filter((name) => name.endsWith(".json")).sort()) {
    const project = parseMotionProjectV2(await json(resolve(projectRoot, file)));
    const runtime = compileMotionProject(project, { components });
    const output = file.replace(/\.mt\.json$/, ".runtime.json");
    await writeFile(resolve(outputRoot, output), `${JSON.stringify(runtime, null, 2)}\n`, "utf8");
    console.log(`WROTE expected-runtime/${output}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
