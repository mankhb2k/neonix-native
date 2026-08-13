/**
 * Local Remotion CLI smoke: MotiClipVideo → MP4 from RenderManifest + Runtime IR.
 * Run: pnpm --filter @motionvideo/remotion-site render:smoke
 */

import { mkdir, writeFile } from "node:fs/promises";
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
import {
  parseRenderManifest,
  REMOTION_PIN,
} from "@motionvideo/render-contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-smoke");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const project = createDemoMotionProject();
  const runtime = compileProjectV1(project);
  const fps = runtime.metadata.fps || 30;
  const durationInFrames = compositionDurationInFrames(runtime, undefined, fps);
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
    manifestVersion: 1,
    projectId: project.metadata.id,
    projectRevision: 0,
    versions: {
      schema: 2,
      compiler: "0.0.1",
      runtime: "0.0.1",
      remotion: REMOTION_PIN,
      capabilityManifest: CAPABILITY_MANIFEST_VERSION,
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
  console.log("[smoke] bundling", entry);
  const serveUrl = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl,
    id: "MotiClipVideo",
    inputProps: { manifest, runtime },
  });

  const outputLocation = path.join(OUT_DIR, "smoke.mp4");
  console.log("[smoke] rendering", outputLocation);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps: { manifest, runtime },
  });
  console.log("[smoke] wrote", outputLocation);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
