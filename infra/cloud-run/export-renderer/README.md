# Neonix Cloud Run export-renderer

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

The native command-buffer worker is now published separately from the
CanvasKit-based export-renderer image:

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

This native worker is currently the dedicated command-buffer benchmark/export
job (`neonix-skia-command-cpu-bench-r4`). The default `deploy.ps1` application
service/job still uses the general `packages/export-renderer/Dockerfile` and
CanvasKit path; switching that broader RuntimeProjectV3 asset path requires a
separate native protocol/asset-parity rollout.

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

CanvasKit remains the browser preview backend. It is also the transitional
Node export backend for the broader asset/audio path until the native worker
supports the complete production manifest, font/image/video resources,
effects, and audio finalization contract.

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
60-second video-only E2E job. Keep `RENDER_CHUNK_EXECUTION_ENABLED=false` in
the application queue worker until the repeated Phase 6 capacity matrix,
audio-finalizer checks, failure/recovery tests and image-provenance audit in
`docs/plans/phase6-7-production-validation.md` are complete.
