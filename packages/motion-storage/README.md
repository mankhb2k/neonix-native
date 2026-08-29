# `@motionvideo/motion-storage`

Closed-loop asset ingest: receive bytes → unique `assetId` → object store →
`StorageAsset` for the project JSON. Storage does **not** own product TTL or the
user library — that belongs to the web app DB. Missing file → re-upload → new id.

The V1 asset-storage guide was retired with the V2 hard-cut. See
[`docs/guide/v2-architechture.md`](../../docs/guide/v2-architechture.md) for
the active render pipeline boundary.

## Media ingest architecture

This package owns the asset lifecycle and the normalized media catalog used by
the compiler. It does not own Protocol semantics, Runtime evaluation, pixel
rendering, or MP4 export.

```text
Upload request
      │
      ▼
Create asset identity
      │
      ▼
Store original bytes
      │
      ▼
Media preparation job
      │
      ▼
Media Ingest Worker
      ├── ffprobe → stream and timing metadata
      └── ffmpeg  → audio-only derivative when audio exists
      │
      ▼
MediaProbeRecordV3 / Asset Catalog
      │
      ├── visual video resource → Preview / Export frame decoder
      └── audio derivative       → Playback / Export audio pipeline
```

The Web API may create the upload and enqueue the job, but a long-running
`ffprobe` or `ffmpeg` operation belongs to a worker environment such as the
native VPS worker. The upload request must not wait for media preparation to
finish.

### Probe and derivative responsibilities

`ffprobe` detects and normalizes facts from the original file:

- video and audio stream identity;
- duration and time base;
- width, height, codec, and frame rate;
- audio sample rate, channel count, and duration in samples.

`ffmpeg` creates the audio derivative. It is an audio-only, seekable resource
referenced by the original video asset. The derivative may be AAC/M4A, WAV, or
another certified format; Protocol should describe it as an audio derivative,
not assume MP3 specifically.

The original MP4 remains the visual source. We do not pre-extract every video
frame into image files. Preview and Export decode the required video frames at
the media time resolved by Runtime.

### Asset readiness

```text
queued → processing → ready
                    └→ partial  (one optional derivative failed)
                    └→ failed
```

For a video with an audio stream, `ready` for audio use means that a verified
audio derivative exists. A missing derivative must not cause the compiler or
renderer to fall back to treating the original MP4 as an audio resource.

### Handoff to Protocol and Compiler

```text
MediaProbeRecordV3
        │
        ▼
MotionProtocolV2 assets[]
        │
        ├── video asset.uri       → visual source
        └── video asset.audio.uri → audio derivative metadata
        │
        ▼
Compiler media catalog
        │
        ├── video stream reference
        └── audio-proxy stream reference
```

`motion-storage` provides facts and resource references. The Compiler decides
how `video.payload.audio` and `audio.tracks[]` become runtime audio clips. The
Runtime creates the mix plan, while Export Renderer and FFmpeg perform actual
decode, mix, and mux operations.

### Storage boundary

Originals and derivatives belong to the same asset namespace and must remain
independently addressable. Export artifacts are a separate concern and are
owned by the export pipeline and its artifact storage contract.

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

See [`docs/guide/v2-architechture.md`](../../docs/guide/v2-architechture.md).
