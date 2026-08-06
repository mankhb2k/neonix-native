import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AiArtifactParseError,
  parseCreativeBriefV1,
  parseCreativePlanV1,
  parseSceneDesignPlanV1,
} from "../packages/ai-planner/src/contracts/index.ts";
import { runGenerationLoop } from "../packages/ai-planner/src/generation-loop.ts";

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/fixtures/ai");

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(): Promise<void> {
  const positiveRoot = resolve(fixturesRoot, "positive");
  const negativeRoot = resolve(fixturesRoot, "negative");
  const positiveFiles = (await readdir(positiveRoot)).filter((file) => file.endsWith(".json")).sort();
  const negativeFiles = (await readdir(negativeRoot)).filter((file) => file.endsWith(".json")).sort();

  for (const file of positiveFiles) {
    const data = await readJson(resolve(positiveRoot, file));
    const format = (data as { format?: string }).format;
    if (format === "moticlip-creative-brief") parseCreativeBriefV1(data);
    else if (format === "moticlip-creative-plan") parseCreativePlanV1(data);
    else if (format === "moticlip-scene-design-plan") parseSceneDesignPlanV1(data);
    else throw new Error(`Unknown positive fixture format: ${file}`);
    console.log(`OK ai/positive/${file}`);
  }

  for (const file of negativeFiles) {
    const data = await readJson(resolve(negativeRoot, file));
    const format = (data as { format?: string }).format;
    let failed = false;
    try {
      if (format === "moticlip-creative-brief") parseCreativeBriefV1(data);
      else if (format === "moticlip-creative-plan") parseCreativePlanV1(data);
      else if (format === "moticlip-scene-design-plan") parseSceneDesignPlanV1(data);
      else throw new Error(`Unknown negative fixture format: ${file}`);
    } catch (error) {
      if (error instanceof AiArtifactParseError) failed = true;
      else throw error;
    }
    if (!failed) throw new Error(`Negative fixture should reject: ${file}`);
    console.log(`OK ai/negative/${file}`);
  }

  const kineticBrief = await readJson(resolve(positiveRoot, "kinetic-brief-hook-benefit-cta.json"));
  const loop = runGenerationLoop({
    brief: parseCreativeBriefV1(kineticBrief),
    seed: "kinetic-pr3",
    industry: "fnb",
    maxRepairs: 3,
  });
  if (!loop.ok) throw new Error(`Kinetic generation loop failed: ${JSON.stringify(loop.critic.findings)}`);
  if (loop.project.scenes.length < 3) throw new Error("Kinetic slice expects ≥3 scenes");
  if (loop.contactSheet.frames.length < 1) throw new Error("Contact sheet empty");
  console.log(
    `OK ai/kinetic-pr3 scenes=${loop.project.scenes.length} score=${loop.critic.score} repairs=${loop.repairs} frames=${loop.contactSheet.frames.length}`,
  );

  console.log(`Validated ${positiveFiles.length} positive and ${negativeFiles.length} negative AI fixtures + kinetic PR-3.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
