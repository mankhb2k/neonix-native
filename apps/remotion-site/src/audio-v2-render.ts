/**
 * Phase 7 export smoke: Atomic Protocol V2 audio -> Runtime Audio IR ->
 * Remotion audio track -> encoded MP4.
 *
 * The fixture is embedded as a data URL so this test does not depend on the
 * Next.js docs server or on a second asset delivery path.
 */

import { readFile, stat, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { remotionWebpackOverride } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const AUDIO_PATH = path.resolve(SITE_ROOT, "../../assets/music/Music-MBB-Island-Tropical_128k.mp3");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-audio-v2");
const OUTPUT = path.join(OUT_DIR, "audio-v2.mp4");
const SCALE = 0.25;

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  return String(error);
}

function isMissingBrowserError(error: unknown): boolean {
  return /chrom(e|ium)|headless.?shell|no browser|could not find a (suitable )?browser|browser ensure/i.test(
    errorText(error),
  );
}

function probeAudio(output: string): {
  codecName?: string;
  sampleRate?: number;
  channels?: number;
} | null {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name,sample_rate,channels",
      "-of",
      "json",
      output,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  const parsed = JSON.parse(result.stdout ?? "{}") as {
    streams?: Array<{ codec_name?: string; sample_rate?: string; channels?: number }>;
  };
  const stream = parsed.streams?.[0];
  if (!stream) return null;
  return {
    codecName: stream.codec_name,
    sampleRate: stream.sample_rate ? Number(stream.sample_rate) : undefined,
    channels: stream.channels,
  };
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const fixture = await readFile(AUDIO_PATH);
  const sourceUri = `data:audio/mpeg;base64,${fixture.toString("base64")}`;
  const project: MotionProtocolV2 = {
    format: "motion-protocol",
    formatVersion: 2,
    id: "remotion-audio-v2-e2e",
    composition: {
      width: 1920,
      height: 1080,
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
    assets: [
      {
        id: "audio-v2-fixture",
        kind: "audio",
        uri: sourceUri,
        mimeType: "audio/mpeg",
        duration: 124,
        sampleRate: 44100,
        channels: 2,
      },
    ],
    layers: [],
    audio: {
      sampleRate: 48000,
      tracks: [
        {
          id: "music",
          gainDb: 0,
          pan: 0,
          muted: false,
          clips: [
            {
              id: "music-clip",
              assetId: "audio-v2-fixture",
              timing: { start: 0, duration: 2 },
              trim: { start: 10, end: 12 },
              playbackRate: 1,
              loop: false,
              gainDb: -12,
              fadeIn: { duration: 0.25, curve: "linear" },
              fadeOut: { duration: 0.25, curve: "equal-power" },
            },
          ],
        },
      ],
    },
  };
  const runtime = compileProtocolV2(project);
  if (runtime.composition.duration !== 2) {
    throw new Error(`Expected Runtime V2 audio duration to be 2s, got ${runtime.composition.duration}`);
  }

  try {
    const entry = path.join(SITE_ROOT, "src/index.ts");
    console.log(`[e2e] bundling ${entry}`);
    const serveUrl = await bundle({ entryPoint: entry, webpackOverride: remotionWebpackOverride });
    const inputProps = { runtime };
    const composition = await selectComposition({ serveUrl, id: "MotiClipVideo", inputProps });
    console.log(`[e2e] rendering ${OUTPUT} (${composition.durationInFrames}f @ scale ${SCALE})`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: OUTPUT,
      inputProps,
      scale: SCALE,
    });
  } catch (error) {
    if (isMissingBrowserError(error) && process.env.REMOTION_E2E_REQUIRE !== "1") {
      console.warn("[e2e] SKIP remotion audio export: no Chromium");
      console.warn(errorText(error));
      return;
    }
    throw error;
  }

  const info = await stat(OUTPUT);
  if (info.size < 1000) throw new Error(`Remotion audio MP4 too small (${info.size} bytes)`);
  const audio = probeAudio(OUTPUT);
  if (!audio) throw new Error("Remotion output has no audio stream");
  if (audio.sampleRate !== 48000) {
    throw new Error(`Expected 48kHz export audio, got ${audio.sampleRate ?? "unknown"}`);
  }
  console.log(
    `[e2e] wrote ${OUTPUT} (${(info.size / 1024).toFixed(1)} KB, ` +
      `${audio.codecName ?? "unknown"}, ${audio.sampleRate}Hz, ${audio.channels ?? "?"}ch)`,
  );
}

main().catch((error) => {
  console.error(errorText(error));
  process.exit(1);
});
