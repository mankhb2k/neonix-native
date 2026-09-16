# Neonix native render benchmark fixtures

This directory is the canonical fixture set for the Native Skia CPU → frame bridge → FFmpeg benchmark. All fixtures use `1920x1080`, `30 fps`, and `srgb` unless a runner overrides the composition.

## Ladder

| Fixture | Duration | Scope |
| --- | ---: | --- |
| F0 | 5s / 150 frames | Solid shapes, borders, radius, gradient, clip path |
| F1 | 5s / 150 frames | Text layout, bundled font families and weights |
| F2 | 5s / 150 frames | JPEG decode, object-fit and SVG replay |
| F3 | 10s / 300 frames | CSS animation, transform, opacity and color interpolation |
| F4 | 10s / 300 frames | Blur, gradient, mask, clip path, shadow and blend mode |
| F5 | 30s / 900 frames | H.264 video plus external MP3 and encode path |
| F6 | 10s / 300 frames | Text/shape composition plus audio encode |
| F7 | 60s / 1,800 frames | Full visual composition and long-run stability |

The exact source files, expected frame counts and media metadata are in `neonix-native-benchmark-fixtures.json`.

## Measurement contract

Each run should record at least:

- process start and cold-start time;
- compile/manifest load time;
- asset resolve, image decode and video seek/decode time;
- native Skia render time per frame and total;
- RGBA readback/color conversion time;
- bridge/IPC time and bytes transferred;
- FFmpeg encode time, output size and output duration;
- peak RSS, CPU utilization and frames per second;
- errors, retries, dropped frames and output hash.

The ladder is intentionally atomic before F5–F7. If F0–F4 regress, do not attribute a F5/F7 slowdown to FFmpeg or media decoding until the isolated fixture is green.

## Compile rule

Pass the manifest `durationMs` to `compileDocument(..., { composition: { durationMs } })`. The HTML metadata describes the visual composition; audio clip duration is derived from the compile duration. Native export must register the same bundled fonts used by preview before parity is evaluated.
