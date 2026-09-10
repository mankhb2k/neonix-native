import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { renderOneFrameToSvg, renderRuntimeProjectV3 } from "../src/render/render";
import { rasterizeSvgToRgba } from "../src/render/svg-rasterizer";

const fixturePath = fileURLToPath(new URL("./fixtures/runtime-v3-animated.json", import.meta.url));
const ffmpegAvailable = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

async function fixture(): Promise<RuntimeProjectV3> {
  return JSON.parse(await readFile(fixturePath, "utf8")) as RuntimeProjectV3;
}

describe("Runtime V3 animated export", () => {
  it("evaluates different transforms and opacity at different export frames", async () => {
    const project = await fixture();
    const first = renderOneFrameToSvg(project, 0);
    const second = renderOneFrameToSvg(project, 1);

    expect(first.svg).toContain("matrix(1 0 0 1 10 25)");
    expect(second.svg).toContain("matrix(1 0 0 1 90 25)");
    expect(second.svg).toContain('opacity="0.5"');
    expect(second.svg).not.toBe(first.svg);
  });

  it("produces different pixel buffers for the beginning and middle frames", async () => {
    const project = await fixture();
    const first = renderOneFrameToSvg(project, 0);
    const second = renderOneFrameToSvg(project, 1);
    const firstPixels = await rasterizeSvgToRgba(first.svg, 160, 90);
    const secondPixels = await rasterizeSvgToRgba(second.svg, 160, 90);

    expect(firstPixels.equals(secondPixels)).toBe(false);
  });

  (ffmpegAvailable ? it : it.skip)("encodes visibly different Skia frames into a real MP4", async () => {
    const project = await fixture();
    const outputRoot = await mkdtemp(join(tmpdir(), "neonix-runtime-animation-"));
    const outputPath = join(outputRoot, "animated.mp4");
    try {
      const stats = await renderRuntimeProjectV3(project, {
        outputPath,
        ffmpegLogLevel: "error",
      });
      expect(stats.frames).toBe(2);
      expect(stats.outputBytes).toBeGreaterThan(0);

      const decoded = spawnSync("ffmpeg", [
        "-hide_banner",
        "-loglevel", "error",
        "-i", outputPath,
        "-f", "framemd5",
        "-",
      ], { encoding: "utf8" });
      expect(decoded.status).toBe(0);
      const hashes = decoded.stdout
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.split(",").at(-1)?.trim());
      expect(hashes).toHaveLength(2);
      expect(new Set(hashes).size).toBe(2);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
