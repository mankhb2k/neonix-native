import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

type ColorTest = "primary" | "memory" | "grayscale" | "alpha" | "chroma" | "stride";
type Variant = "libswscale-bilinear" | "libswscale-area" | "libyuv";
type RawImage = { data: Buffer; width: number; height: number; channels: number; frames?: number };

const root = resolve(process.env.NEONIX_REPO_ROOT ?? process.cwd());
const durationSeconds = 5;
const fps = 30;
const width = 1920;
const height = 1080;
const tests: ColorTest[] = ["primary", "memory", "grayscale", "alpha", "chroma", "stride"];
const variants: Variant[] = ["libswscale-bilinear", "libswscale-area", "libyuv"];
const artifactRoot = resolve(process.env.COLOR_SUITE_OUTPUT ?? resolve(root, "tmp/mp4-color-suite-5s"));
const reportPath = resolve(process.env.COLOR_SUITE_REPORT ?? resolve(root, "docs/benchmark/results/mp4-color-suite-5s-2026-09-17.json"));
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH ?? "ffprobe";
const nativeBinary = process.env.NATIVE_SKIA_BINARY ?? "/usr/local/bin/neonix-skia-command-cpu-backend-libyuv-sandbox";
const encoderCrf = process.env.COLOR_SUITE_CRF ?? "23";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; captureStdout?: boolean } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", rejectRun);
    child.once("close", (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
  });
}

function runBinary(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<{ code: number; stdout: Buffer; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { chunks.push(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", rejectRun);
    child.once("close", (code) => resolveRun({ code: code ?? 1, stdout: Buffer.concat(chunks), stderr }));
  });
}

function lastJson(stdout: string): Record<string, unknown> {
  for (const line of stdout.trim().split(/\r?\n/).reverse()) {
    if (!line.trimStart().startsWith("{")) continue;
    try { return JSON.parse(line) as Record<string, unknown>; } catch { /* continue */ }
  }
  throw new Error(`No JSON result in child output: ${stdout.slice(-2000)}`);
}

async function renderNative(test: ColorTest, variant: Variant, mode: "render-only" | "in-process", outputPath: string): Promise<Record<string, unknown>> {
  const converter = variant === "libyuv" ? "libyuv" : "swscale";
  // libyuv's 4:2:0 chroma reduction is area-like. When the selected
  // converter is libyuv, the native A/B reference must therefore be
  // libswscale-area, not the production bilinear path.
  const swsFilter = variant === "libswscale-bilinear" ? "bilinear" : "area";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NATIVE_SKIA_BINARY: nativeBinary,
    BENCHMARK_DURATION_SECONDS: String(durationSeconds),
    BENCHMARK_FRAMES: String(durationSeconds * fps),
    BENCHMARK_MODE: mode,
    BENCHMARK_SCENE: "color-suite",
    BENCHMARK_COLOR_TEST: test,
    BENCHMARK_COLOR_CONVERTER: converter,
    BENCHMARK_SWS_FILTER: swsFilter,
    BENCHMARK_SURFACE_MODE: "direct-raster",
    BENCHMARK_PROTOCOL_TRANSPORT: "file",
    BENCHMARK_PROTOCOL_BATCH_FRAMES: "1",
    BENCHMARK_OUTPUT: outputPath,
    BENCHMARK_COMPARE_COLOR: converter === "libyuv" ? "true" : "false",
    NEONIX_X264_CRF: encoderCrf,
  };
  const result = await run(pnpm, ["--filter", "@motionvideo/export-renderer", "exec", "tsx", "src/benchmark-native-skia-command-cpu.ts"], { env });
  if (result.code !== 0) throw new Error(`Native ${test}/${variant}/${mode} failed: ${result.stderr.slice(-4000)}`);
  return lastJson(result.stdout);
}

async function readRawPng(path: string): Promise<RawImage> {
  const result = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: result.data, width: result.info.width, height: result.info.height, channels: result.info.channels };
}

