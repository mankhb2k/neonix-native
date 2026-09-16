# Neonix media event Worker

This Worker is the thin adapter between R2 object-create notifications and the
Neonix Web API. It does not download media, run FFmpeg, or own media job state.
It only filters canonical `media/{workspaceId}/{assetId}/origin.*` objects,
signs the normalized event, and forwards it to `/api/internal/media-events`.

## Local typecheck

```powershell
Set-Location infra/cloudflare/media-events-worker
pnpm install --ignore-workspace
pnpm typecheck
pnpm test
```

The test command runs the Worker contract suite, including canonical-origin
filtering, malformed-event rejection, successful delivery acknowledgement and
retry behaviour.

For `wrangler dev`, copy `.dev.vars.example` to `.dev.vars` and use the same
`MEDIA_EVENT_HMAC_SECRET` in the Web app environment.

## Provisioning

Run these once in the target Cloudflare account:

```powershell
npx wrangler queues create neonix-media-events
npx wrangler queues create neonix-media-events-dlq
npx wrangler r2 bucket notification create neonix-user-assets `
  --event-type object-create `
  --queue neonix-media-events `
  --prefix media/
```

Set the endpoint and secret at deploy time; do not commit either value:

```powershell
npx wrangler secret put MEDIA_EVENT_HMAC_SECRET
npx wrangler deploy --var MEDIA_EVENTS_ENDPOINT:https://app.example.com/api/internal/media-events
```

The Queue is at-least-once. The Web API therefore validates the R2 key/size,
creates at most one `media_jobs` row per asset, claims queued/retryable jobs
atomically, and returns a retryable status when the renderer is unavailable.
The DLQ is for events that exceed the configured retry budget and must be
observed/replayed by an operator or reconciliation task.
