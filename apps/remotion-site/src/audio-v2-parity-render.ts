/**
 * Phase 8 parity E2E: deterministic generated tone through the shared V2
 * mix plan, Remotion export, and decoded PCM assertions.
 */

import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { buildRemotionAudioPlanV2 } from "@motionvideo/remotion-renderer";
import { remotionWebpackOverride } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-audio-v2-parity");
const OUTPUT = path.join(OUT_DIR, "tone-parity.mp4");
const SAMPLE_RATE = 48000;
const TONE_DURATION = 0.5;
const COMPOSITION_DURATION = 2;

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  return String(error);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function toneWavDataUri(): string {
  const frames = Math.round(TONE_DURATION * SAMPLE_RATE);
  const channels = 1;
  const bytesPerSample = 2;
  const dataLength = frames * channels * bytesPerSample;
  const output = new ArrayBuffer(44 + dataLength);
  const view = new DataView(output);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);
  for (let frame = 0; frame < frames; frame += 1) {
    const sample = Math.sin(2 * Math.PI * 440 * frame / SAMPLE_RATE) * 0.5;
    view.setInt16(44 + frame * bytesPerSample, sample * 0x7fff, true);
  }
  return `data:audio/wav;base64,${Buffer.from(output).toString("base64")}`;
}

function createProject(): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: "remotion-audio-v2-parity",
    composition: {
      width: 320,
      height: 180,
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
    assets: [{
      id: "tone-440hz",
      kind: "audio",
      uri: toneWavDataUri(),
      mimeType: "audio/wav",
      duration: TONE_DURATION,
      sampleRate: SAMPLE_RATE,
      channels: 1,
    }],
    layers: [],
    audio: {
      sampleRate: SAMPLE_RATE,
      tracks: [{
        id: "tone-track",
        gainDb: 0,
        pan: 1,
        muted: false,
        clips: [{
          id: "tone-loop",
          assetId: "tone-440hz",
          timing: { start: 0, duration: COMPOSITION_DURATION },
          trim: { start: 0, end: TONE_DURATION },
          playbackRate: 1,
          loop: true,
          gainDb: 0,
          fadeIn: { duration: 0.5, curve: "linear" },
          fadeOut: { duration: 0.5, curve: "linear" },
        }],
      }],
    },
  };
}

function probePcm(output: string): Buffer {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", output, "-f", "s16le", "-acodec", "pcm_s16le", "-ac", "2", "-ar", String(SAMPLE_RATE), "pipe:1"],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error(`Unable to decode ${output} to PCM: ${result.stderr?.toString() ?? "unknown ffmpeg error"}`);
  }
  return result.stdout;
}

function channelRms(pcm: Buffer, startSeconds: number, endSeconds: number, channel: 0 | 1): number {
  const firstFrame = Math.max(0, Math.floor(startSeconds * SAMPLE_RATE));
  const lastFrame = Math.min(Math.floor(endSeconds * SAMPLE_RATE), Math.floor(pcm.length / 4));
  let energy = 0;
  let count = 0;
  for (let frame = firstFrame; frame < lastFrame; frame += 1) {
    const sample = pcm.readInt16LE((frame * 2 + channel) * 2) / 0x8000;
    energy += sample * sample;
    count += 1;
  }
  return count > 0 ? Math.sqrt(energy / count) : 0;
}

function isMissingBrowserError(error: unknown): boolean {
  return /chrom(e|ium)|headless.?shell|no browser|could not find a (suitable )?browser|browser ensure/i.test(
    errorText(error),
  );
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const project = createProject();
  const runtime = compileProtocolV2(project);
  const plan = buildRemotionAudioPlanV2(runtime);
  assert(plan, "Expected deterministic tone to produce an export mix plan");
  assert(plan.endSample === SAMPLE_RATE * COMPOSITION_DURATION, "Unexpected parity plan end sample");
  assert(plan.inputs.length === 1, "Expected one deterministic tone input");
  assert(
    plan.inputs[0]!.segments.map((segment) => [segment.compositionStartSample, segment.compositionEndSample]),
    "Expected deterministic tone segments",
  );
  const boundaries = plan.inputs[0]!.segments.map((segment) => segment.compositionEndSample);
  assert(boundaries.join(",") === "24000,48000,72000,96000", `Unexpected loop/fade boundaries: ${boundaries.join(",")}`);

  try {
    const serveUrl = await bundle({
      entryPoint: path.join(SITE_ROOT, "src/index.ts"),
      webpackOverride: remotionWebpackOverride,
    });
    const inputProps = { runtime };
    const composition = await selectComposition({ serveUrl, id: "MotiClipVideo", inputProps });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: OUTPUT,
      inputProps,
      scale: 1,
    });
  } catch (error) {
    if (isMissingBrowserError(error) && process.env.REMOTION_E2E_REQUIRE !== "1") {
      console.warn("[e2e] SKIP audio parity export: no Chromium");
      console.warn(errorText(error));
      return;
    }
    throw error;
  }

  const info = await stat(OUTPUT);
  assert(info.size > 1000, `Parity output is too small: ${info.size} bytes`);
  const pcm = probePcm(OUTPUT);
  const fadeInRms = channelRms(pcm, 0.05, 0.15, 1);
  const steadyRms = channelRms(pcm, 0.75, 0.95, 1);
  const fadeOutRms = channelRms(pcm, 1.85, 1.95, 1);
  const leftRms = channelRms(pcm, 0.75, 0.95, 0);
  assert(steadyRms > 0.05, `Tone steady-state RMS is too quiet: ${steadyRms}`);
  assert(steadyRms > fadeInRms * 2, `Fade-in was not preserved: ${fadeInRms} -> ${steadyRms}`);
  assert(steadyRms > fadeOutRms * 2, `Fade-out was not preserved: ${steadyRms} -> ${fadeOutRms}`);
  assert(steadyRms > leftRms * 3, `Pan-right was not preserved: left=${leftRms}, right=${steadyRms}`);
  console.log(
    `[e2e] parity passed: ${OUTPUT} (${(info.size / 1024).toFixed(1)} KB), ` +
      `rms fade-in=${fadeInRms.toFixed(4)}, steady=${steadyRms.toFixed(4)}, ` +
      `fade-out=${fadeOutRms.toFixed(4)}, left=${leftRms.toFixed(4)}`,
  );
}

main().catch((error) => {
  console.error(errorText(error));
  process.exit(1);
});