function readPpmToken(bytes: Buffer, start: number): { token: string; next: number } {
  let cursor = start;
  while (cursor < bytes.length) {
    const value = bytes[cursor];
    if (value === 35) {
      while (cursor < bytes.length && bytes[cursor] !== 10) cursor += 1;
      continue;
    }
    if (value === 9 || value === 10 || value === 11 || value === 12 || value === 13 || value === 32) {
      cursor += 1;
      continue;
    }
    break;
  }
  const begin = cursor;
  while (cursor < bytes.length) {
    const value = bytes[cursor];
    if (value === 9 || value === 10 || value === 11 || value === 12 || value === 13 || value === 32 || value === 35) break;
    cursor += 1;
  }
  return { token: bytes.subarray(begin, cursor).toString("ascii"), next: cursor };
}

async function ppmToPng(ppmPath: string, pngPath: string): Promise<void> {
  const bytes = await readFile(ppmPath);
  const magic = readPpmToken(bytes, 0);
  const widthToken = readPpmToken(bytes, magic.next);
  const heightToken = readPpmToken(bytes, widthToken.next);
  const maxValueToken = readPpmToken(bytes, heightToken.next);
  const ppmWidth = Number(widthToken.token);
  const ppmHeight = Number(heightToken.token);
  const maxValue = Number(maxValueToken.token);
  if (magic.token !== "P6" || ppmWidth !== width || ppmHeight !== height || maxValue !== 255) {
    throw new Error(`Unsupported PPM header in ${ppmPath}: ${magic.token} ${ppmWidth}x${ppmHeight} max=${maxValue}`);
  }
  let pixelStart = maxValueToken.next;
  if (pixelStart < bytes.length && [9, 10, 11, 12, 13, 32].includes(bytes[pixelStart])) pixelStart += 1;
  const rgbLength = ppmWidth * ppmHeight * 3;
  if (bytes.length - pixelStart < rgbLength) {
    throw new Error(`Truncated PPM in ${ppmPath}: expected ${rgbLength} RGB bytes, got ${bytes.length - pixelStart}`);
  }
  const rgba = Buffer.allocUnsafe(ppmWidth * ppmHeight * 4);
  const rgb = bytes.subarray(pixelStart, pixelStart + rgbLength);
  for (let source = 0, target = 0; source < rgb.length; source += 3, target += 4) {
    rgba[target] = rgb[source];
    rgba[target + 1] = rgb[source + 1];
    rgba[target + 2] = rgb[source + 2];
    rgba[target + 3] = 255;
  }
  await sharp(rgba, { raw: { width: ppmWidth, height: ppmHeight, channels: 4 } }).png().toFile(pngPath);
}

async function decodeSampled(path: string): Promise<RawImage> {
  const result = await runBinary(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-i", path,
    "-vf", "fps=1,format=rgba", "-frames:v", String(durationSeconds),
    "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
  ]);
  if (result.code !== 0) throw new Error(`Decode failed for ${path}: ${result.stderr}`);
  return { data: result.stdout, width, height, channels: 4, frames: durationSeconds };
}

