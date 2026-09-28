import { writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { PREVIEW_LAB_CASES } from "../lib/docs/preview-lab";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";
import { renderRuntimeProjectV3, type ExportRenderStats } from "@motionvideo/render-native";

function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
}

function requiredCase(id: string): MotionProtocolV2 {
  const fixture = PREVIEW_LAB_CASES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Preview fixture '${id}' was not found.`);
  return fixture.project;
}

function audioVideoProject(): MotionProtocolV2 {
  const video = requiredCase("video.frame-seek");
  const videoAsset = video.assets.find((asset) => asset.kind === "video");
  const videoLayer = video.layers.find((layer) => layer.type === "video");
  if (!videoAsset || videoAsset.kind !== "video" || !videoLayer || videoLayer.type !== "video") {
    throw new Error("The video preview fixture is incomplete.");
  }
  const localAudioUri = "/preview/audio/Music-MBB-Island-Tropical_128k.mp3";
  return {
    ...video,
    id: "phase9-skia-video-audio",
    assets: [
      {
        ...videoAsset,
        audio: { uri: localAudioUri, mimeType: "audio/mpeg", duration: 3_000, sampleRate: 44_100, channels: 2 },
      },
      {
        id: "phase9-music",
        kind: "audio",
        uri: localAudioUri,
        mimeType: "audio/mpeg",
        duration: 3_000,
        sampleRate: 44_100,
        channels: 2,
      },
    ],
    layers: video.layers.map((layer) => layer === videoLayer
      ? { ...layer, payload: { ...layer.payload, audio: { enabled: true, gainDb: -3, pan: 0 } } }
      : layer),
    audio: {
      sampleRate: 48_000,
      tracks: [{
        id: "phase9-music-track",
        gainDb: 0,
        pan: 0,
        muted: false,
        clips: [{
          id: "phase9-music-clip",
          assetId: "phase9-music",
          timing: { start: 0, duration: 3_000 },
          trim: { start: 0, end: 3_000 },
          playbackRate: 1,
          enabled: true,
          gainDb: -14,
          pan: 0,
        }],
      }],
    },
  };
}

const root = repoRoot();
const publicRoot = join(root, "apps", "web", "public");
const outputRoot = join(root, "tmp", "skia-export");
const frameCount = Math.max(1, Number(process.env.SKIA_EXPORT_FRAME_COUNT ?? 3));

const jobs: Array<{ name: string; project: MotionProtocolV2 }> = [
  { name: "image-meet", project: requiredCase("image.preserve-aspect-ratio.meet") },
  { name: "video-frame-seek", project: requiredCase("video.frame-seek") },
  { name: "video-audio-mix", project: audioVideoProject() },
];

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const results: ExportRenderStats[] = [];
  for (const job of jobs) {
    const runtime = await compileAndPrepareRuntimeProjectV3(job.project);
    results.push(await renderRuntimeProjectV3(runtime, {
      outputPath: join(outputRoot, `${job.name}.mp4`),
      frameCount,
      assetRoot: publicRoot,
    }));
  }
  const manifest = { phase: 9, backend: "skia-native-raster", assetRoot: publicRoot, frameCount, exports: results };
  await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

void main();
