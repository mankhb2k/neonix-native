# `@motionvideo/motion-storage`

Closed-loop asset ingest for MotiClip: receive bytes → store (memory/R2) →
emit managed `AssetV1` → resolve ephemeral URLs for compiler/export.

## Run locally

```bash
pnpm --filter @motionvideo/motion-storage start
```

Env:

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` / `MOTION_STORAGE_PORT` | `8787` | Listen port |
| `MOTION_STORAGE_PUBLIC_URL` | `http://127.0.0.1:$PORT` | Public base for upload/download URLs |
| `MOTION_STORAGE_PROVIDER` | `memory` | `memory` \| `r2` |
| `MOTION_STORAGE_API_TOKEN` | unset | Optional bearer token |
| `R2_*` | — | Required when provider=`r2` |

See `docs/guide/asset-format-storage.md`.
