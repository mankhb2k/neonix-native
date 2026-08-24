/**
 * Visual regression gate for thin, rotated rounded-rectangle strokes.
 *
 * It renders through the same Remotion canvas used by final export, then
 * samples the complete 3px inside-stroke band. This catches regressions where
 * half of the requested stroke gets clipped at the layer quad boundary.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { remotionWebpackOverride } from "./webpack-override";
import { decodeRgbaPng, pixel, type RgbaImage } from "./png";

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-stroke-raster");
const OUTPUT = path.join(OUT_DIR, "thin-rotated-rounded-stroke.png");
const ANGLE = 30;
const FRAME = { width: 360, height: 160 };
const TRANSLATE = { x: 140, y: 100 };

function isMissingBrowserError(error: unknown): boolean {
  return /chrom(e|ium)|headless.?shell|no browser|could not find a (suitable )?browser|browser ensure/i.test(
    error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
  );
}

function localToWorld(localX: number, localY: number): { x: number; y: number } {
  const radians = ANGLE * Math.PI / 180;
  const anchorX = FRAME.width / 2;
  const anchorY = FRAME.height / 2;
  const relativeX = localX - anchorX;
  const relativeY = localY - anchorY;
  return {
    x: TRANSLATE.x + anchorX + relativeX * Math.cos(radians) - relativeY * Math.sin(radians),
    y: TRANSLATE.y + anchorY + relativeX * Math.sin(radians) + relativeY * Math.cos(radians),
  };
}

function isGoldStroke(image: RgbaImage, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
  const [red, green, blue] = pixel(image, x, y);
  return red > 175 && green > 130 && blue < 115;
}

function hasGoldNear(image: RgbaImage, x: number, y: number): boolean {
  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      if (isGoldStroke(image, Math.round(x) + offsetX, Math.round(y) + offsetY)) return true;
    }
  }
  return false;
}

function createProject() {
  return MotionProtocolV2Schema.parse({
    format: "motion-protocol",
    formatVersion: 2,
    id: "thin-rotated-rounded-stroke",
    composition: {
      width: 640,
      height: 360,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets: [],
    audio: { sampleRate: 48000, tracks: [] },
    layers: [{
      id: "thin-stroke-card",
      type: "shape",
      parentLayerId: null,
      order: 0,
      frame: FRAME,
      transform: {
        translate: { ...TRANSLATE, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: ANGLE },
        skew: { x: 0, y: 0 },
        anchor: { x: FRAME.width / 2, y: FRAME.height / 2, z: 0 },
      },
      opacity: 0.9,
      timing: { start: 0, duration: 1 },
      payload: { shape: "rectangle", cornerRadius: 28 },
      style: { fill: "#223344", stroke: "#f7c948", strokeWidth: 3 },
    }],
  });
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const runtime = compileProtocolV2(createProject());
  const serveUrl = await bundle({
    entryPoint: path.join(SITE_ROOT, "src/index.ts"),
    webpackOverride: remotionWebpackOverride,
  });
  const composition = await selectComposition({ serveUrl, id: "MotiClipVideo", inputProps: { runtime } });
  await renderStill({
    chromiumOptions: { gl: "angle" },
    composition,
    frame: 0,
    inputProps: { runtime },
    output: OUTPUT,
    serveUrl,
  });

  const image = decodeRgbaPng(await readFile(OUTPUT));
  for (let localX = 44; localX <= FRAME.width - 44; localX += 12) {
    for (const depth of [0.5, 1.5, 2.5]) {
      const point = localToWorld(localX, depth);
      if (!hasGoldNear(image, point.x, point.y)) {
        throw new Error(`Thin rounded stroke has a raster gap at local x=${localX}, depth=${depth}`);
      }
    }
  }
  console.log(`[e2e] Thin rotated 3px rounded stroke is continuous through export: ${OUTPUT}`);
}

main().catch((error) => {
  if (isMissingBrowserError(error) && process.env.REMOTION_E2E_REQUIRE !== "1") {
    console.warn("[e2e] SKIP stroke raster parity: no Chromium");
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});
