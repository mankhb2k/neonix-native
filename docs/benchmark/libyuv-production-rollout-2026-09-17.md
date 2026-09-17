# libyuv production rollout — 2026-09-17

## Decision

`libyuv` is promoted to the native Skia CPU production worker. `libswscale`
is retained only in the sandbox image as the fallback and A/B reference.

The rollout is scoped to the native command-buffer worker. The general
`packages/export-renderer` Cloud Run image still uses its existing CanvasKit
path until the full RuntimeProjectV3 asset protocol is wired to the native
worker.

## Immutable artifacts

| Role | Image | Digest | Cloud Run job |
|---|---|---|---|
| Native production | `skia-command-cpu-bench:20260917-libyuv-production` | `sha256:99c65978b1edc01107cba0fd4dd0e43e5f6ebb9e3148ae19674f6bfa6208b23c` | `neonix-skia-command-cpu-bench-r4` |
| Sandbox A/B/fallback | `skia-command-cpu-libyuv-sandbox:20260917` | `sha256:abfe0088539c2ea0dde3334e13f35b4b3db0876319001d3340097e4eb084f513` | `neonix-skia-command-cpu-libyuv-sandbox` |

Both images target `linux/amd64`, Cloud Run region `asia-southeast1`, and the
native jobs use 4 vCPU / 16 GiB.

## Production contract

- Native target: `neonix_skia_command_cpu_backend_libyuv`.
- Compile defines: `NEONIX_ENABLE_LIBYUV`, `NEONIX_LIBYUV_ONLY`.
- No `libswscale-dev` in the production builder and no `libswscale` link in
  the production target.
- Pinned libyuv revision:
  `2dd4257364d39c38d79465c4ddc4b93137fe729b`.
- In-process FFmpeg `libx264`, preset `veryfast`, `yuv420p`.
- Native surface: direct raster, opaque sRGB.
- Video metadata: BT.709, limited range.
- The native runtime copies `libyuv.so` into `/opt/ffmpeg-compat`; this was
  required because the libyuv build produced a shared object in Cloud Build.

## Cloud Run smoke evidence

Execution: `neonix-skia-command-cpu-bench-r4-nfhd4`

The 1-second/30-frame smoke produced a real MP4 and exited successfully:

| Metric | Result |
|---|---:|
| Converter | `libyuv` |
| Surface | `direct-raster` |
| Native process | 540.795 ms |
| Color conversion | 27.200 ms |
| Encode | 90.556 ms |
| MP4 size | 9,930 bytes |
| Native YUV hash | `3758788d` |
| Video color | BT.709 / limited |
| Alpha invariant | opaque |

The 4-vCPU production job is configured for the 60-second benchmark defaults:
1,800 frames, in-process encoding, file protocol transport, and direct raster.

Full benchmark execution: `neonix-skia-command-cpu-bench-r4-xngmq`

| Metric | Result |
|---|---:|
| Frames / duration | 1,800 / 60 s |
| Application wall | 13,914.834 ms |
| Native process | 12,771.794 ms |
| Native raster render | 7,149.592 ms |
| Readback | 0 ms (direct raster) |
| libyuv conversion | 1,643.989 ms |
| libx264 encode | 3,645.518 ms |
| Mux | 60.483 ms |
| Finalize | 48.958 ms |
| MP4 size | 357,166 bytes |
| YUV sample hash | `3758788d` (frame 0/mid/last) |

This is a successful real 60-second MP4 export on the 4-vCPU Cloud Run job;
it is the production-native baseline for future optimization comparisons.

## Cold-start timing

Execution: `neonix-skia-command-cpu-bench-r4-xngmq`

| Cloud Run event | UTC | From execution creation |
|---|---|---:|
| Execution created | 06:59:33.547201 | 0 ms |
| Container image imported/ready | 06:59:34.398800 | 852 ms |
| Resources available | 06:59:34.841036 | 1,294 ms |
| Execution start time | 06:59:38.130157 | 4,583 ms |
| Cloud Run `Started` condition | 06:59:42.203348 | 8,656 ms |

Therefore the measured cold-start upper bound from job acceptance to Cloud Run's
`Started` condition is **8.66 seconds**. The container was ready after about
**0.85 seconds**, and the execution start timestamp was about **4.58 seconds**
after creation. The current benchmark does not emit a dedicated first-user-code
timestamp, so the exact Node-entry-to-first-frame interval is not claimed here;
that should be added as a separate instrumentation point if it becomes a
production SLO.

## Sandbox evidence

Execution: `neonix-skia-command-cpu-libyuv-sandbox-n4fvm`

The sandbox ran libyuv with the libswscale reference enabled over 9,331,200
Y/U/V samples:

- exact: 54.69%
- within ±1: 99.503%
- mean absolute difference: 0.487
- Y max difference: 1
- U/V max difference: 14 (chroma rounding difference)

The fallback binary was then executed explicitly:

Execution: `neonix-skia-command-cpu-libyuv-sandbox-qbnh8`

- binary: `neonix-skia-command-cpu-backend-swscale-sandbox`
- converter: `swscale`
- MP4 output: successful, 6,330 bytes for the 1-second smoke
- native color conversion: 260.019 ms

The sandbox remains the place to run the full six-fixture MP4 color suite and
future regression tests. The small smoke comparison above is diagnostic; it
is not a replacement for the existing full-suite quality/parity gates.

## Issues found and fixed during rollout

1. The first production build failed because `swsFilter_` was still assigned
   after the member had been compiled out. The assignment is now guarded.
2. The first image built successfully but failed at startup because the
   runtime did not contain `libyuv.so`. The production Dockerfile now copies
   the shared object into the native compatibility directory.
3. The harness passed `--sws-filter` to libyuv-only binaries. It now passes
   that option only for the sandbox `swscale` converter.
4. PowerShell comma parsing combined multiple Cloud Run env values into one
   value during the first smoke. The job was corrected with a custom
   delimiter and the manifest uses one explicit env entry per variable.

## Rollback

Rollback the native job by updating its image to the previous immutable
`skia-command-cpu-bench` digest. For converter-level fallback, execute the
sandbox job with:

```text
NATIVE_SKIA_BINARY=/usr/local/bin/neonix-skia-command-cpu-backend-swscale-sandbox
BENCHMARK_COLOR_CONVERTER=swscale
```

No production binary needs to be rebuilt to run that fallback.
