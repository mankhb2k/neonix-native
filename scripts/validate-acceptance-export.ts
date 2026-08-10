import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { parseMotionProjectV2 } from "../packages/motion-protocol/src/compat/parse-v2";
import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import {
  encodeOutputs,
  resolveFfmpegPath,
} from "../apps/render-worker/src/ffmpeg/index";
import { renderCompiledProject } from "../apps/render-worker/src/runtime/index";
import { parseMotionComponentV2 } from "../packages/motion-protocol/src/compat/parse-v2";
import { readdir } from "node:fs/promises";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");

function probe(file: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(resolveFfmpegPath(), ["-i", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", () => resolvePromise(stderr));
    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  const scorecard = JSON.parse(
    await readFile(
      resolve(fixturesRoot, "acceptance", "scorecard.json"),
      "utf8",
    ),
  ) as {
    compositions: Array<{ id: string; project: string }>;
  };
  const seedId = "accept-ribbon-promo";
  const entry = scorecard.compositions.find((item) => item.id === seedId);
  if (!entry) throw new Error(`Missing seed composition ${seedId}`);

  const componentRoot = resolve(fixturesRoot, "components");
  const components = await Promise.all(
    (await readdir(componentRoot))
      .filter((file) => file.endsWith(".json"))
      .map(async (file) =>
        parseMotionComponentV2(
          JSON.parse(await readFile(resolve(componentRoot, file), "utf8")),
        ),
      ),
  );

  const project = parseMotionProjectV2(
    JSON.parse(await readFile(resolve(fixturesRoot, entry.project), "utf8")),
  );
  const compiled = compileMotionProject(project, { components });
  const outId = `accept_export_${Date.now()}`;
  const rendered = await renderCompiledProject(compiled, {
    fps: 12,
    scale: 0.5,
    outDir: resolve(repoRoot, "tmp", "frames", outId),
    assetBaseDir: fixturesRoot,
  });
  const files = await encodeOutputs(
    rendered,
    project.metadata.aspectRatio,
    compiled,
    fixturesRoot,
  );
  const mp4 = files[0]?.path;
  if (!mp4) throw new Error("Acceptance export produced no MP4");
  const info = await stat(mp4);
  const probeOut = await probe(mp4);
  if (!/Video:\s*/.test(probeOut))
    throw new Error("Acceptance MP4 missing video stream");
  await mkdir(resolve(repoRoot, "tmp"), { recursive: true });
  await writeFile(
    resolve(repoRoot, "tmp", `${outId}.probe.txt`),
    probeOut,
    "utf8",
  );
  console.log(`OK acceptance export ${seedId} → ${mp4} (${info.size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