async function probe(path: string): Promise<Record<string, unknown>> {
  const result = await run(ffprobePath, [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,pix_fmt,color_range,color_space,color_primaries,color_transfer,chroma_location,width,height,r_frame_rate,nb_frames,duration",
    "-of", "json", path,
  ]);
  if (result.code !== 0) throw new Error(`ffprobe failed for ${path}: ${result.stderr}`);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function srgbToLinear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r); const lg = srgbToLinear(g); const lb = srgbToLinear(b);
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750);
  const z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;
  const f = (value: number) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = f(x); const fy = f(y); const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(left: Buffer, leftOffset: number, right: Buffer, rightOffset: number): number {
  const a = rgbToLab(left[leftOffset], left[leftOffset + 1], left[leftOffset + 2]);
  const b = rgbToLab(right[rightOffset], right[rightOffset + 1], right[rightOffset + 2]);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function samplePoints(test: ColorTest): Array<[number, number]> {
  if (test === "primary") return [240, 600, 960, 1320, 1680].map((x) => [x, 540]);
  if (test === "memory") return [0, 1, 2, 3].flatMap((column) => [[280 + column * 450, 320], [280 + column * 450, 700]]);
  if (test === "grayscale") return Array.from({ length: 16 }, (_, index) => [98 + index * 114, 540]);
  if (test === "alpha") return [[100, 100], [540, 440], [1380, 440], [540, 850], [1380, 850]];
  if (test === "chroma") return Array.from({ length: 24 }, (_, index) => [Math.min(1910, 80 + index * 80), 540]);
  return Array.from({ length: 8 }, (_, index) => [260 + (index % 4) * 460, 330 + Math.floor(index / 4) * 420]);
}

function compareRaw(source: RawImage, decoded: RawImage, test: ColorTest): Record<string, number> {
  const sourceFrameBytes = source.width * source.height * 4;
  const decodedFrameBytes = decoded.width * decoded.height * 4;
  const frameCount = Math.max(1, Math.min(source.frames ?? 1, decoded.frames ?? 1));
  let sum = 0; let sumSquared = 0; let samples = 0; let exactSamples = 0; let within1Samples = 0; let within2Samples = 0; let maxAbsDiff = 0;
  let lumaLeft = 0; let lumaRight = 0; let lumaLeftSquared = 0; let lumaRightSquared = 0; let lumaProduct = 0;
  const colorErrors: number[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sourceFrameOffset = (source.frames ?? 1) === 1 ? 0 : frame * sourceFrameBytes;
    const decodedFrameOffset = (decoded.frames ?? 1) === 1 ? 0 : frame * decodedFrameBytes;
    for (let pixel = 0; pixel < sourceFrameBytes; pixel += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        const difference = source.data[sourceFrameOffset + pixel + channel] - decoded.data[decodedFrameOffset + pixel + channel];
        const absoluteDifference = Math.abs(difference);
        sum += absoluteDifference; sumSquared += difference * difference; samples += 1;
        if (absoluteDifference === 0) exactSamples += 1;
        if (absoluteDifference <= 1) within1Samples += 1;
        if (absoluteDifference <= 2) within2Samples += 1;
        if (absoluteDifference > maxAbsDiff) maxAbsDiff = absoluteDifference;
      }
      const leftLuma = source.data[sourceFrameOffset + pixel] * 0.2126 + source.data[sourceFrameOffset + pixel + 1] * 0.7152 + source.data[sourceFrameOffset + pixel + 2] * 0.0722;
      const rightLuma = decoded.data[decodedFrameOffset + pixel] * 0.2126 + decoded.data[decodedFrameOffset + pixel + 1] * 0.7152 + decoded.data[decodedFrameOffset + pixel + 2] * 0.0722;
      lumaLeft += leftLuma; lumaRight += rightLuma; lumaLeftSquared += leftLuma * leftLuma; lumaRightSquared += rightLuma * rightLuma; lumaProduct += leftLuma * rightLuma;
    }
    for (const [x, y] of samplePoints(test)) {
      const offset = (y * source.width + x) * 4;
      colorErrors.push(deltaE(source.data, sourceFrameOffset + offset, decoded.data, decodedFrameOffset + offset));
    }
  }
  const pixelCount = source.width * source.height * frameCount;
  const channelMse = sumSquared / samples;
  const meanLeft = lumaLeft / pixelCount; const meanRight = lumaRight / pixelCount;
  const covariance = lumaProduct / pixelCount - meanLeft * meanRight;
  const varianceLeft = lumaLeftSquared / pixelCount - meanLeft * meanLeft;
  const varianceRight = lumaRightSquared / pixelCount - meanRight * meanRight;
  const c1 = Math.pow(0.01 * 255, 2); const c2 = Math.pow(0.03 * 255, 2);
  const globalLumaSsim = ((2 * meanLeft * meanRight + c1) * (2 * covariance + c2)) / ((meanLeft * meanLeft + meanRight * meanRight + c1) * (varianceLeft + varianceRight + c2));
  colorErrors.sort((a, b) => a - b);
  const percentile = (fraction: number) => colorErrors[Math.min(colorErrors.length - 1, Math.floor(fraction * (colorErrors.length - 1)))] ?? 0;
  return {
    frameCount,
    rgbMeanAbsDiff: sum / samples,
    rgbMse: channelMse,
    rgbPsnrDb: channelMse === 0 ? 99 : 10 * Math.log10((255 * 255) / channelMse),
    exactPercent: (exactSamples / samples) * 100,
    within1Percent: (within1Samples / samples) * 100,
    within2Percent: (within2Samples / samples) * 100,
    maxAbsDiff,
    globalLumaSsim,
    deltaEMean: colorErrors.reduce((total, value) => total + value, 0) / Math.max(1, colorErrors.length),
    deltaEP95: percentile(0.95),
    deltaEMax: colorErrors.at(-1) ?? 0,
  };
}

