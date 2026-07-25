import { stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseMotionProject } from "@motionvideo/motion-schema";
import {
  templates,
  validateMotionProjectPresets,
} from "@motionvideo/template-library";
import { compileMotionProject } from "./compiler";
import { encodeOutputs, resolveFfmpegPath } from "./ffmpeg";
import { renderCompiledProject } from "./runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function probe(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), ["-i", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", () => resolve(stderr));
    child.on("error", reject);
  });
}

/**
 * Real-resolution benchmark (1080x1920 @30fps) — NOT the fast e2e smoke test.
 * Prints wall-clock render/encode time + rough cloud-cost estimate so
 * the C++-vs-Node decision is based on measured numbers, not guesswork.
 */
async function main() {
  const template = templates[0];
  if (!template) throw new Error("No seed template in template-library");

  const project = parseMotionProject({
    ...template.project,
    metadata: { ...template.project.metadata, id: `bench_${Date.now()}` },
  });

  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    throw new Error(
      `Unknown presets: ${presetCheck.unknown.map((u) => u.preset).join(", ")}`,
    );
  }

  const compiled = compileMotionProject(project);
  console.log(
    `[bench] project: ${compiled.scenes.length} scenes, ${compiled.scenes.reduce((sum, scene) => sum + scene.duration, 0)}s total, aspect ${compiled.metadata.aspectRatio}`,
  );

  const fps = 30;
  const scale = 1; // 1.0 = full production resolution (1080x1920 for 9:16)

  const t0 = performance.now();
  const rendered = await renderCompiledProject(compiled, {
    fps,
    scale,
    outDir: path.join(REPO_ROOT, "tmp", "frames", project.metadata.id),
  });
  const renderMs = performance.now() - t0;

  const t1 = performance.now();
  const files = await encodeOutputs(rendered, project.metadata.aspectRatio, compiled);
  const encodeMs = performance.now() - t1;

  const totalMs = renderMs + encodeMs;
  const mp4 = files[0]!.path;
  const info = await stat(mp4);
  const probeOut = await probe(mp4);
  const videoMatch = probeOut.match(/Video:\s*([^\n]+)/);

  const videoDurationSec = compiled.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const realtimeFactor = totalMs / 1000 / videoDurationSec;

  console.log("");
  console.log("=== KẾT QUẢ BENCHMARK (độ phân giải sản xuất thật) ===");
  console.log(
    `Độ phân giải: ${rendered.width}x${rendered.height} @ ${fps}fps · ${rendered.frameCount} frame`,
  );
  console.log(`Video: ${videoDurationSec}s | File: ${(info.size / 1024).toFixed(1)} KB`);
  console.log(`Codec: ${videoMatch?.[1]?.trim() ?? "?"}`);
  console.log("---");
  console.log(`Render (raster frame):  ${(renderMs / 1000).toFixed(2)}s`);
  console.log(`Encode (ffmpeg libx264): ${(encodeMs / 1000).toFixed(2)}s`);
  console.log(`Tổng thời gian:          ${(totalMs / 1000).toFixed(2)}s`);
  console.log(
    `Hệ số realtime: ${realtimeFactor.toFixed(2)}x (1.0x = render nhanh bằng độ dài video)`,
  );
  console.log("---");

  // Rough cloud CPU-time cost model — 1 vCPU ~ $0.03–0.05/hour on common providers (2026 rates)
  const vcpuHourRates = [0.03, 0.05];
  console.log("Ước tính chi phí CPU-time / video (rất thô, dùng để so sánh bậc độ lớn):");
  for (const rate of vcpuHourRates) {
    const costPerRender = (totalMs / 1000 / 3600) * rate;
    console.log(
      `  @ $${rate.toFixed(2)}/vCPU-h → $${costPerRender.toFixed(5)} / video (${videoDurationSec}s)`,
    );
  }
  console.log("");
  console.log(
    "So sánh: người dùng Remotion Lambda báo cáo 'vài xu cho nhiều phút video' ở cùng mô hình Node+ffmpeg.",
  );
}

main().catch((err) => {
  console.error("[bench] FAILED", err);
  process.exit(1);
});
