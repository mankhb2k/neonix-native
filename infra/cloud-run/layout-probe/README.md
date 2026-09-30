# Neonix Cloud Run layout-probe

Measures real-browser layout geometry (border-box, padding, border - see
`@motionvideo/html-compiler`'s `layout-probe.ts`) for an already-stamped HTML
document, so `compileDocument(doc, { layoutSnapshot })` can use a
real-Chromium-measured box instead of native flex/grid/geometry resolution
for the nodes it covers. Stateless: no database/R2 access, no callback -
the caller (`apps/web/lib/server/layout-snapshot.ts`) gets the snapshot back
in the same HTTP response.

This is the first service in the repo that runs a real browser - see its
Dockerfile for why the base image differs from every other Cloud Run image
here (`node:22-bookworm-slim` + apt packages).

**Disabled by default in production.** `apps/web` only calls this service
when `LAYOUT_SNAPSHOT_ENABLED=true`; any failure (network error, timeout,
non-2xx) falls back to plain native compilation, never blocks a save.

## Local run

From the repository root:

```powershell
pnpm exec tsc --noEmit -p infra/cloud-run/layout-probe/tsconfig.json
pnpm exec tsx infra/cloud-run/layout-probe/src/server.ts
```

Required runtime variable: `INTERNAL_WORKER_TOKEN` (same shared secret every
other internal Cloud Run worker in this repo uses).

## Image and Cloud Run shape

```powershell
docker build -f infra/cloud-run/layout-probe/Dockerfile -t neonix-layout-probe:local .
docker run --rm -p 8788:8080 `
  -e INTERNAL_WORKER_TOKEN=dev-token `
  neonix-layout-probe:local
```

```powershell
curl -X POST http://localhost:8788/v1/layout/probe `
  -H "content-type: application/json" `
  -H "x-internal-worker-token: dev-token" `
  -d '{\"jobId\":\"smoke\",\"html\":\"<!doctype html>...\"}'
```

Recommended initial Cloud Run settings: concurrency `1` (one Chromium
instance per container, matches `probe-worker.ts`'s shared-browser design),
CPU `1-2`, memory `1-2Gi` (Chromium needs meaningfully more than
media-preparer's default), request timeout matched to
`LAYOUT_SNAPSHOT_TIMEOUT_MS` on the caller side plus margin, a dedicated
service account with only Secret Manager access (no R2/database - this
service touches neither). Inject `INTERNAL_WORKER_TOKEN` at runtime; never
bake it into the image.

`deploy.ps1` follows `infra/cloud-run/export-renderer/deploy.ps1`'s
build-tag-push-by-digest shape for a single Cloud Run service (no jobs -
this is always a synchronous request/response call, never queued).

## Determinism

The Dockerfile pins an exact `mcr.microsoft.com/playwright` tag (matching
the `playwright` npm dependency's version in `package.json`), never
`:latest` - a measurement this service produces gets compiled into
`project_revisions`, which are immutable, so the Chromium build behind a
given measurement must be reproducible. Bumping the Playwright version is a
deliberate action (bump both the npm dependency and the Dockerfile tag
together), not an automatic base-image update.