function pngContract(image: RawImage, test: ColorTest): Record<string, unknown> {
  const errors: string[] = [];
  if (image.width !== width || image.height !== height || image.channels !== 4) errors.push("dimensions-or-channels");
  let transparent = 0;
  for (let index = 3; index < image.data.length; index += 4) if (image.data[index] !== 255) transparent += 1;
  if (transparent > 0) errors.push("unexpected-alpha");
  const expected = test === "primary"
    ? [[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255]]
    : test === "memory"
      ? [[246, 199, 168], [54, 168, 82], [198, 134, 66], [74, 163, 223], [141, 85, 36], [244, 211, 94], [74, 44, 32], [217, 217, 217]]
      : test === "grayscale"
        ? Array.from({ length: 16 }, (_, index) => { const value = Math.round(index * 255 / 15); return [value, value, value]; })
        : test === "chroma"
          ? Array.from({ length: 24 }, (_, index) => index % 2 === 0 ? [255, 0, 0] : [0, 0, 255])
          : null;
  const samples = samplePoints(test).map(([x, y], index) => {
    const offset = (y * image.width + x) * 4;
    const rgba = [...image.data.subarray(offset, offset + 4)];
    const expectedRgb = expected?.[index];
    if (expectedRgb && expectedRgb.some((value, channel) => Math.abs(rgba[channel] - value) > 1)) errors.push(`sample-${index}-unexpected-rgb`);
    return { x, y, rgba, expectedRgb };
  });
  return { pass: errors.length === 0, errors, samples };
}

function metadataContract(metadata: Record<string, unknown>): { pass: boolean; errors: string[] } {
  const stream = (metadata.streams as Array<Record<string, unknown>> | undefined)?.[0] ?? {};
  const checks: Array<[string, unknown, unknown[]]> = [
    ["codec_name", stream.codec_name, ["h264"]],
    ["pix_fmt", stream.pix_fmt, ["yuv420p"]],
    ["color_range", stream.color_range, ["tv", "mpeg"]],
    ["color_space", stream.color_space, ["bt709"]],
    ["color_primaries", stream.color_primaries, ["bt709"]],
    ["color_transfer", stream.color_transfer, ["bt709"]],
    ["chroma_location", stream.chroma_location, ["center", "left"]],
  ];
  const errors = checks.filter(([, value, accepted]) => !accepted.includes(value)).map(([key, value]) => `${key}=${String(value)}`);
  if (stream.width !== width || stream.height !== height) errors.push("dimensions");
  return { pass: errors.length === 0, errors };
}

