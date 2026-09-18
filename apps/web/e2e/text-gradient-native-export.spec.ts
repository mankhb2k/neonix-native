import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFile = promisify(execFileCallback);

type NativeBenchmarkResult = {
  actualBackend: string;
  benchmarkMode: string;
  colorConverter: string;
  outputBytes: number;
  protocolCommandCounts: Record<string, number>;
  nativeMetrics: {
    ok: boolean;
    actualBackend: string;
    inProcessEncoding: boolean;
    surfaceKind: string;
    videoColorSpace: string;
    videoColorRange: string;
  };
};

type FfprobeResult = {
  streams: Array<{
    codec_name: string;
    width: number;
    height: number;
    pix_fmt: string;
    color_space: string;
    color_range: string;
  }>;
  format: { format_name: string; size: string };
};

function parseBenchmarkResult(stdout: string): NativeBenchmarkResult {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.toReversed()) {
    const candidate = line.startsWith("BENCHMARK_RESULT ") ? line.slice("BENCHMARK_RESULT ".length) : line;
    if (!candidate.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(candidate) as NativeBenchmarkResult & { benchmark?: string };
      if (parsed.benchmark === "native-skia-command-buffer-cpu-cloud-run") return parsed;
    } catch {
      // Docker/Node may emit a prefixed or unprefixed result depending on the
      // entrypoint. Continue until the structured benchmark line is found.
    }
  }
  throw new Error(`Native benchmark did not emit a structured result:\n${stdout}`);
}

test.describe("text gradient native export E2E", () => {
  test.setTimeout(180_000);

  test("keeps the same Runtime/PaintCommandBuffer gradient and exports native MP4", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    // Preview gate: the browser path must expose the canonical paint through
    // Runtime -> PaintCommandBuffer -> CanvasKit before export is attempted.
    await page.goto("/docs/preview/native", { waitUntil: "load" });
    await page.selectOption("#runtime-skia-case", "text.linear-gradient");
    await expect(page.locator("canvas").first()).toHaveAttribute("data-runtime-text-commands", "1", { timeout: 45_000 });
    await expect(page.getByTestId("skia-runtime-lab")).toHaveAttribute("data-text-fill-paint", "linear-gradient", { timeout: 45_000 });
    await expect(page.locator("canvas").first()).toBeVisible();
    expect(consoleErrors).toEqual([]);

    const repoRoot = path.resolve(process.cwd(), "../..");
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "neonix-text-gradient-e2e-"));
    const runtimePath = path.join(tempDir, "text-gradient-runtime.json");
    const outputPath = path.join(tempDir, "text-gradient-native.mp4");

    try {
      const prepared = await execFile(process.env.ComSpec ?? "cmd.exe", [
        "/d", "/s", "/c", "pnpm --dir apps/web exec tsx scripts/prepare-native-text-gradient-e2e.ts",
      ], {
        cwd: repoRoot,
        env: { ...process.env, NATIVE_GRADIENT_RUNTIME_OUTPUT: runtimePath },
        maxBuffer: 4 * 1024 * 1024,
      });
      expect(prepared.stdout).toContain('"textFillPaint":"linear-gradient"');

      const runtime = JSON.parse(await readFile(runtimePath, "utf8")) as {
        visual: { nodes: Array<{ content: { kind: string; fillPaint?: { type?: string } } }> };
      };
      const textNode = runtime.visual.nodes.find((node) => node.content.kind === "text");
      expect(textNode?.content.fillPaint?.type).toBe("linear-gradient");

      const artifactDir = path.dirname(outputPath);
      const native = await execFile("docker.exe", [
        "run", "--rm",
        "-v", `${artifactDir}:/e2e`,
        "-e", "BENCHMARK_RUNTIME_JSON_PATH=/e2e/text-gradient-runtime.json",
        "-e", "BENCHMARK_OUTPUT=/e2e/text-gradient-native.mp4",
        "-e", "BENCHMARK_MODE=in-process",
        "-e", "BENCHMARK_FRAMES=3",
        "-e", "BENCHMARK_DURATION_SECONDS=0.1",
        "-e", "BENCHMARK_START_FRAME=0",
        "-e", "BENCHMARK_END_FRAME=3",
        "-e", "BENCHMARK_PROTOCOL_TRANSPORT=pipe",
        "-e", "BENCHMARK_SURFACE_MODE=direct-raster",
        "-e", "BENCHMARK_COLOR_CONVERTER=libyuv",
        process.env.NATIVE_GRADIENT_E2E_IMAGE ?? "neonix-skia-gradient-e2e",
      ], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
      const benchmark = parseBenchmarkResult(native.stdout);

      expect(benchmark.nativeMetrics.ok).toBe(true);
      expect(benchmark.actualBackend).toBe("skia-native-raster");
      expect(benchmark.nativeMetrics.actualBackend).toBe("skia-native-raster");
      expect(benchmark.nativeMetrics.surfaceKind).toBe("raster-direct");
      expect(benchmark.nativeMetrics.inProcessEncoding).toBe(true);
      expect(benchmark.colorConverter).toBe("libyuv");
      expect(benchmark.protocolCommandCounts.drawText).toBeGreaterThan(0);
      expect(benchmark.outputBytes).toBeGreaterThan(0);

      const probe = await execFile("docker.exe", [
        "run", "--rm",
        "-v", `${artifactDir}:/e2e:ro`,
        process.env.NATIVE_GRADIENT_E2E_IMAGE ?? "neonix-skia-gradient-e2e",
        "ffprobe", "-v", "error",
        "-show_entries", "format=format_name,size",
        "-show_entries", "stream=codec_name,width,height,pix_fmt,color_space,color_range",
        "-of", "json", "/e2e/text-gradient-native.mp4",
      ], { cwd: repoRoot, maxBuffer: 2 * 1024 * 1024 });
      const media = JSON.parse(probe.stdout) as FfprobeResult;
      expect(media.format.format_name).toContain("mp4");
      expect(Number(media.format.size)).toBeGreaterThan(0);
      expect(media.streams[0]).toMatchObject({
        codec_name: "h264",
        width: 1920,
        height: 1080,
        pix_fmt: "yuv420p",
        color_space: "bt709",
        color_range: "tv",
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
