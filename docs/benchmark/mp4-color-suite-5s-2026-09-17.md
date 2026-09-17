# MP4 Color Suite 5s - 2026-09-17

## Objective

Verify the complete color path for six fixtures:

`native Skia raster -> opaque sRGB RGBA -> libyuv/libswscale -> in-process libx264 -> MP4 -> FFmpeg decode`

The suite contains PNG source checks and MP4 encode/decode checks. The converter parity gate is measured from native Y/U/V before the lossy encoder. Decoded RGB is retained as a diagnostic metric.

## Matrix and environment

- Docker image: `asia-southeast1-docker.pkg.dev/neonix-506607/neonix/skia-command-cpu-libyuv-sandbox:20260917-color-suite-v4`
- Cloud Build: `b1fbd561-5952-4409-8f74-db75a7a45b23`, SUCCESS
- Container limit: 4 CPU, 16 GB RAM
- Backend: native Skia CPU direct-raster; no CanvasKit and no GPU
- Video: 1920x1080, 30 fps, 5 seconds, 150 frames
- Encoder: `libx264`, `preset=veryfast`
- Production run: `crf=23`
- Parity run: `crf=0` (lossless H.264 mode for converter isolation)
- Pixel format: `yuv420p`
- Color contract: sRGB RGBA input, BT.709, limited/TV range
- Fixtures: `primary`, `memory`, `grayscale`, `alpha`, `chroma`, `stride`

## PNG contract

6/6 PNG source images pass:

- 1920x1080 RGBA
- Alpha is opaque at every pixel
- Primary channel-order samples are correct
- Memory-color, grayscale-ramp, and chroma samples are correct

## Production MP4 result (CRF 23)

Report: `results/mp4-color-suite-5s-2026-09-17.json`

- 18/18 MP4 files encoded successfully
- 18/18 MP4 files decoded successfully
- 18/18 pass codec, dimensions, pixel-format, BT.709, and limited-range quality gates
- Minimum PSNR against the decoded `libswscale-area` reference: 46.155 dB
- Minimum global luma SSIM against the decoded reference: 0.999499
- Maximum sampled DeltaE p95 against the PNG source: 1.271
- `libyuv` native parity: 6/6 pass
- Native YUV parity: 100.00000% within +/-1, maximum absolute difference 1

Average native process time is recorded for context only; speed is not a decision gate for this objective.

| Converter | Native process | Color conversion |
|---|---:|---:|
| libswscale bilinear | 1,623 ms | 856 ms |
| libswscale area | 1,499 ms | 827 ms |
| libyuv | 959 ms | 161 ms |

## Lossless MP4 parity result (CRF 0)

Report: `results/mp4-color-suite-5s-lossless-2026-09-17.json`

- 18/18 MP4 files encoded successfully
- 18/18 MP4 files decoded successfully
- 6/6 PNG contracts pass
- 6/6 converter parity gates pass
- Every fixture reports 100.00000% native Y/U/V samples within +/-1
- Every fixture reports maximum native Y/U/V difference of 1
- Overall report: `pass=true`, `qualityPass=true`, `parityPass=true`

## Why decoded-RGB within +/-1 is not the converter gate

The decoded RGB within +/-1 percentage is intentionally diagnostic. Even CRF 0 H.264 still uses 4:2:0 chroma reconstruction and the decoder maps YUV back to RGB. A one-level difference in a chroma sample can therefore affect more than one RGB channel, especially on saturated red/blue edges and anti-aliased boundaries. The MP4 quality gate instead compares libyuv against the decoded libswscale-area reference, which is the allowed canonical render path.

The authoritative converter gate is the native comparison before encoding:

- Same RGBA frame
- Same BT.709 and limited-range contract
- Same source stride
- Direct comparison of Y, U, and V planes
- Requirement: at least 99.9% samples within +/-1 and maximum difference <=1

The MP4 gate is separate:

- `h264`, `yuv420p`, BT.709, limited range
- PSNR >= 40 dB against the decoded `libswscale-area` reference
- SSIM >= 0.990
- DeltaE p95 <= 2
- Successful decode and valid dimensions

## Metadata observation

`ffprobe` reports `chroma_location=left` on the H.264 output although the FFmpeg context requests `center`. Both A/B outputs have the same value and the color matrix/range metadata is correct. This is recorded as codec/container behavior and should be kept under regression watch; it is not a converter parity failure.

## Conclusion

The `libswscale` to `libyuv` migration passes the requested color objective in the correct measurement model: PNG source correctness, native YUV parity at 100% within +/-1, and successful production MP4 encode/decode with the required quality metrics. Keep the lossless run as the parity regression test and the CRF 23 run as the production quality test.

## Reproducible image validation

The final v4 image was executed without mounting the source TypeScript harness. Both runs completed with `pass=true`:

- Production: [`mp4-color-suite-5s-v4-2026-09-17.json`](./results/mp4-color-suite-5s-v4-2026-09-17.json)
- Lossless parity: [`mp4-color-suite-5s-lossless-v4-2026-09-17.json`](./results/mp4-color-suite-5s-lossless-v4-2026-09-17.json)

## Artifacts

- [`mp4-color-suite-5s-2026-09-17.json`](./results/mp4-color-suite-5s-2026-09-17.json)
- [`mp4-color-suite-5s-lossless-2026-09-17.json`](./results/mp4-color-suite-5s-lossless-2026-09-17.json)
- [`mp4-color-suite-5s-v4-2026-09-17.json`](./results/mp4-color-suite-5s-v4-2026-09-17.json)
- [`mp4-color-suite-5s-lossless-v4-2026-09-17.json`](./results/mp4-color-suite-5s-lossless-v4-2026-09-17.json)
- [`benchmark-mp4-color-suite-5s.ts`](../../packages/export-renderer/src/benchmark-mp4-color-suite-5s.ts)
- Host artifacts: `tmp/mp4-color-suite-5s/` and `tmp/mp4-color-suite-5s-lossless/`
