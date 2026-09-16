import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { initializeRenderJobChunks, persistLargeRuntimeManifest } from "../lib/server/render/job-store";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const sourceRuntime = JSON.parse(await readFile("../../tmp/neonix-overview-60s.runtime.json", "utf8")) as Parameters<typeof initializeRenderJobChunks>[1];
  // Keep the default remote orchestration test compact. When requested, the
  // production create path uploads the complete ~77 MB fixture through the
  // private chunked runtime-manifest RPCs before initializing chunk rows.
  const fullRuntime = process.env.PHASE6_E2E_FULL_RUNTIME?.trim().toLowerCase() === "true";
  const remoteNodeIds = new Set(["stage", "stage::paint", "glow-a", "glow-a::paint", "glow-b", "glow-b::paint"]);
  const sourceFrames = sourceRuntime.visualTimeline?.frames;
  if (!sourceFrames?.length) throw new Error("60s fixture has no visual timeline frames");
  const audioEnabled = process.env.PHASE5_E2E_AUDIO?.trim().toLowerCase() === "true";
  const chunkSize = Number(process.env.PHASE5_E2E_CHUNK_SIZE ?? 300);
  const parallelism = Number(process.env.PHASE5_E2E_PARALLELISM ?? 4);
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new Error("PHASE5_E2E_CHUNK_SIZE must be a positive integer");
  if (!Number.isSafeInteger(parallelism) || parallelism < 1) throw new Error("PHASE5_E2E_PARALLELISM must be a positive integer");
  const audioKey = process.env.PHASE6_R2_MUSIC_KEY?.trim() || "media/8e92be38-57a1-4518-9fd1-cde40de5b2d7/d25c3c5f-3e15-4296-ba18-0782bc2aff88/origin.mp3";
  const runtime = (fullRuntime ? sourceRuntime : {
    ...sourceRuntime,
    visual: {
      ...sourceRuntime.visual,
      nodes: sourceRuntime.visual.nodes.filter((node) => remoteNodeIds.has(node.id)),
    },
    visualTimeline: {
      frames: sourceFrames.map((frame) => ({ nodes: frame.nodes.filter((node) => remoteNodeIds.has(node.id)) })),
    },
  }) as Parameters<typeof initializeRenderJobChunks>[1];
  const runtimeWithAudio = audioEnabled ? {
      ...runtime,
      mediaCatalog: {
        assets: [{
          mediaId: "phase5-e2e-music",
          audio: [{
            streamId: "phase5-e2e-music:audio",
            resource: { resourceId: "phase5-e2e-music:audio", role: "original", uri: `r2://${audioKey}`, mimeType: "audio/mpeg" },
            durationSamples: 5_492_736,
            sampleRate: 44_100,
            channels: 2,
            codec: "mp3",
          }],
        }],
      },
      audioTimeline: {
        sampleRate: 48_000,
        tracks: [{
          trackId: "phase5-e2e-music-track",
          gainLinear: 0.35,
          pan: 0,
          muted: false,
          clips: [{
            clipId: "phase5-e2e-music-clip",
            trackId: "phase5-e2e-music-track",
            source: { mediaId: "phase5-e2e-music", streamId: "phase5-e2e-music:audio" },
            timelineStartSample: 0,
            timelineDurationSamples: 60 * 48_000,
            sourceStartSample: 0,
            sourceEndSample: 5_492_736,
            playbackRate: 1,
            gainLinear: 1,
            pan: 0,
            muted: false,
            origin: { kind: "standalone-audio", authoringId: "phase5-e2e-music" },
          }],
        }],
      },
  } as Parameters<typeof initializeRenderJobChunks>[1] : runtime;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase environment is incomplete");
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const base = await db.from("render_jobs").select("workspace_id, project_id, revision_id, created_by").eq("public_ref", "rnd_c18b1bde8b583c940361").single();
  if (base.error || !base.data) throw new Error(`Base job lookup failed: ${base.error?.message ?? "missing"}`);
  const jobId = `rnd_phase5_${Date.now().toString(36)}`;
  const inserted = await db.from("render_jobs").insert({
    public_ref: jobId,
    workspace_id: base.data.workspace_id,
    project_id: base.data.project_id,
    revision_id: base.data.revision_id,
    status: "queued",
    preset_json: { preset: "export-1080p", projectRevision: 1 },
    idempotency_key: `phase5-e2e-${jobId}`,
    provider_render_id: jobId,
    runtime_json: fullRuntime ? null : runtimeWithAudio,
    output_key: `phase5-e2e/${jobId}.mp4`,
    progress: 0,
    stage: "queued",
    metrics_json: {},
    attempt_count: 0,
    cancel_requested: false,
    created_by: base.data.created_by,
  }).select("public_ref").single();
  if (inserted.error || !inserted.data) {
    throw new Error(`Benchmark job insert failed: ${inserted.error ? JSON.stringify(inserted.error) : "no row returned"}`);
  }
  if (fullRuntime) await persistLargeRuntimeManifest(jobId, runtimeWithAudio);
  const manifest = await initializeRenderJobChunks(jobId, runtimeWithAudio, { chunkSize, parallelism });
  console.log(JSON.stringify({ jobId, audioEnabled, fullRuntime, chunkCount: manifest.chunks.length, totalFrames: manifest.composition.totalFrames, parallelism: manifest.parallelism, checksum: manifest.checksum }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : JSON.stringify(error));
  process.exitCode = 1;
});
