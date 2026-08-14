/**
 * Local Remotion encode smoke: MotiClipVideo → MP4 from RenderManifest + Runtime IR.
 * Run: pnpm --filter @motionvideo/remotion-site e2e
 *      pnpm e2e:remotion
 *
 * Skip without Chromium unless REMOTION_E2E_REQUIRE=1.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  compositionDurationInFrames,
  CAPABILITY_MANIFEST_VERSION,
} from "@motionvideo/motion-runtime";
import {
  createDemoMotionProject,
  compileProjectV1,
} from "@motionvideo/motion-runtime/testing";
import { remotionWebpackOverride } from "./webpack-override";
import {
  parseRenderManifest,
  REMOTION_PIN,
} from "@motionvideo/render-contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-smoke");
const REQUIRE = process.env.REMOTION_E2E_REQUIRE === "1";
const SMOKE_SCALE = 0.25;
const SMOKE_MAX_FRAMES = 24;

function errorText(error: unknown): string {
  try {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
    }
    return String(error);
  } catch {
    return "unknown error";
  }
}

function isMissingBrowserError(error: unknown): boolean {
  return /chrom(e|ium)|headless.?shell|no browser|could not find a (suitable )?browser|browser ensure/i.test(
    errorText(error),
  );
}

function skipNoChromium(error: unknown): never {
  console.warn("[e2e] SKIP remotion e2e: no Chromium");
  console.warn(errorText(error));
  process.exit(0);
}

function probeDurationSeconds(mp4Path: string): number | null {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      mp4Path,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  const value = Number.parseFloat((result.stdout ?? "").trim());
  return Number.isFinite(value) ? value : null;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const project = createDemoMotionProject();
  const runtime = compileProjectV1(project);
  const fps = runtime.metadata.fps || 30;
  const fullDuration = compositionDurationInFrames(runtime, undefined, fps);
  const durationInFrames = Math.max(
    1,
    Math.min(fullDuration, SMOKE_MAX_FRAMES),
  );
  const size =
    runtime.metadata.aspectRatio === "9:16"
      ? { width: 1080, height: 1920 }
      : runtime.metadata.aspectRatio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 };

  const runtimePath = path.join(OUT_DIR, "runtime.json");
  await writeFile(runtimePath, JSON.stringify(runtime), "utf8");

  const manifest = parseRenderManifest({
    format: "moticlip-render-manifest",
    manifestVersion: 2,
    projectId: project.metadata.id,
    projectRevision: 0,
    versions: {
      schema: 2,
      compiler: "0.0.1",
      runtime: "0.0.1",
      remotion: REMOTION_PIN,
      capabilityManifest: CAPABILITY_MANIFEST_VERSION,
    },
    contentHash: "a".repeat(64),
    determinism: {
      version: 1,
      frameEpsilon: 1.7763568394002505e-15,
      geometryEpsilon: 1e-12,
      lengthEpsilon: 1e-9,
      hashAlgorithm: "sha256",
      canonicalJson: true,
    },
    composition: {
      ...size,
      fps,
      durationInFrames,
      background: "#0d9488",
    },
    runtime: {
      url: `file://${runtimePath.replace(/\\/g, "/")}`,
      sha256: "smoke-local",
    },
    assets: [],
    output: {
      codec: "h264",
      pixelFormat: "yuv420p",
      privacy: "private",
    },
  });

  const entry = path.join(SITE_ROOT, "src/index.ts");
  console.log("[e2e] bundling", entry);
  const serveUrl = await bundle({
    entryPoint: entry,
    webpackOverride: remotionWebpackOverride,
  });

  const inputProps = { manifest, runtime };
  const composition = await selectComposition({
    serveUrl,
    id: "MotiClipVideo",
    inputProps,
  });

  const outputLocation = path.join(OUT_DIR, "smoke.mp4");
  console.log(
    `[e2e] rendering ${outputLocation} (${durationInFrames}f @ scale ${SMOKE_SCALE})`,
  );
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    scale: SMOKE_SCALE,
  });

  const info = await stat(outputLocation);
  if (info.size < 1000) {
    throw new Error(
      `Remotion MP4 too small (${info.size} bytes) — encode likely failed`,
    );
  }
  const duration = probeDurationSeconds(outputLocation);
  if (duration != null && duration <= 0) {
    throw new Error(`Remotion MP4 duration is ${duration}s`);
  }
  console.log(
    `[e2e] wrote ${outputLocation} (${(info.size / 1024).toFixed(1)} KB${
      duration != null ? `, ${duration.toFixed(2)}s` : ""
    })`,
  );
}

main().catch((error) => {
  if (!REQUIRE && isMissingBrowserError(error)) {
    skipNoChromium(error);
  }
  console.error(errorText(error));
  process.exit(1);
});
