/**
 * Native-canvas effect parity fixture for Remotion export.
 *
 * The web preview suite samples these same semantic cases through WebGL2 and
 * WebGPU. This script renders them through MotiClipVideo and samples the PNG
 * emitted by Remotion, proving export still consumes Runtime Effect Operator IR
 * rather than a CSS filter translation.
 */

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { remotionWebpackOverride } from "./webpack-override";

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-effect-parity");
const BACKGROUND = "#101820";

type Rgba = readonly [number, number, number, number];
type RgbaImage = { width: number; height: number; pixels: Uint8Array };

const IDENTITY_TRANSFORM = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

function project(id: string, layers: MotionProtocolV2["layers"]): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id,
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: BACKGROUND,
      colorSpace: "srgb",
      audioSampleRate: 48000,
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
      },
    },
    layers,
  };
}

function rectangle(options: {
  id: string;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string | { type: "linear-gradient"; angle: number; stops: Array<{ offset: number; color: string }> };
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  effects?: Array<
    | { id: string; type: "blur"; radius: number }
    | { id: string; type: "color-adjust"; brightness: number; contrast: number; saturation: number; hueRotate: number }
    | { id: string; type: "drop-shadow"; x: number; y: number; blur: number; color: string; opacity: number }
    | { id: string; type: "inner-glow"; radius: number; color: string; opacity: number }
    | { id: string; type: "noise"; scale: number; amount: number; opacity: number; seed: number }
  >;
}): Extract<MotionProtocolV2["layers"][number], { type: "shape" }> {
  return {
    id: options.id,
    type: "shape",
    parentLayerId: null,
    zIndex: options.zIndex,
    frame: { width: options.width, height: options.height },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: options.x, y: options.y, z: 0 } },
    opacity: 100,
    timing: { start: 0, duration: 3 },
    payload: { shape: "rectangle" },
    style: {
      fill: options.fill,
      ...(options.fillOpacity != null ? { fillOpacity: options.fillOpacity } : {}),
      ...(options.stroke ? { stroke: options.stroke } : {}),
      ...(options.strokeWidth != null ? { strokeWidth: options.strokeWidth } : {}),
    },
    ...(options.effects ? { effects: options.effects } : {}),
  };
}

const gradient = {
  type: "linear-gradient" as const,
  angle: 0,
  stops: [
    { offset: 0, color: "#000000" },
    { offset: 1, color: "#ffffff" },
  ],
};

const EFFECT_ORDER_PROJECT = project("remotion-effect-order", [
  rectangle({
    id: "color-then-blur", zIndex: 0, x: 180, y: 360, width: 600, height: 360, fill: gradient,
    effects: [
      { id: "contrast-first", type: "color-adjust", brightness: 0, contrast: 4, saturation: 1, hueRotate: 0 },
      { id: "blur-second", type: "blur", radius: 40 },
    ],
  }),
  rectangle({
    id: "blur-then-color", zIndex: 1, x: 1140, y: 360, width: 600, height: 360, fill: gradient,
    effects: [
      { id: "blur-first", type: "blur", radius: 40 },
      { id: "contrast-second", type: "color-adjust", brightness: 0, contrast: 4, saturation: 1, hueRotate: 0 },
    ],
  }),
]);

const BLUR_CHAIN_PROJECT = project("remotion-effect-blur-chain", [
  rectangle({
    id: "single-blur", zIndex: 0, x: 300, y: 360, width: 360, height: 360, fill: "#ff3366",
    effects: [{ id: "single-soften", type: "blur", radius: 20 }],
  }),
  rectangle({
    id: "double-blur", zIndex: 1, x: 1260, y: 360, width: 360, height: 360, fill: "#ff3366",
    effects: [
      { id: "first-soften", type: "blur", radius: 20 },
      { id: "second-soften", type: "blur", radius: 20 },
    ],
  }),
]);

const DROP_SHADOW_PROJECT = project("remotion-effect-drop-shadow", [
  rectangle({
    id: "shadow-reference", zIndex: 0, x: 300, y: 330, width: 360, height: 360, fill: "#d9d9d9",
  }),
  rectangle({
    id: "drop-shadow-rectangle", zIndex: 1, x: 1260, y: 330, width: 360, height: 360, fill: "#d9d9d9",
    effects: [{ id: "pink-shadow", type: "drop-shadow", x: 24, y: 28, blur: 24, color: "#ff3366", opacity: 0.65 }],
  }),
]);

