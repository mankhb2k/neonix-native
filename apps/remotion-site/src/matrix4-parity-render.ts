import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  MATRIX4_PARITY_CASES,
  type Matrix4ParityCase,
} from "@motionvideo/motion-compiler/testing";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  evaluateRuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import { remotionWebpackOverride } from "./webpack-override";

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-matrix4-parity");

function isMissingBrowserError(error: unknown): boolean {
  return /chrom(e|ium)|headless.?shell|no browser|could not find a (suitable )?browser|browser ensure/i.test(
    error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
  );
}

function safeFileName(item: Matrix4ParityCase): string {
  return item.id.replaceAll(".", "-");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const entry = path.join(SITE_ROOT, "src/index.ts");
  const serveUrl = await bundle({
    entryPoint: entry,
    webpackOverride: remotionWebpackOverride,
  });
  for (const item of MATRIX4_PARITY_CASES) {
    const runtime = compileProtocolV2(item.project);
    const frame = evaluateRuntimeProjectV2(runtime, 0);
    const output = path.join(OUT_DIR, `${safeFileName(item)}.png`);
    if (item.id === "matrix4.camera-plane") {
      if (!frame.diagnostics.some((diagnostic) => diagnostic.code === "layer_behind_camera")) {
        throw new Error("Matrix4 camera-plane fixture did not report layer_behind_camera");
      }
    } else if (!frame.commands.some((command) => command.op === "drawShape")) {
      throw new Error(`Matrix4 fixture ${item.id} emitted no drawShape command`);
    }

    const composition = await selectComposition({
      serveUrl,
      id: "MotiClipVideo",
      inputProps: { runtime },
    });

    await renderStill({
      chromiumOptions: { gl: "angle" },
      composition,
      frame: 0,
      inputProps: { runtime },
      output,
      serveUrl,
    });
    const info = await stat(output);
    if (info.size < 1000) {
      throw new Error(`Matrix4 Remotion still is too small for ${item.id}: ${info.size} bytes`);
    }
    console.log(`[e2e] ${item.id} -> ${output} (${info.size} bytes)`);
  }
}

main().catch((error) => {
  if (isMissingBrowserError(error) && process.env.REMOTION_E2E_REQUIRE !== "1") {
    console.warn("[e2e] SKIP Matrix4 Remotion parity: no Chromium");
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});
