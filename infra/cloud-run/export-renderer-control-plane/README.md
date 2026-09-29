# Neonix Cloud Run export-renderer control plane

The Cloud Run **Service** role for export rendering (`neonix-export-renderer`).
A thin, deliberately dumb dispatcher with no rendering of its own:

- `POST /v1/render-job-executions` — triggers a real Cloud Run **Job**
  execution (`neonix-render-job`, built from
  `infra/cloud-run/export-renderer/skia-command-cpu-bench/Dockerfile`) with a
  `RENDER_JOB_ID` override. This is what `apps/api`'s `CloudRunService` calls.
- `POST /v1/media/prepare` — proxies into `@motionvideo/render-native`'s
  `prepareMediaJob` (ffprobe-based media derivative pipeline).
- `GET /health` / `/healthz` / `/readyz` — plain liveness check.

Both routes require `x-internal-worker-token` to match `INTERNAL_WORKER_TOKEN`.

## Why this is a separate infra package, not part of render-native

This used to be `packages/render-native/src/api/server.ts`, one file among
several roles that package played (rendering, Postgres job orchestration,
control-plane dispatch, plus a legacy in-process render/job-store path that
was already permanently disabled in production). `render-native` is now pure
rendering only; job orchestration lives in `packages/render-worker`; this
control plane - which does no rendering and needs no Skia/FFmpeg build stage -
lives here, matching how `layout-probe` and `media-preparer` are also
standalone `infra/cloud-run/*` packages rather than `packages/*` libraries.

## Build and deploy

See `deploy.ps1`. Builds a plain `node:22-bookworm-slim` image (ffmpeg only,
no native Skia build stage) and can deploy the Service with `-Deploy`. The
render Job itself is deployed separately by
`infra/cloud-run/export-renderer/deploy.ps1` - both must exist before this
Service's `/v1/render-job-executions` route can do anything, and this
Service's runtime service account needs `roles/run.jobsExecutor` +
`roles/run.jobsExecutorWithOverrides` on that Job (the Job's own `deploy.ps1`
grants both automatically).