const DROP_SHADOW_NEGATIVE_PROJECT = project("remotion-effect-drop-shadow-negative", [
  rectangle({ id: "negative-shadow-reference", zIndex: 0, x: 300, y: 330, width: 360, height: 360, fill: "#d9d9d9" }),
  rectangle({
    id: "negative-shadow-rectangle", zIndex: 1, x: 1260, y: 330, width: 360, height: 360, fill: "#d9d9d9",
    effects: [{ id: "blue-shadow-up-left", type: "drop-shadow", x: -24, y: -28, blur: 24, color: "#3366ff", opacity: 0.65 }],
  }),
]);

const DROP_SHADOW_ZERO_BLUR_PROJECT = project("remotion-effect-drop-shadow-zero-blur", [
  rectangle({
    id: "zero-blur-shadow-rectangle", zIndex: 0, x: 1260, y: 330, width: 360, height: 360, fill: "#d9d9d9",
    effects: [{ id: "crisp-pink-shadow", type: "drop-shadow", x: 24, y: 28, blur: 0, color: "#ff3366", opacity: 0.65 }],
  }),
]);

const DROP_SHADOW_ALPHA_COLOR_PROJECT = project("remotion-effect-drop-shadow-alpha-color", [
  rectangle({
    id: "alpha-color-shadow", zIndex: 0, x: 300, y: 330, width: 360, height: 360, fill: "#d9d9d9",
    effects: [{ id: "half-alpha-blue-shadow", type: "drop-shadow", x: 24, y: 28, blur: 0, color: "#3366ff80", opacity: 1 }],
  }),
  rectangle({
    id: "opaque-color-shadow", zIndex: 1, x: 1260, y: 330, width: 360, height: 360, fill: "#d9d9d9",
    effects: [{ id: "opaque-blue-shadow", type: "drop-shadow", x: 24, y: 28, blur: 0, color: "#3366ff", opacity: 1 }],
  }),
]);

const DROP_SHADOW_STROKE_PROJECT = project("remotion-effect-drop-shadow-stroke", [
  rectangle({
    id: "fill-only-shadow-source", zIndex: 0, x: 300, y: 330, width: 360, height: 360, fill: "#d9d9d9", fillOpacity: 0.2,
    effects: [{ id: "fill-only-shadow", type: "drop-shadow", x: 24, y: 28, blur: 0, color: "#ff3366", opacity: 0.75 }],
  }),
  rectangle({
    id: "fill-and-stroke-shadow-source", zIndex: 1, x: 1260, y: 330, width: 360, height: 360, fill: "#d9d9d9", fillOpacity: 0.2, stroke: "#d9d9d9", strokeWidth: 24,
    effects: [{ id: "fill-and-stroke-shadow", type: "drop-shadow", x: 24, y: 28, blur: 0, color: "#ff3366", opacity: 0.75 }],
  }),
]);

const INNER_GLOW_PROJECT = project("remotion-effect-inner-glow", [
  rectangle({
    id: "inner-glow-reference", zIndex: 0, x: 300, y: 330, width: 360, height: 360, fill: "#d9d9d9",
  }),
  rectangle({
    id: "inner-glow-rectangle", zIndex: 1, x: 1260, y: 330, width: 360, height: 360, fill: "#d9d9d9",
    effects: [{ id: "cyan-inner-edge", type: "inner-glow", radius: 24, color: "#00e5ff", opacity: 0.85 }],
  }),
]);

const NOISE_PROJECT = project("remotion-effect-noise", [
  rectangle({
    id: "noise-reference", zIndex: 0, x: 220, y: 300, width: 420, height: 420, fill: "#d9d9d9",
  }),
  rectangle({
    id: "noise-rectangle", zIndex: 1, x: 1280, y: 300, width: 420, height: 420, fill: "#d9d9d9",
    effects: [{ id: "grain", type: "noise", scale: 4, amount: 0.45, opacity: 0.85, seed: 1337 }],
  }),
]);

function blurRadiusProject(radius: number): MotionProtocolV2 {
  return project(`remotion-effect-blur-radius-${radius}`, [
    rectangle({
      id: `blur-${radius}`, zIndex: 0, x: 360, y: 90, width: 1200, height: 900, fill: "#ff3366",
      effects: [{ id: `soften-${radius}`, type: "blur", radius }],
    }),
  ]);
}

