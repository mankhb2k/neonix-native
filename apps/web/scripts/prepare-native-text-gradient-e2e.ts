import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEXT_GRADIENT_PROJECT } from "../lib/docs/preview-lab";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

const outputPath = path.resolve(
  process.env.NATIVE_GRADIENT_RUNTIME_OUTPUT ?? path.join(process.cwd(), "e2e", ".artifacts", "text-gradient-runtime.json"),
);

async function main(): Promise<void> {
  const runtime = await compileAndPrepareRuntimeProjectV3(TEXT_GRADIENT_PROJECT);
  const textNodes = runtime.visual.nodes.filter((node) => node.content.kind === "text");
  const gradientNode = textNodes.find((node) => node.content.kind === "text" && node.content.fillPaint?.type === "linear-gradient");

  if (!gradientNode) {
    throw new Error("The compiled RuntimeProjectV3 did not contain a linear-gradient text paint.");
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
