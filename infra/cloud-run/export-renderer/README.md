# Neonix Cloud Run export-renderer

## Directory layout

- `skia-command-cpu-bench/` — **production**. This is the only Dockerfile
  `deploy.ps1` builds and deploys. It owns its own copy of
  `neonix_skia_target.gni` (the Skia GN target definition appended to
  `BUILD.gn` during the build), trimmed to the single
  `neonix_skia_command_cpu_backend_libyuv` target this Dockerfile builds, so
  it never depends on `_archive/`. The image is CPU-only: `gn gen` sets
  `skia_use_vulkan=false skia_enable_ganesh=false`, and no GPU device is ever
  created. There is no GPU export path anywhere in this infra tree.
- `_archive/*` — historical benchmark/POC Dockerfiles (`canvaskit-cpu-bench`,
  `libyuv-color-contract`, `skia-command-cpu-libyuv-sandbox`,
  `skia-cpu-bench`). None of these are built by CI or `deploy.ps1`; they are
  kept only because dated reports under `docs/benchmark/` reference the
  measurements taken from them. The GPU-only benchmarks that used to live here
  (`gpu-probe`, `skia-gpu-poc`) have been deleted outright, along with
  `infra/gce/skia-gpu-l4-bench/` (a standalone, unreferenced GCE GPU probe) and
  `packages/skia-renderer/native/skia_gpu_backend.cpp` — git history still has
  them if needed.

The production shape is now **two separate images**, split along the
render-native (pure render) / render-worker (job orchestration) / control-plane
package boundary (see `ARCHITECHTURE.md`'s package table for the full
reasoning):

- **Job** (`neonix-render-job`) — built from this directory's
  `skia-command-cpu-bench/Dockerfile`, entrypoint is
  `packages/render-worker/src/render-job.ts` (bundled to `dist/render-job.js`).
  One task per render, concurrency/parallelism `1`.
- **Service** (`neonix-export-renderer`, the control plane) — built from
  `../export-renderer-control-plane/Dockerfile`, a separate, much smaller image with no Skia/FFmpeg
  build stage. Its own `deploy.ps1` lives in that directory.

Each image is built and deployed independently now (`deploy.ps1` here only
builds/deploys the Job); there is no longer one shared image serving both
roles.

