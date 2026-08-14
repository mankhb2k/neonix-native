# `@motionvideo/motion-storage`

Closed-loop asset ingest: receive bytes → unique `assetId` → object store →
`AssetV1` for the project JSON. Storage does **not** own product TTL or the
user library — that belongs to the web app DB. Missing file → re-upload → new id.

See `docs/guide/asset-format-storage.md`.

## Run locally

```bash
pnpm --filter @motionvideo/motion-storage start
```

Env: see [`.env.example`](./.env.example).

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` / `MOTION_STORAGE_PORT` | `8787` | Listen port |
| `MOTION_STORAGE_PUBLIC_URL` | `http://127.0.0.1:$PORT` | Public base for upload/download URLs |
| `MOTION_STORAGE_PROVIDER` | `memory` | `memory` \| `r2` |
| `MOTION_STORAGE_API_TOKEN` | unset | Optional bearer token |
| `R2_*` | — | Required when provider=`r2` |

See `docs/guide/asset-format-storage.md`.
