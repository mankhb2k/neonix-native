import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEXT_CONIC_GRADIENT_PROJECT, TEXT_GRADIENT_PROJECT, TEXT_RADIAL_GRADIENT_PROJECT } from "../lib/docs/preview-lab";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

const GRADIENT_PROJECTS = {
  linear: TEXT_GRADIENT_PROJECT,
  radial: TEXT_RADIAL_GRADIENT_PROJECT,
  conic: TEXT_CONIC_GRADIENT_PROJECT,
} as const;

const gradientKind = (process.env.NATIVE_GRADIENT_KIND ?? "linear") as keyof typeof GRADIENT_PROJECTS;
const expectedPaintType = `${gradientKind}-gradient`;

const outputPath = path.resolve(
  process.env.NATIVE_GRADIENT_RUNTIME_OUTPUT ?? path.join(process.cwd(), "e2e", ".artifacts", "text-gradient-runtime.json"),
);

async function main(): Promise<void> {
  const project = GRADIENT_PROJECTS[gradientKind];
  if (!project) {
    throw new Error(`Unknown NATIVE_GRADIENT_KIND "${gradientKind}". Expected one of: ${Object.keys(GRADIENT_PROJECTS).join(", ")}`);
  }
  const runtime = await compileAndPrepareRuntimeProjectV3(project);
  const textNodes = runtime.visual.nodes.filter((node) => node.content.kind === "text");
  const gradientNode = textNodes.find((node) => node.content.kind === "text" && node.content.fillPaint?.type === expectedPaintType);

  if (!gradientNode) {
    throw new Error(`The compiled RuntimeProjectV3 did not contain a ${expectedPaintType} text paint.`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(runtime));
  console.log(JSON.stringify({
    outputPath,
    projectId: runtime.projectId,
    textNodeCount: textNodes.length,
    textFillPaint: gradientNode.content.kind === "text" ? gradientNode.content.fillPaint?.type : null,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
