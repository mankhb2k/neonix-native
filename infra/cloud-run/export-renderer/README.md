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

The production shape uses one immutable export-renderer image in three Cloud
Run roles:

- Service: authenticated health/control-plane surface on port `8080`.
- Job: one `render:job` task per render, with concurrency/parallelism `1` in
  the initial correctness baseline.
- Chunk Job: bounded indexed tasks (`taskCount` per job, configured
  `parallelism`) that render video-only frame ranges.
- Finalizer Job: one task that verifies all chunks, concatenates/remuxes once,
  verifies the final MP4 and publishes it to R2.

Every Job receives only `RENDER_JOB_ID` (Cloud Run supplies the indexed task
index for the Chunk Job). Workers claim their lease through Supabase, read the
immutable `render_jobs.runtime_json`/chunk manifest, render to
`/tmp/neonix-export`, verify frame/audio topology with `ffprobe`, upload to R2
using a temporary key, verify the final key, update Supabase, and exit. The
queue message remains only a wake-up signal containing `job_id`; Supabase is
the source of truth and R2 stores bytes only.
The final MP4 is never treated as a container-local artifact.

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
production `render:job`, chunk worker, and finalizer all invoke the same native
export adapter. Do not set `RENDER_BACKEND` to select another renderer; there
is no CanvasKit export fallback. Audio/video/image/effect manifests that are
not yet supported by the native command protocol fail explicitly and remain
outside the production acceptance set until parity is implemented.

The native sandbox Job must use the native image and the same runtime secrets as
the normal worker, but must have a distinct Job name. This keeps a failed
native experiment from changing the production CanvasKit worker:

```powershell
gcloud run jobs create neonix-render-native-e2e `
  --image <native-image-digest> `
  --region asia-southeast1 `
  --tasks 1 --parallelism 1 --cpu 4 --memory 16Gi `
  --set-secrets NEXT_PUBLIC_SUPABASE_URL=neonix-supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=neonix-supabase-service-role:latest,R2_ACCOUNT_ID=neonix-r2-account-id:latest,R2_ACCESS_KEY_ID=neonix-r2-access-key:latest,R2_SECRET_ACCESS_KEY=neonix-r2-secret-key:latest

gcloud run jobs execute neonix-render-native-e2e `
  --region asia-southeast1 --update-env-vars RENDER_JOB_ID=<job-id>
```

The `<job-id>` must already exist in Supabase with an inline
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

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and either
`R2_USER_EXPORTS_BUCKET` or `R2_BUCKET`.

The control-plane Service additionally needs `INTERNAL_WORKER_TOKEN` to accept
Job submissions from the queue worker.

The Cloud Run runtime service account should have only
`roles/secretmanager.secretAccessor` on these secrets. R2 permissions are
controlled by the scoped R2 API token, not by Google IAM.

## Deploy

`deploy.ps1` builds/pushes the image and can deploy the health Service and Job
when `-Deploy` is provided. It requires a runtime service account and Secret
Manager secret names for that mode. Actual Job execution is intentionally a
separate operation because it requires a concrete `RENDER_JOB_ID`:

```powershell
.\infra\cloud-run\export-renderer\deploy.ps1 -ProjectId neonix-506607 -Deploy `
  -RuntimeServiceAccount neonix-renderer@neonix-506607.iam.gserviceaccount.com `
  -SupabaseUrlSecret neonix-supabase-url `
  -SupabaseServiceRoleSecret neonix-supabase-service-role `
  -R2AccountIdSecret neonix-r2-account-id `
  -R2AccessKeySecret neonix-r2-access-key `
  -R2SecretKeySecret neonix-r2-secret-key `
  -InternalWorkerTokenSecret neonix-internal-worker-token `
  -R2AssetsBucket neonix-user-assets `
  -R2ExportsBucket neonix-user-exports
```

Run a Job only after a queued Supabase job exists:

```powershell
gcloud run jobs execute neonix-render-job --region asia-southeast1 `
  --update-env-vars RENDER_JOB_ID=rnd_example
```

The Phase 5 slice additionally proves the chunk lifecycle RPCs, bounded
indexed task submission, per-chunk R2 publication and finalizer path on a real
60-second video-only E2E job. Native chunk export remains sequential at the
renderer adapter until segment parity is completed. Keep `RENDER_CHUNK_EXECUTION_ENABLED=false` in
the application queue worker until the repeated Phase 6 capacity matrix,
audio-finalizer checks, failure/recovery tests and image-provenance audit in
`docs/plans/phase6-7-production-validation.md` are complete.