function paeth(left: number, up: number, upLeft: number): number {
  const candidate = left + up - upLeft;
  const leftDistance = Math.abs(candidate - left);
  const upDistance = Math.abs(candidate - up);
  const upLeftDistance = Math.abs(candidate - upLeft);
  return leftDistance <= upDistance && leftDistance <= upLeftDistance
    ? left
    : upDistance <= upLeftDistance ? up : upLeft;
}

function decodeRgbaPng(input: Buffer): RgbaImage {
  const signature = "89504e470d0a1a0a";
  if (input.subarray(0, 8).toString("hex") !== signature) throw new Error("Expected PNG output");
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  for (let offset = 8; offset < input.length;) {
    const length = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString("ascii");
    const payload = input.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      colorType = payload[9]!;
      if (payload[8] !== 8 || (colorType !== 2 && colorType !== 6) || payload[12] !== 0) {
        throw new Error("Expected an 8-bit non-interlaced RGB or RGBA PNG");
      }
    } else if (type === "IDAT") {
      idat.push(payload);
    }
    offset += length + 12;
  }
  if (!width || !height || !idat.length) throw new Error("PNG is missing image data");
  const raw = inflateSync(Buffer.concat(idat));
  const sourceChannels = colorType === 6 ? 4 : 3;
  const sourceStride = width * sourceChannels;
  const pixels = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset++]!;
    const decodedRow = new Uint8Array(sourceStride);
    for (let x = 0; x < sourceStride; x += 1) {
      const encoded = raw[inputOffset++]!;
      const left = x >= sourceChannels ? decodedRow[x - sourceChannels]! : 0;
      const up = y > 0 ? pixels[((y - 1) * width * 4) + Math.floor(x / sourceChannels) * 4 + (x % sourceChannels)]! : 0;
      const upLeft = y > 0 && x >= sourceChannels
        ? pixels[((y - 1) * width * 4) + Math.floor((x - sourceChannels) / sourceChannels) * 4 + ((x - sourceChannels) % sourceChannels)]!
        : 0;
      const value = filter === 0 ? encoded
        : filter === 1 ? encoded + left
        : filter === 2 ? encoded + up
        : filter === 3 ? encoded + Math.floor((left + up) / 2)
        : filter === 4 ? encoded + paeth(left, up, upLeft)
        : (() => { throw new Error(`Unsupported PNG filter ${filter}`); })();
      decodedRow[x] = value & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * sourceChannels;
      const outputOffset = (y * width + x) * 4;
      pixels[outputOffset] = decodedRow[sourceOffset]!;
      pixels[outputOffset + 1] = decodedRow[sourceOffset + 1]!;
      pixels[outputOffset + 2] = decodedRow[sourceOffset + 2]!;
      pixels[outputOffset + 3] = sourceChannels === 4 ? decodedRow[sourceOffset + 3]! : 255;
    }
  }
  return { width, height, pixels };
}

