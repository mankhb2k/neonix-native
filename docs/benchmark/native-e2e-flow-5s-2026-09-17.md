# Native Skia E2E flow — 5-second visual fixture

Date: 2026-09-17  
Scope: connect the real `render:job` path to the native Skia CPU backend for a
small visual-only fixture. Font, image, video, effects, and audio parity are
intentionally deferred.

## Result

The native path completed successfully in a separate Cloud Run Job and
published a verified MP4 to R2.

```text
HTML fixture
  -> compileDocument
  -> compileAndPrepareRuntimeProjectV3
  -> render_jobs.runtime_json
  -> Cloud Run Job receives RENDER_JOB_ID
  -> render_job_claim
  -> RENDER_BACKEND=native-skia-command
  -> PaintCommandBuffer protocol
  -> native Skia CPU direct raster
  -> libyuv BT.709 limited-range YUV420P
  -> in-process libx264 / MP4 mux
  -> ffprobe verification
  -> R2 temporary PUT / HEAD / COPY / HEAD
  -> render_jobs.status=done
```

## Fixture

- ID: `neonix-e2e-native-baseline-5s`
- Composition: 1920×1080, 30 FPS, 5 seconds
- Frames: 150
- Content: animated solid shapes, transforms, opacity, paths/layers
- Audio tracks: 0
- Video instances: 0
- External image/font/effect assets: none
- Native command protocol: ready
- Native parity: not claimed; parity work is a later phase

## Local container smoke test

Image: `neonix-skia-command-e2e:local`  
Runtime: Linux container, native Skia raster, libyuv, in-process FFmpeg

| Metric | Result |
|---|---:|
| Exit code | 0 |
| Frames | 150 |
| Duration | 5 s |
| Application wall | 4,072.9 ms |
| Native process | 4,033.0 ms |
| Native render | 3,346.1 ms |
| Native composite | 3,127.4 ms |
| libyuv conversion | 147.5 ms |
| Encode | 420.3 ms |
| Mux | 38.9 ms |
| Finalize | 37.6 ms |
| Output | 65,337 bytes |
| Video codec | H.264 |
| Alpha contract | opaque |
| Color contract | sRGB → BT.709 limited-range YUV420P |

The native timing fields overlap in places (for example composite is part of
the native render pipeline), so they must not be summed as an independent
wall-clock total.

## Cloud Run E2E

- Project: `neonix-506607`
- Region: `asia-southeast1`
- Job: `neonix-render-native-e2e-20260917`
- Execution: `neonix-render-native-e2e-20260917-vs6gx`
- Image: `skia-command-cpu-e2e@sha256:5a1ef6290ab3150f687b1edc79fab0c080cce86eeed63942331ac9521464bb6d`
- Resources: 4 vCPU, 16 GiB, one task, one parallel worker
- Result job: `rnd_native_e2e_mu5ciwox`
- R2 key: `native-e2e/rnd_native_e2e_mu5ciwox.mp4`

| Metric | Result |
|---|---:|
| Supabase status | `done` |
| Stage | `done` |
| Verified frames | 150 |
| Verified duration | 4.967 s |
| Verified codec | H.264 |
| Audio streams | 0 |
| Worker wall clock | 10,194 ms |
| Native render/readback | 4,293.6 ms |
| Native replay | 2,185.3 ms |
| Native flush/composite | 2,108.4 ms |
| Encode | 187.9 ms |
| Finalize | 28.7 ms |
| Published artifact | 64,185 bytes |
| R2 publication | PUT + HEAD + COPY + HEAD passed |

Cloud Run also reported first-use container overhead: image import was observed
at 32.18 seconds and deployment startup at 13.24 seconds. These control-plane
timestamps overlap the execution lifecycle and should not be added blindly to
the worker's 10.194-second wall clock. They are cold-start/image-size overhead,
not Skia render time.

## Changes that made this possible (historical snapshot)

At the time of this run, `render-job.ts` used a guarded
`RENDER_BACKEND=native-skia-command` branch and the default branch still used
CanvasKit/FFmpeg. This report is retained as evidence of the native E2E
baseline; the current code has since removed that split and makes native Skia
the only MP4 export source of truth.

- The native branch rejected audio/video fixtures explicitly until those
  contracts were implemented.
- `BENCHMARK_RUNTIME_JSON_PATH` lets the native protocol runner consume the
  immutable runtime manifest loaded from Supabase instead of a local fixture.
- A dedicated fixture and job-creation script were added for repeatable E2E
  runs.
- The Cloud Run native Job was separate from `neonix-render-job` production.

## Errors encountered and resolution

1. The first fixture used `ease-in-out`, which the HTML compiler rejected for
   this fixture surface. It was changed to `linear`; compile/audit then passed.
2. The first Cloud Run Job deployment used the Compute Engine default service
   account and was denied Secret Manager access. The Job was updated to use
   `neonix-renderer@neonix-506607.iam.gserviceaccount.com`, matching the
   existing render worker, and deployment succeeded.

## What this proves

- The native backend is reachable from the real `render:job` worker.
- Supabase remains the source of truth for the runtime and status.
- The worker can claim, render, verify, publish to R2, and commit `done`.
- The current native export path is not blocked by CanvasKit or a raw RGBA
  stdout pipe for this visual fixture.

## What this does not prove yet

- Font shaping/raster parity.
- Image decode and image color management.
- Video decode/seek/reverse/loop behavior.
- Effects, masks, blend modes, and isolated layers.
- Audio preparation, mixing, and final mux parity.
- API/MCP authenticated creation through a production queue configured to point
  at the sandbox Job. The worker-level E2E is complete; that control-plane lane
  should be run next with a staging queue/job configuration.
