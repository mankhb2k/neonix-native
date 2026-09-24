# render-queue-worker container

Packages `apps/web/scripts/render-queue-worker.ts` as a standalone, long-running
container. It has no HTTP surface of its own: it polls the Supabase PGMQ
`render_jobs` queue and POSTs a dispatch request to the `export-renderer`
Cloud Run service for each job. Rendering itself always happens on Cloud Run;
this container only needs to stay alive and keep polling.

## Build

From the monorepo root (the build needs the full pnpm workspace):

```bash
docker build -f infra/render-queue-worker/Dockerfile -t neonix-render-queue-worker .
```

## Run locally (uses apps/web/.env)

```bash
docker compose -f infra/render-queue-worker/docker-compose.yml up --build
```

## Run on a VPS

```bash
docker run -d --name render-queue-worker --restart unless-stopped \
  --env-file .env \
  neonix-render-queue-worker
```

`.env` must define at least:

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — reads/writes render_jobs and the PGMQ queue.
- `EXPORT_RENDERER_URL`, `INTERNAL_WORKER_TOKEN` — where and how to dispatch a job.
- `RENDER_QUEUE_ENABLED=true`, `RENDER_DISPATCH_MODE=cloud-run-job`.

Optional tuning: `RENDER_QUEUE_POLL_MS`, `RENDER_QUEUE_VISIBILITY_TIMEOUT_SECONDS`,
`RENDER_QUEUE_MAX_ATTEMPTS`, `RENDER_QUEUE_STALE_SECONDS`,
`RENDER_QUEUE_RECOVERY_INTERVAL_MS`. See `apps/web/scripts/render-queue-worker.ts`
for defaults.

To push the built image to a registry the VPS can pull from:

```bash
docker tag neonix-render-queue-worker <registry>/neonix-render-queue-worker:latest
docker push <registry>/neonix-render-queue-worker:latest
```