function pixel(image: RgbaImage, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) throw new Error(`Sample outside PNG: ${x}, ${y}`);
  const offset = (y * image.width + x) * 4;
  return [image.pixels[offset]!, image.pixels[offset + 1]!, image.pixels[offset + 2]!, image.pixels[offset + 3]!];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function renderProject(serveUrl: string, projectToRender: MotionProtocolV2, name: string): Promise<RgbaImage> {
  const runtime = compileProtocolV2(projectToRender);
  const composition = await selectComposition({ serveUrl, id: "MotiClipVideo", inputProps: { runtime } });
  const output = path.join(OUT_DIR, `${name}.png`);
  await renderStill({
    chromiumOptions: { gl: "angle" },
    composition,
    frame: 0,
    inputProps: { runtime },
    output,
    serveUrl,
  });
  console.log(`[e2e] rendered ${name}`);
  return decodeRgbaPng(await readFile(output));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const serveUrl = await bundle({
    entryPoint: path.join(SITE_ROOT, "src/index.ts"),
    webpackOverride: remotionWebpackOverride,
  });

  const ordered = await renderProject(serveUrl, EFFECT_ORDER_PROJECT, "effect-order");
  const samples = [420, 450, 480, 510];
  assert(
    samples.some((x) => Math.abs(pixel(ordered, x, 540)[0] - pixel(ordered, x + 960, 540)[0]) >= 8),
    "Remotion changed color-adjust -> blur and blur -> color-adjust into the same image",
  );

  const chained = await renderProject(serveUrl, BLUR_CHAIN_PROJECT, "blur-chain");
  assert(
    pixel(chained, 1240, 540)[0] > pixel(chained, 280, 540)[0] + 5,
    "Remotion did not execute two blur operators in order",
  );

  const shadow = await renderProject(serveUrl, DROP_SHADOW_PROJECT, "drop-shadow");
  const sourceCenter = pixel(shadow, 1440, 510);
  const shadowSample = pixel(shadow, 1640, 710);
  assert(sourceCenter[0] === 217 && sourceCenter[1] === 217 && sourceCenter[2] === 217, "Remotion shadow changed the source interior");
  assert(
    shadowSample[0] > 50 && shadowSample[0] > shadowSample[1] + 20 && shadowSample[0] > shadowSample[2] + 15,
    "Remotion did not render the pink shadow below and right of the source",
  );

  const negativeShadow = await renderProject(serveUrl, DROP_SHADOW_NEGATIVE_PROJECT, "drop-shadow-negative");
  const negativeSample = pixel(negativeShadow, 1220, 300);
  assert(
    negativeSample[2] > negativeSample[0] + 15 && negativeSample[2] > negativeSample[1] + 8,
    "Remotion did not render the blue shadow above and left of the source",
  );

  const zeroBlurShadow = await renderProject(serveUrl, DROP_SHADOW_ZERO_BLUR_PROJECT, "drop-shadow-zero-blur");
  const zeroBlurSample = pixel(zeroBlurShadow, 1630, 700);
  assert(
    zeroBlurSample[0] > zeroBlurSample[1] + 50 && zeroBlurSample[0] > zeroBlurSample[2] + 20,
    "Remotion did not preserve the crisp zero-blur shadow silhouette",
  );

  const alphaColorShadow = await renderProject(serveUrl, DROP_SHADOW_ALPHA_COLOR_PROJECT, "drop-shadow-alpha-color");
  const embeddedAlphaSample = pixel(alphaColorShadow, 670, 700);
  const opaqueColorSample = pixel(alphaColorShadow, 1630, 700);
  assert(
    opaqueColorSample[2] > embeddedAlphaSample[2] + 50,
    "Remotion did not multiply the embedded shadow color alpha",
  );

  const strokeSourceShadow = await renderProject(serveUrl, DROP_SHADOW_STROKE_PROJECT, "drop-shadow-stroke-source");
  const fillOnlyShadowSample = pixel(strokeSourceShadow, 680, 710);
  const fillAndStrokeShadowSample = pixel(strokeSourceShadow, 1640, 710);
  assert(
    fillAndStrokeShadowSample[0] > fillOnlyShadowSample[0] + 50,
    "Remotion did not capture opaque stroke coverage in the shadow source",
  );

  const innerGlow = await renderProject(serveUrl, INNER_GLOW_PROJECT, "inner-glow");
  assert(pixel(innerGlow, 1440, 510).join(",") === "217,217,217,255", "Remotion inner glow changed the source center");
  const innerEdge = pixel(innerGlow, 1270, 510);
  assert(
    innerEdge[1] > innerEdge[0] + 25 && innerEdge[2] > innerEdge[0] + 35,
    "Remotion did not render the cyan inner glow edge",
  );

  const noise = await renderProject(serveUrl, NOISE_PROJECT, "noise");
  assert(pixel(noise, 430, 510).join(",") === "217,217,217,255", "Remotion noise changed the clean reference surface");
  const noiseSamples = [pixel(noise, 1480, 480), pixel(noise, 1496, 480), pixel(noise, 1512, 480), pixel(noise, 1480, 496), pixel(noise, 1496, 496), pixel(noise, 1512, 496)];
  assert(new Set(noiseSamples.map((sample) => sample.join(","))).size > 1, "Remotion did not render deterministic grain on the effected surface");

  for (const radius of [4, 40, 256]) {
    const image = await renderProject(serveUrl, blurRadiusProject(radius), `blur-radius-${radius}`);
    const center = pixel(image, 960, 540);
    assert(center[0] > 220 && center[3] === 255, `Blur ${radius} lost its opaque center`);
    const spread = Math.min(radius * 2, 220);
    let previous = -1;
    for (let index = 0; index < 9; index += 1) {
      const x = Math.round(360 - spread + (spread * 2 * index) / 8);
      const sample = pixel(image, x, 540);
      assert(sample[0] >= previous - 1, `Blur ${radius} has a non-monotonic edge profile`);
      assert(sample[0] >= 16 && sample[1] >= 24 && sample[2] >= 32, `Blur ${radius} has a dark or colored fringe`);
      previous = sample[0];
    }
  }
  console.log(`[e2e] Remotion effect parity fixtures passed -> ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