async function main(): Promise<void> {
  await mkdir(artifactRoot, { recursive: true });
  const report: Record<string, unknown> = {
    suite: "mp4-color-suite-5s",
    durationSeconds,
    width,
    height,
    fps,
    matrix: "bt709",
    range: "limited",
    pixelFormat: "yuv420p",
    encoder: `libx264 veryfast crf=${encoderCrf}`,
    tests: {},
  };
  const testReports: Record<string, unknown> = {};
  for (const test of tests) {
    const testDir = resolve(artifactRoot, test);
    await mkdir(testDir, { recursive: true });
    const ppmPath = resolve(testDir, `${test}.ppm`);
    const pngPath = resolve(testDir, `${test}.png`);
    await renderNative(test, "libswscale-area", "render-only", ppmPath);
    await ppmToPng(ppmPath, pngPath);
    const source = await readRawPng(pngPath);
    const testReport: Record<string, unknown> = { png: pngContract(source, test), variants: {} };
    const decodedByVariant: Partial<Record<Variant, RawImage>> = {};
    for (const variant of variants) {
      const mp4Path = resolve(testDir, `${variant}.mp4`);
      const nativeMetrics = await renderNative(test, variant, "in-process", mp4Path);
      const metadata = await probe(mp4Path);
      const decoded = await decodeSampled(mp4Path);
      decodedByVariant[variant] = decoded;
      const metadataResult = metadataContract(metadata);
      const sourceComparison = compareRaw(source, decoded, test);
      const qualityPass = metadataResult.pass && sourceComparison.rgbPsnrDb >= 38 && sourceComparison.globalLumaSsim >= 0.990 && sourceComparison.deltaEP95 <= 2;
      testReport.variants = {
        ...(testReport.variants as Record<string, unknown>),
        [variant]: {
          fileBytes: (await stat(mp4Path)).size,
          metadata,
          metadataContract: metadataResult,
          nativeMetrics,
          sourceComparison,
          qualityPass,
        },
      };
    }
    const candidate = decodedByVariant.libyuv;
    const reference = decodedByVariant["libswscale-area"];
    if (candidate && reference) {
      const libyuvVsAreaDecoded = compareRaw(reference, candidate, test);
      testReport.libyuvVsAreaDecoded = libyuvVsAreaDecoded;
      const libyuvVariant = (testReport.variants as Record<string, Record<string, unknown>>).libyuv;
      const libyuvSourceComparison = libyuvVariant?.sourceComparison as Record<string, number> | undefined;
      // The user's PSNR criterion is evaluated against the libswscale-area
      // reference MP4. This isolates converter behavior from the irreversible
      // RGB -> 4:2:0 loss present when comparing directly with the PNG.
      testReport.libyuvMp4Quality = {
        reference: "libswscale-area decoded MP4",
        psnrDb: libyuvVsAreaDecoded.rgbPsnrDb,
        ssim: libyuvVsAreaDecoded.globalLumaSsim,
        deltaEP95AgainstPng: libyuvSourceComparison?.deltaEP95 ?? null,
        pass: libyuvVsAreaDecoded.rgbPsnrDb >= 40 &&
          libyuvVsAreaDecoded.globalLumaSsim >= 0.990 &&
          (libyuvSourceComparison?.deltaEP95 ?? Number.POSITIVE_INFINITY) <= 2,
      };
      // The decoded RGB comparison is diagnostic only: even lossless H.264
      // still has 4:2:0 chroma reconstruction differences. The converter
      // contract is evaluated from native Y/U/V before encoding.
      const nativeMetrics = (testReport.variants as Record<string, { nativeMetrics?: Record<string, unknown> }>).libyuv?.nativeMetrics;
      const nativeInner = nativeMetrics?.nativeMetrics as Record<string, unknown> | undefined;
      const nativeComparison = nativeInner?.colorComparison as Record<string, number> | undefined;
      const nativeWithin1Percent = nativeComparison && nativeComparison.samples > 0
        ? (nativeComparison.within1Samples / nativeComparison.samples) * 100
        : 0;
      testReport.libyuvNativeParity = {
        reference: "libswscale-area",
        within1Percent: nativeWithin1Percent,
        maxAbsDiff: nativeComparison?.maxAbsDiff ?? null,
        samples: nativeComparison?.samples ?? 0,
        pass: nativeWithin1Percent >= 99.9 && (nativeComparison?.maxAbsDiff ?? Number.POSITIVE_INFINITY) <= 1,
      };
      testReport.libyuvParityPass = (testReport.libyuvNativeParity as { pass: boolean }).pass;
    }
    testReports[test] = testReport;
  }
  report.tests = testReports;
  const allVariants = Object.values(testReports).flatMap((value) => Object.values((value as { variants: Record<string, { qualityPass?: boolean }> }).variants));
  report.qualityPass = Object.values(testReports).every((value) => (value as { libyuvMp4Quality?: { pass?: boolean } }).libyuvMp4Quality?.pass === true);
  report.parityPass = Object.values(testReports).every((value) => (value as { libyuvParityPass?: boolean }).libyuvParityPass === true);
  report.pngPass = Object.values(testReports).every((value) => (value as { png?: { pass?: boolean } }).png?.pass === true);
  report.pass = report.pngPass === true && report.qualityPass === true && report.parityPass === true;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath, artifactRoot, suite: report.suite }));
  if (report.pass !== true && process.env.COLOR_SUITE_ENFORCE !== "false") throw new Error(`mp4-color-suite quality gate failed; see ${reportPath}`);
}

await main();
