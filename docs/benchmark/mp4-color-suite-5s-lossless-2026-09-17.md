# MP4 Color Suite 5s Lossless Parity - 2026-09-17

This is the converter-isolation run for the six-fixture MP4 color suite.

- Encoder: `libx264 veryfast crf=0`
- Reproducible image: `asia-southeast1-docker.pkg.dev/neonix-506607/neonix/skia-command-cpu-libyuv-sandbox:20260917-color-suite-v4`
- Native backend: Skia CPU direct-raster
- Container limit: 4 CPU, 16 GB RAM
- Video: 1920x1080, 30 fps, 5 seconds, 150 frames
- A/B: `libyuv` against `libswscale-area`
- Gate: native Y/U/V comparison before encode, >=99.9% within +/-1, max difference <=1

## Result

Overall: `pass=true`, `qualityPass=true`, `parityPass=true`.

| Fixture | Native samples within +/-1 | Native max difference | Decoded RGB within +/-1 (diagnostic) |
|---|---:|---:|---:|
| primary | 100.00000% | 1 | 96.29630% |
| memory | 100.00000% | 1 | 85.51826% |
| grayscale | 100.00000% | 1 | 100.00000% |
| alpha | 100.00000% | 1 | 99.94493% |
| chroma | 100.00000% | 1 | 78.24074% |
| stride | 100.00000% | 1 | 86.15323% |

The decoded RGB column is not the converter gate. H.264 4:2:0 reconstruction can expand a one-level YUV difference into several RGB channel differences. The native Y/U/V comparison is the correct 99.9% parity measurement.

Full machine-readable output:

- [`mp4-color-suite-5s-lossless-2026-09-17.json`](./results/mp4-color-suite-5s-lossless-2026-09-17.json)
- Final no-mount validation: [`mp4-color-suite-5s-lossless-v4-2026-09-17.json`](./results/mp4-color-suite-5s-lossless-v4-2026-09-17.json)
- [`mp4-color-suite-5s-2026-09-17.md`](./mp4-color-suite-5s-2026-09-17.md)
