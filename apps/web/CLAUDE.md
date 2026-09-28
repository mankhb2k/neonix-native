# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`apps/web` is Neonix's **control plane** — it owns product rules, durable data, and job orchestration. It does not render video, probe media, or encode MP4 itself. For the render pipeline's own packages (`motion-protocol`/`motion-compiler`/`motion-runtime`/`canvaskit-preview`/`render-native`), see the root [`ARCHITECHTURE.md`](../../ARCHITECHTURE.md). For the editor's document/command boundary, see [`README.md`](README.md) and [`lib/editor/README.md`](lib/editor/README.md). This file is about the parts those don't cover: how `apps/web` talks to Supabase/R2/Cloud Run to actually run an export or ingest an upload.

## Commands

```bash
pnpm --filter @motionvideo/web dev              # Next.js dev server → localhost:3000/dashboard
pnpm --filter @motionvideo/web typecheck        # tsc --noEmit -p tsconfig.json
pnpm --filter @motionvideo/web typecheck:editor # tsc --noEmit -p tsconfig.editor.json (faster loop)
pnpm --filter @motionvideo/web test:editor      # certified V2 editor/doc tests (vitest.editor.config.ts)
pnpm --filter @motionvideo/web exec vitest run <file>  # broad app tests (vitest.config.ts)
pnpm --filter @motionvideo/web e2e              # Playwright e2e
pnpm --filter @motionvideo/web render:queue-worker  # local render-queue-worker.ts loop
```

## Adapters (ports the control plane depends on)

| Port | Current adapter |
| --- | --- |
| Auth | Supabase Auth |
| Persistence | Supabase Postgres (RLS-protected) |
| Storage | R2 (object bytes only — Postgres never stores media bytes) |
| Render queue | PGMQ (Postgres extension) — see `supabase/migrations/20260914032511_enable_pgmq_render_jobs.sql` and `20260914032541_configure_render_jobs_queue.sql`. This is already implemented, not a future plan. |

A port is a seam, not a reason to add abstraction layers — only extend one when the app actually needs a new implementation behind it.

## Export flow

```
User / MCP create_export
  → POST /api/v1/renders — auth + ownership + quota check
  → compile Protocol V2 → RuntimeProjectV3
  → insert render_jobs row (status: queued, immutable runtime_json)
  → send PGMQ message { job_id }
  → render-queue-worker (scripts/render-queue-worker.ts, must run continuously;
    production requires RENDER_DISPATCH_MODE=cloud-run-job — this is the only
    supported production value, there is no other real dispatch target)
  → POST to the Cloud Run control service
  → one immutable image (`skia-command-cpu-bench`) running as up to 4 Cloud Run roles:
      Service (health/control, :8080) — always on
      Job (`render:job`) — default single-task path
      Chunk Job (`render:chunk-job`) + Finalizer Job (`render:finalizer-job`)
        — only when RENDER_CHUNK_EXECUTION_ENABLED=true
  → worker claims its lease via Supabase, reads render_jobs.runtime_json,
    renders with native Skia CPU raster + libyuv + libx264/FFmpeg, verifies
    with ffprobe, uploads the MP4 to R2
  → updates render_jobs.status
  → Web serves a signed, time-limited R2 URL from the download route
```

`render_jobs.status` is exactly `queued | rendering | done | failed | cancelled` (check the constraint in `supabase/migrations/20260825000000_initial_moticlip.sql` before assuming any other state name exists). The PGMQ message is only a wake-up signal carrying `job_id` — `render_jobs` in Supabase is the source of truth for manifest, lease, and progress.

CanvasKit is never part of this path — it's a browser-preview dependency only (see root `ARCHITECHTURE.md`).

**Naming gotcha:** code still labels this engine `"native-vps"` in places (`export-canary.ts`, `export-worker.ts`, several comments in `render-native`). That's legacy vocabulary from before the Cloud Run migration — there is no actual VPS in production today, only Cloud Run. Don't infer a real VPS deployment target from that string.

## Media ingest flow (separate from export)

```
Browser
  → PUT origin file + browser-generated poster.webp directly to R2 (presigned)
  → POST /api/v1/assets/upload/complete
  → Web inserts a media_jobs row (status: queued)
  → a SEPARATE Cloud Run service, infra/cloud-run/media-preparer — its own
    Dockerfile, no Skia, only reuses @motionvideo/render-native's media
    contract types — claims the job
  → runs ffprobe, creates audio.m4a when the source has an audio stream
    (worker never creates the poster — the browser already did)
  → uploads derivatives to R2 under {assetId}/poster.webp, {assetId}/audio.m4a
  → calls back POST /api/internal/media-jobs/callback (authenticated)
  → Web verifies the R2 objects, then updates media_jobs.status and
    asset_variants in one idempotent operation
```

`media_jobs.status` is `queued | processing | ready | partial | failed`. Jobs are deduplicated by `(assetId, sourceIntegrity, pipelineVersion)`. `render-native` and `media-preparer` are two separate Cloud Run deployments today, not one shared image — don't assume changing one redeploys the other.

## System asset fallback

`system_catalog.system_assets` holds placeholder assets (`system:image-placeholder`, `system:svg-placeholder`, `system:video-placeholder` + its `:poster` variant, `system:audio-silence`) in the private `neonix-system-assets`/`neonix-system-fonts` R2 buckets. When a user deletes an asset still referenced by a project, the `delete_asset_with_system_fallback` RPC swaps references to the matching-kind placeholder inside one transaction and marks the asset deleted — it never repoints a video/audio layer to an image placeholder (wrong layer type), and old revisions stay immutable.

## Boundary

The control plane decides *who* may do *what* and *which job runs*; it never draws a `Matrix4`, decodes a frame, mixes audio, or calls FFmpeg. Neither the render worker nor `media-preparer` know about users, subscriptions, workspaces, or billing rules — that's `apps/web`'s job alone.