The Job claims its lease through **Neon** (`DATABASE_URL`, plain `pg`, not
Supabase - see `packages/render-worker`), reads the immutable
`render_jobs.runtime_json`, renders to `/tmp/neonix-export`, verifies
frame/audio topology with `ffprobe` (`render-native`'s `verifyRenderOutput`),
uploads to R2 using a temporary key, verifies the final key, updates the row,
and exits. The final MP4 is never treated as a container-local artifact.

The previously-planned distributed chunk-render feature (Chunk Job, Finalizer
Job, per-chunk R2 publication) has been deleted outright, not just disabled -
it was gated behind `RENDER_CHUNK_EXECUTION_ENABLED=false` in every
environment and never shipped. `render-chunk-job.ts`/`render-finalizer-job.ts`/
`runtime-manifest.ts`/`chunk-manifest.ts`/`retry-policy.ts` are gone; git
history has them if this is ever revisited.

## Build and publish

From the repository root, enable `run.googleapis.com`,
`artifactregistry.googleapis.com`, and `secretmanager.googleapis.com`, then
build with `--platform linux/amd64`, push an image tagged with the git SHA, and
record the Artifact Registry digest. Use `deploy.ps1` for this flow.

Deploy by digest, not by `latest`.

## Native Skia CPU production worker

The native command-buffer worker is the production export image. CanvasKit is
not part of the MP4 export path; it remains a browser preview dependency and a
historical benchmark reference only:

- Production image: `skia-command-cpu-bench:20260917-libyuv-production`
- Production converter: pinned `libyuv` (`2dd4257364d39c38d79465c4ddc4b93137fe729b`)
- Production binary: `neonix_skia_command_cpu_backend_libyuv`
- Production contract: in-process FFmpeg, direct raster surface, BT.709,
  limited-range YUV420P, `libx264`/`veryfast`
- Sandbox image: `skia-command-cpu-libyuv-sandbox:20260917`
- Sandbox fallback binary: `neonix-skia-command-cpu-backend-swscale-sandbox`

The production native target does not link `libswscale`; the sandbox target
links both converters for A/B and fallback tests. The immutable digests and
Cloud Run smoke evidence are recorded in
`docs/benchmark/libyuv-production-rollout-2026-09-17.md`.

The default `deploy.ps1` build must use
`infra/cloud-run/export-renderer/skia-command-cpu-bench/Dockerfile`, and the
production render job invokes the native export adapter. Do not set
`RENDER_BACKEND` to select another renderer; there is no CanvasKit export
fallback. Audio/video/image/effect manifests that are not yet supported by the
native command protocol fail explicitly and remain outside the production
acceptance set until parity is implemented.

The native sandbox Job must use the native image and the same runtime secrets as
the normal worker, but must have a distinct Job name. This keeps a failed
native experiment from changing the production CanvasKit worker:

```powershell
gcloud run jobs create neonix-render-native-e2e `
  --image <native-image-digest> `
  --region asia-southeast1 `
  --tasks 1 --parallelism 1 --cpu 4 --memory 16Gi `
  --set-secrets DATABASE_URL=neonix-database-url:latest,R2_ACCOUNT_ID=neonix-r2-account-id:latest,R2_ACCESS_KEY_ID=neonix-r2-access-key:latest,R2_SECRET_ACCESS_KEY=neonix-r2-secret-key:latest

gcloud run jobs execute neonix-render-native-e2e `
  --region asia-southeast1 --update-env-vars RENDER_JOB_ID=<job-id>
```

The `<job-id>` must already exist in Neon's `render_jobs` table with an inline
`runtime_json` for the 5-second visual-only fixture. The worker claims that
row, renders the MP4 with native Skia/libyuv/in-process FFmpeg, verifies it,
publishes it to R2, and updates the row. API/MCP creation and queue wake-up
can be tested against the same row without changing the worker contract.

The native command-buffer flow is:

```text
RuntimeProjectV3
  -> shared frame evaluator
  -> PaintCommandBuffer
  -> versioned native command protocol
  -> Skia Native CPU raster
  -> libyuv BT.709 limited-range YUV420P
  -> in-process libx264 / MP4 mux
  -> verified artifact
```

CanvasKit remains the browser preview backend only. The native worker is the
only MP4 source of truth.

## Runtime secrets

The Job needs these values at runtime and they must come from Secret Manager:

`DATABASE_URL` (Neon), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, and either `R2_USER_EXPORTS_BUCKET` or `R2_BUCKET`.

The control-plane Service (deployed separately, see `../export-renderer-control-plane/`) needs
`INTERNAL_WORKER_TOKEN` to accept requests from `apps/api`.

The Cloud Run runtime service account should have only
`roles/secretmanager.secretAccessor` on these secrets, plus
`roles/run.jobsExecutor`/`roles/run.jobsExecutorWithOverrides` on the Job (this
script grants both automatically). R2 permissions are controlled by the scoped
R2 API token, not by Google IAM.

## Deploy

This directory's `deploy.ps1` builds/pushes the render Job image and deploys
only the Job (`-Deploy`) - the control-plane Service is a separate image with
its own `../export-renderer-control-plane/deploy.ps1`, run independently:

```powershell
.\infra\cloud-run\export-renderer\deploy.ps1 -ProjectId neonix-506607 -Deploy `
  -RuntimeServiceAccount neonix-renderer@neonix-506607.iam.gserviceaccount.com `
  -DatabaseUrlSecret neonix-database-url `
  -R2AccountIdSecret neonix-r2-account-id `
  -R2AccessKeySecret neonix-r2-access-key `
  -R2SecretKeySecret neonix-r2-secret-key `
  -R2AssetsBucket neonix-user-assets `
  -R2ExportsBucket neonix-user-exports

.\infra\cloud-run\export-renderer-control-plane\deploy.ps1 -ProjectId neonix-506607 -Deploy `
  -RuntimeServiceAccount neonix-renderer@neonix-506607.iam.gserviceaccount.com `
  -InternalWorkerTokenSecret neonix-internal-worker-token
```

Run a Job only after a queued render_jobs row exists in Neon:

```powershell
gcloud run jobs execute neonix-render-job --region asia-southeast1 `
  --update-env-vars RENDER_JOB_ID=rnd_example
```
