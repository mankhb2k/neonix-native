import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import { parseMotionComponentV2, parseMotionProjectV2 } from "../packages/motion-protocol/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const baselinePath = resolve(fixturesRoot, "acceptance", "web-parity-baseline.json");

/** One composition per product map — worker PNG checksum gate until Canvas screenshot parity ships. */
const SUBSET = [
  { id: "accept-process-trim", file: "accept-process-trim.mt.json", time: 1, width: 540, height: 540 },
  { id: "accept-ribbon-promo", file: "accept-ribbon-promo.mt.json", time: 1, width: 540, height: 540 },
  { id: "accept-look-at", file: "accept-look-at.mt.json", time: 1, width: 540, height: 540 },
  { id: "accept-secondary-wave", file: "accept-secondary-wave.mt.json", time: 1, width: 540, height: 540 },
] as const;

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const componentRoot = resolve(fixturesRoot, "components");
  const components = await Promise.all(
    (await readdir(componentRoot))
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseMotionComponentV2(JSON.parse(await readFile(resolve(componentRoot, file), "utf8")))),
  );

  const entries = [];
  for (const item of SUBSET) {
    const project = parseMotionProjectV2(
      JSON.parse(await readFile(resolve(fixturesRoot, "projects", item.file), "utf8")),
    );
    const runtime = compileMotionProject(project, { components });
    const png = await drawSceneFrame(
      runtime.scenes[0]!,
      runtime.metadata,
      runtime.assets,
      item.time,
      item.width,
      item.height,
      fixturesRoot,
    );
    entries.push({
      id: item.id,
      time: item.time,
      width: item.width,
      height: item.height,
      sha256: createHash("sha256").update(png).digest("hex"),
      nodeCount: runtime.scenes[0]!.nodes.length,
    });
  }

  const payload = {
    version: 1,
    note: "Worker PNG checksum baseline for acceptance subset. Browser Canvas pixel parity remains deferred; harness checks transform JSON.",
    entries,
  };

  if (write) {
    await mkdir(dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`WROTE acceptance/web-parity-baseline.json (${entries.length} entries)`);
    return;
  }

  const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as typeof payload;
  if (baseline.entries.length !== entries.length) {
    throw new Error(`Web parity baseline size mismatch: ${baseline.entries.length} vs ${entries.length}`);
  }
  for (let index = 0; index < entries.length; index += 1) {
    const actual = entries[index]!;
    const expected = baseline.entries[index]!;
    if (actual.id !== expected.id || actual.sha256 !== expected.sha256) {
      throw new Error(`Web parity baseline drift for ${actual.id}`);
    }
  }
  console.log(`OK acceptance web-parity baseline ${entries.length} worker frames`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
