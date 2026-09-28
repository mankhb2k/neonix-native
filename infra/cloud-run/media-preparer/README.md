# Neonix Cloud Run media-preparer

This is the Phase 3 service boundary. It contains FFmpeg/ffprobe and reuses the
versioned `@motionvideo/render-native` media contract, but it does not contain
Skia, composition rendering, or render-job state.

The service reads the origin object from R2, probes it, creates `poster.webp`
and/or `audio.m4a`, uploads derivatives to the asset prefix, and calls the
Neonix callback. Supabase remains the source of truth; this service is stateless
apart from its ephemeral scratch directory.

## Local run

From the repository root:

```powershell
pnpm exec tsc --noEmit -p infra/cloud-run/media-preparer/tsconfig.json
pnpm exec tsx infra/cloud-run/media-preparer/src/server.ts
```

Required runtime variables are the R2 credentials, `INTERNAL_WORKER_TOKEN`, and
the usual callback/R2 settings. In production set `MEDIA_CALLBACK_HOSTS` to the
Web API host(s), for example `app.example.com`; leaving it empty is intended only
for local development.

## Image and Cloud Run shape

```powershell
docker build -f infra/cloud-run/media-preparer/Dockerfile -t neonix-media-preparer:phase3 .
docker run --rm -p 8787:8080 --env-file packages/render-native/.env `
  -e PORT=8080 `
  -e MEDIA_CALLBACK_HOSTS=host.docker.internal `
  neonix-media-preparer:phase3
```

Recommended initial Cloud Run settings are concurrency `1`, a bounded maximum
instance count, request timeout up to the asset policy, and a dedicated service
account with only R2 object access and Secret Manager access. Inject
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `INTERNAL_WORKER_TOKEN`, and callback
allow-list values at runtime; never bake them into the image.

The current Web dispatcher already targets `POST /v1/media/prepare`, so the
standalone service can replace the renderer's media endpoint without changing
the Supabase callback contract.
