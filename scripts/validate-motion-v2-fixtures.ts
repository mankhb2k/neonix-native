import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseMotionComponentV2,
  parseMotionProject,
  parseMotionProjectV2,
  MotionPatchV1Schema,
} from "../packages/motion-schema/src/index";
import { compileMotionProject } from "../apps/render-worker/src/compiler/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function validateDirectory(
  directory: "components" | "projects",
  parse: (input: unknown) => unknown,
): Promise<number> {
  const root = resolve(fixturesRoot, directory);
  const files = (await readdir(root)).filter((file) => file.endsWith(".json")).sort();
  for (const file of files) {
    parse(await readJson(resolve(root, file)));
    console.log(`OK ${directory}/${file}`);
  }
  return files.length;
}

async function main(): Promise<void> {
  const componentCount = await validateDirectory("components", parseMotionComponentV2);
  const projectCount = await validateDirectory("projects", parseMotionProjectV2);
  MotionPatchV1Schema.parse(await readJson(resolve(fixturesRoot, "patches", "ai-fill-big-number.json")));
  console.log(`OK patches/ai-fill-big-number.json`);

  const brokenComponent = await readJson(resolve(fixturesRoot, "components", "big-number.mvc.json")) as {
    nodes: Array<{ parentId: string | null }>;
  };
  brokenComponent.nodes[1].parentId = "missing-parent";
  let rejectedBrokenParent = false;
  try { parseMotionComponentV2(brokenComponent); } catch { rejectedBrokenParent = true; }
  if (!rejectedBrokenParent) throw new Error("Reference validator accepted a missing parent");
  console.log("OK negative/missing-parent rejected");

  const brokenProject = await readJson(resolve(fixturesRoot, "projects", "big-number-demo.mt.json")) as {
    dependencies: { components: unknown[] };
  };
  brokenProject.dependencies.components = [];
  let rejectedMissingDependency = false;
  try { parseMotionProjectV2(brokenProject); } catch { rejectedMissingDependency = true; }
  if (!rejectedMissingDependency) throw new Error("Reference validator accepted an unpinned component");
  console.log("OK negative/unpinned-component rejected");

  const componentFiles = (await readdir(resolve(fixturesRoot, "components"))).filter((file) => file.endsWith(".json"));
  const components = await Promise.all(componentFiles.map(async (file) => parseMotionComponentV2(await readJson(resolve(fixturesRoot, "components", file)))));
  const golden = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "golden-product-promo.mt.json")));
  const goldenRuntime = compileMotionProject(golden, { components });
  if (goldenRuntime.scenes.some((scene) => scene.nodes.some((node) => node.type === "component"))) {
    throw new Error("Compiler leaked a Component Node into Runtime IR");
  }
  console.log("OK compiler/golden components expanded");

  const demo = await readJson(resolve(fixturesRoot, "projects", "big-number-demo.mt.json")) as Record<string, unknown>;
  const timelineComponent = components.find((component) => component.componentId === "comp.timeline-steps");
  if (!timelineComponent) throw new Error("Timeline component fixture missing");
  const repeatProject = structuredClone(demo) as {
    dependencies: { components: Array<Record<string, unknown>> };
    scenes: Array<{ nodes: Array<{ type: string; payload?: Record<string, unknown> }> }>;
    bindings: unknown[];
  };
  repeatProject.dependencies.components = [{
    componentId: timelineComponent.componentId,
    version: timelineComponent.componentVersion,
    source: "registry.main",
    integrity: "sha256-fixture-timeline-steps-1.0.0",
  }];
  const instance = repeatProject.scenes[0]!.nodes.find((node) => node.type === "component")!;
  instance.payload = { componentId: timelineComponent.componentId, componentVersion: timelineComponent.componentVersion, props: {} };
  repeatProject.bindings = [];
  const repeatRuntime = compileMotionProject(parseMotionProjectV2(repeatProject), { components });
  const repeatedTitles = repeatRuntime.scenes[0]!.nodes.filter((node) => node.id.includes("step-title::"));
  if (repeatedTitles.length !== 3) throw new Error(`Expected 3 repeated step titles, got ${repeatedTitles.length}`);
  console.log("OK compiler/repeater expanded 3 items");

  const migrated = parseMotionProject({
    version: 1,
    id: "legacy.test",
    locale: "vi-VN",
    aspectRatio: "9:16",
    brand: { name: "Legacy" },
    scenes: [{ id: "legacy.scene", role: "hook", duration: 1, layers: [{ id: "legacy.text", type: "text", content: "Xin chào", x: 0, y: 0, animations: [] }] }],
  });
  if (migrated.formatVersion !== 2 || migrated.scenes[0]?.nodes[0]?.type !== "text") throw new Error("V1 migration did not produce canonical v2");
  console.log("OK migration/v1 input canonicalized to v2");

  console.log(`Validated ${componentCount + projectCount + 1} Motion Format v2 fixtures.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
