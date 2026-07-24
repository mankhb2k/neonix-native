import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  parseMotionProject,
  serializeMotionProject,
} from "@motionvideo/motion-schema";
import {
  templates,
  validateMotionProjectPresets,
} from "@motionvideo/template-library";
import { compileMotionProject } from "./compiler";
import { encodeOutputs } from "./ffmpeg";
import { renderCompiledProject } from "./runtime";
import { uploadOutputs } from "./upload";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function ffmpegBin(): string {
  const bin = require("ffmpeg-static") as string | null;
  if (!bin) throw new Error("ffmpeg-static binary missing");
  return bin;
}

function probe(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin(), ["-i", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", () => {
      // ffmpeg -i exits non-zero without output file; stderr still has stream info
      resolve(stderr);
    });
    child.on("error", reject);
  });
}

async function main() {
  const template = templates[0];
  if (!template) throw new Error("No seed template in template-library");

  const project = parseMotionProject({
    ...template.project,
    metadata: { ...template.project.metadata, id: `e2e_${Date.now()}` },
  });

  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    throw new Error(
      `Unknown presets: ${presetCheck.unknown.map((u) => u.preset).join(", ")}`,
    );
  }

  const mtDir = path.join(REPO_ROOT, "tmp");
  await mkdir(mtDir, { recursive: true });
  const mtPath = path.join(mtDir, `${project.metadata.id}.mt`);
  await writeFile(mtPath, serializeMotionProject(project), "utf8");
  console.log(`[e2e] wrote ${mtPath}`);

  const compiled = compileMotionProject(project);
  console.log(
    `[e2e] compiled ${compiled.scenes.length} scenes · ${compiled.scenes.reduce((sum, scene) => sum + scene.duration, 0)}s`,
  );

  const rendered = await renderCompiledProject(compiled, {
    fps: 12,
    scale: 0.5,
    outDir: path.join(REPO_ROOT, "tmp", "frames", project.metadata.id),
  });
  console.log(
    `[e2e] rendered ${rendered.frameCount} frames @ ${rendered.fps}fps (${rendered.width}x${rendered.height})`,
  );

  const files = await encodeOutputs(rendered, project.metadata.aspectRatio);
  const urls = await uploadOutputs(files);
  const mp4 = files[0]!.path;
  const info = await stat(mp4);
  const probeOut = await probe(mp4);
  const durationMatch = probeOut.match(/Duration:\s*([\d:.]+)/);
  const videoMatch = probeOut.match(/Video:\s*([^\n]+)/);

  console.log(`[e2e] MP4 ${mp4}`);
  console.log(`[e2e] size ${(info.size / 1024).toFixed(1)} KB`);
  console.log(`[e2e] duration ${durationMatch?.[1] ?? "?"}`);
  console.log(`[e2e] video ${videoMatch?.[1]?.trim() ?? "?"}`);
  console.log(`[e2e] urls ${urls.join(", ")}`);

  if (info.size < 1000) {
    throw new Error("MP4 too small — encode likely failed");
  }
  if (!videoMatch) {
    throw new Error("ffmpeg could not read video stream from MP4");
  }

  console.log("[e2e] OK");
}

main().catch((err) => {
  console.error("[e2e] FAILED", err);
  process.exit(1);
});
