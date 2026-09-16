# Native Skia CPU Export and FFmpeg Optimization Plan

Date: 2026-09-16

Status: execution plan

Related evidence:
[`render-benchmark-comprehensive-assessment.md`](./render-benchmark-comprehensive-assessment.md)

## 1. Objective

Build a production-capable Native Skia CPU export path on Cloud Run and remove
the remaining bottlenecks with measured, reversible changes.

The execution order is fixed:

```text
Complete Native Skia CPU
        |
        v
Measure renderer / IPC / color conversion / encoder separately
        |
        v
Remove the Node relay only when the A/B result justifies it
        |
        v
Use libavcodec in-process only when direct-pipe benchmarks still miss the SLO
        |
        v
Complete F0-F7 and visual parity
        |
        v
Re-evaluate GPU only after the native CPU production result exists
```

This plan treats CanvasKit as the browser preview and compatibility reference.
It does not spend another optimization cycle on CanvasKit export. GPU Vulkan
work is parked and is not part of the active implementation phases.

## 2. Current certified baseline

The controlled A/B fixture is 1920x1080, 30 FPS, 60 seconds and 1,800 frames,
running on Cloud Run with 4 vCPU, 16 GiB RAM, one task and no GPU.

| Metric | Native Skia CPU | CanvasKit-WASM CPU |
| --- | ---: | ---: |
| Runtime evaluation | 142.573 ms | 378.588 ms |
| Render plus readback | 4,698.890 ms | 142,243.210 ms |
| Raw output/backpressure | 36,372.854 ms | 5,340.374 ms |
| Application wall | 41,278.672 ms | 147,994.331 ms |
| Cloud Run execution | 62.459 s | 168.437 s |

The native result is valid only for the current command subset:

```text
beginFrame
setTransform
drawShape
endFrame
```

The 36.37-second native `rawWrite` value is not classified as pure pipe
overhead. It includes time blocked behind the Node relay, FFmpeg raw ingest,
RGBA-to-YUV420p conversion and single-threaded libx264 encoding. The first
active benchmark phase must split those costs.

## 3. Scope and non-goals

### Active scope

- Native Skia CPU command replay.
- Deterministic font and asset loading.
- Paths, text, images, SVG, layers, masks, blend modes and effects.
- Video-frame asset ingestion.
- FFmpeg input, color conversion, H.264 encoding and final mux.
- Cloud Run 4 vCPU / 16 GiB benchmarks.
- F0-F7 parity and performance fixtures.
- Chunk worker and finalizer compatibility.
- Fail-closed capability handling and production observability.

### Explicitly parked

- Cloud Run L4/Vulkan.
- GCE/GKE GPU production workers.
- NVENC.
- WebGPU or Graphite export.
- CanvasKit export performance tuning.

GPU artifacts remain in the repository for future investigation, but no GPU
work can block this plan.

### Not assumed

- Shared memory is not assumed to be faster before an A/B test.
- N-API is not assumed to be the final native boundary.
- In-process libavcodec is not assumed to be zero-copy.
- Pixel-perfect cross-backend output is not assumed merely because both
  backends use Skia.
- Enabling every Skia codec is not assumed to produce parity.

## 4. Target architecture

### 4.1 Control and render path

```text
Supabase render_jobs / runtime manifest
                |
                v
Node control-plane worker
  - claim and lease
  - download manifest/assets
  - validate capability contract
  - update status and metrics
                |
                v
Long-lived native render worker
  - versioned PaintCommandBuffer protocol
  - font and asset registration once per job
  - Skia CPU surfaces and caches
  - deterministic frame replay
                |
                v
Encoder boundary selected by evidence
  A. direct child-process pipe to FFmpeg
  B. libavcodec in the native worker, only if gate passes
                |
                v
Video-only segment
                |
                v
Existing CPU finalizer
  - audio mix
  - mux
  - verify
  - publish to R2
```

Node remains responsible for orchestration. It should not remain in the hot
RGBA data path if the direct-pipe benchmark proves that relay removal produces
a material benefit.

### 4.2 Paint protocol rules

The native protocol must be:

- versioned;
- length-delimited;
- backward-incompatible changes require a version bump;
- explicit about pixel format, alpha type and color space;
- explicit about font and asset identity;
- fail-closed for unsupported commands;
- bounded against malformed lengths and excessive allocations;
- deterministic across chunk boundaries;
- instrumented per command family.

No GPU handles, host pointers or operating-system-specific paths belong in
`RuntimeProjectV3` or `PaintCommandBuffer`.

## 5. Target SLOs and acceptance metrics

These are initial engineering gates. A threshold may only change with a
documented benchmark result and rationale.

### 5.1 Performance

Cloud Run reference machine: 4 vCPU, 16 GiB, no GPU, one task.

| Gate | Required | Stretch |
| --- | ---: | ---: |
| F0 60-second application wall | <= 30 s | <= 20 s |
| F0 native render + readback | <= 10 s | <= 6 s |
| F7 60-second single-worker wall | <= 120 s | <= 60 s |
| F7 six-chunk p4 parent wall, excluding queue delay | <= 90 s | <= 60 s |
| Finalizer wall | <= 30 s | <= 20 s |
| Warm-run coefficient of variation | <= 5% | <= 3% |

The first production gate is real-time or better after chunk parallelism. The
single-worker stretch target is real-time.

### 5.2 Resource limits

| Metric | Gate |
| --- | ---: |
| Peak RSS | <= 12 GiB on a 16 GiB worker |
| Unreclaimed RSS growth after 1,800 frames | <= 256 MiB or <= 10%, whichever is smaller |
| Native process crash | 0 in three warm repetitions |
| Unsupported commands | 0 for a fixture declared supported |
| Orphan temporary files/R2 objects | 0 |

### 5.3 Correctness

Same-backend determinism:

- Three repeated native runs must produce identical selected raw-frame hashes.
- Decoded video frames must be identical for the same encoder policy.
- Command count and asset/font digest must match between repetitions.

Provisional cross-backend parity gates:

| Fixture family | SSIM | Mean absolute channel error | Changed-pixel ratio | Max channel difference |
| --- | ---: | ---: | ---: | ---: |
| F0-F1 geometry | >= 0.9995 | <= 0.25 | <= 0.10% | <= 8 |
| F2 text | >= 0.9990 | <= 0.40 | <= 0.25% | <= 12 |
| F3 image/SVG | >= 0.9990 | <= 0.40 | <= 0.25% | <= 12 |
| F4 effects | >= 0.9980 | <= 0.75 | <= 0.75% | <= 16 |
| F5-F7 composite | >= 0.9980 | <= 0.75 | <= 0.75% | <= 16 |

All values use decoded RGBA frames. Differences must be reported for the full
frame and for an edge/antialiasing mask. A metric pass does not override a
visible semantic error such as missing text, wrong clipping or an incorrect
blend mode.

### 5.4 Reliability

- A failed native capability check must fail the chunk before publication.
- No silent fallback to CanvasKit inside a native benchmark.
- Retry must not publish duplicate segments.
- Cancellation must terminate native and FFmpeg children.
- Stale leases must remain recoverable through the existing Supabase flow.
- The final output must contain the expected video frame count and exactly one
  mixed audio stream when audio is enabled.

## 6. Benchmark evidence contract

Every execution writes a machine-readable JSON record and appends the accepted
result to
[`render-benchmark-comprehensive-assessment.md`](./render-benchmark-comprehensive-assessment.md).

Temporary raw frames and MP4 files remain under an ignored `tmp/` directory.
Long-lived evidence artifacts go to an R2 evidence prefix with only the object
key and checksum recorded in Git.

Required fields:

```text
run_id
date
git_sha
image_digest
fixture_id
fixture_version
requested_backend
actual_backend
surface_kind
software_renderer
cloud_project
region
job_and_execution
cpu
memory
task_count
parallelism
cold_or_warm
width
height
fps
frame_count
command_counts_by_op
font_digests
asset_digests
evaluate_ms
protocol_encode_ms
protocol_wait_ms
asset_download_ms
asset_decode_ms
native_replay_ms
native_readback_ms
native_output_wait_ms
node_relay_ms
ffmpeg_raw_ingest_ms
color_convert_ms
encoder_ms
encoder_finalize_ms
audio_prepare_ms
mux_ms
upload_ms
verify_ms
application_wall_ms
cloud_execution_ms
peak_rss_bytes
cpu_seconds
bytes_transferred
pipe_or_bridge_mode
ffmpeg_threads
ffmpeg_preset
output_bytes
output_sha256
raw_frame_hashes
ssim
psnr
mean_absolute_error
changed_pixel_ratio
max_channel_difference
skipped_commands
warnings
error_code
```

## 7. Feedback loop used by every phase

Every optimization follows the same loop:

```text
1. State one bottleneck hypothesis
2. Freeze fixture, image digest and machine shape
3. Add instrumentation before changing implementation
4. Run one cold and at least three warm baselines
5. Change one variable only
6. Run parity first
7. Run the same cold/warm benchmark matrix
8. Compare median, p95, variance, CPU and memory
9. Accept, revise or revert
10. Append result and next hypothesis to the canonical report
```

Rules:

- Do not combine an encoder-thread change with an IPC change in one A/B.
- Do not compare different fixtures as if they were repetitions.
- Do not use MP4 SHA-256 as the cross-backend visual contract.
- Do not report blocked producer time as pure IPC time.
- Do not merge an optimization that fails parity, determinism or cleanup.
- Stop optimizing a stage when it contributes less than 10% of end-to-end
  application wall time unless it causes memory or reliability problems.

## 8. Phase P0 - Freeze baseline and benchmark harness

### Goal

Make every downstream decision reproducible.

### Tasks

- Pin the existing CanvasKit and native CPU image digests.
- Record the exact Skia revision and compiler flags.
- Add a benchmark mode enum instead of environment-specific ad hoc scripts.
- Add process CPU time and peak RSS collection.
- Add per-stage timestamps around native output and FFmpeg.
- Record command counts and surface/cache allocations.
- Persist raw hashes for frames 0, middle and last.
- Add decoded-frame extraction and parity metric tooling.
- Keep Cloud Run at 4 vCPU / 16 GiB / task count 1 / parallelism 1.

### Exit gate

- One cold and three warm repetitions of the current F0 fixture.
- Warm coefficient of variation <= 5%.
- Metrics JSON contains every field needed by P1.
- Existing output checksum and frame count remain valid.

## 9. Phase P1 - Isolate renderer, relay, color conversion and encoder

### Goal

Determine what the current 36.37-second `rawWrite` interval actually contains.

### Benchmark matrix

Use F0 at 30, 300 and 1,800 frames. The 1,800-frame matrix runs one cold and
three warm repetitions.

| Mode | Data path | What it isolates |
| --- | --- | --- |
| M0 | render only, no readback | Skia replay |
| M1 | render + readback, no output | Skia plus readback |
| M2 | render + readback + `/dev/null` | memory scan and `fwrite` without FFmpeg |
| M3 | generated RGBA -> FFmpeg raw input -> null output | raw ingest/parser |
| M4 | generated RGBA -> explicit `format=yuv420p` -> null output | color conversion |
| M5 | generated RGBA -> libx264 -> `/dev/null`, threads 1 | conversion plus encoder |
| M6 | same as M5, threads 2 | encoder scaling |
| M7 | same as M5, threads 4 | encoder scaling |
| M8 | native -> Node relay -> FFmpeg | current baseline |
| M9 | native process directly owns/spawns FFmpeg pipe | removes Node from RGBA path |
| M10 | native -> raw file on local disk -> FFmpeg | diagnostic only; separates producer/consumer |

M10 is not a production candidate because it doubles I/O and needs roughly
14.93 GB for the 60-second F0 fixture. It is only used if the streaming modes
remain ambiguous.

### Derived measurements

```text
readback_cost        = M1 - M0
raw_memory_write     = M2 - M1
raw_ingest           = M3 - generated_source_cost
color_conversion     = M4 - M3
single_thread_encode = M5 - M4
node_relay_effect    = M8 - M9
disk_materialization = M10 - M9, interpreted separately
```

These are directional differences; CPU overlap means they are not treated as
perfectly additive.

### Decision gates

- If M9 improves wall time by at least 10% or 2 seconds at 1,800 frames,
  remove Node from the RGBA hot path.
- If M6/M7 improves wall time without violating the 4-vCPU CPU budget, select
  the best thread count for F0 and repeat on F4/F7.
- If color conversion consumes more than 25% of wall time, investigate a
  faster conversion path before shared memory.
- If M2 is within 5% of M1, raw memory writes are not the bottleneck.
- If M9 meets the F0 SLO, stop: do not build shared memory or libavcodec yet.

### Exit gate

- A stage attribution table explaining at least 90% of application wall time.
- A selected FFmpeg thread policy for the reference machine.
- A decision on whether Node relay removal is material.
- No shared-memory or N-API implementation without evidence from this phase.

## 10. Phase P2 - Native protocol and process hardening

### Goal

Turn the benchmark protocol into a production-capable boundary before adding
complex commands.

### Tasks

- Add protocol header with magic, major/minor version and feature bitmap.
- Add bounded message lengths and explicit little-endian encoding.
- Add job initialization and teardown messages.
- Register assets and fonts once per job rather than once per frame.
- Add cache identity based on SHA-256.
- Add structured error frames from native to Node.
- Add cancellation and child-process termination.
- Add renderer capability response listing supported command families.
- Add output mode selection: metrics-only, null sink, direct FFmpeg and test
  raw output.
- Keep unsupported commands fail-closed.

### Exit gate

- Malformed and oversized protocol tests pass.
- Cancellation leaves no native/FFmpeg process behind.
- Repeated 1,800-frame run has bounded memory.
- F0 output remains deterministic.

## 11. Fixture ladder F0-F7

Every fixture has a short diagnostic form and a 60-second benchmark form.
Golden frames are captured at frame 0, 25%, 50%, 75% and last frame.

### F0 - Basic geometry baseline

Coverage:

- background fill;
- rectangles, rounded rectangles, ellipses and polygons;
- translation, scale, rotation and opacity;
- world-to-clip transform;
- animation at multiple frames;
- transparent and opaque colors.

Implementation tasks:

- Finish all `drawShape` variants.
- Pin anti-aliasing, color type, alpha type and sRGB behavior.
- Match matrix and rounding rules.
- Remove the current raw hash difference before expanding scope, or document
  the precise antialiasing tolerance with pixel-diff evidence.

Exit gate:

- No unsupported F0 commands.
- Geometry parity gate passes.
- F0 performance target passes.

### F1 - Paths, stroke, gradients and clipping

Coverage:

- SVG-style path data;
- even-odd and winding fill;
- line caps and joins;
- dashes;
- linear, radial and sweep gradients;
- rectangular and path clipping;
- nested transforms;
- projective geometry used by current Runtime V3.

Implementation tasks:

- Add canonical path serialization.
- Cache immutable native paths by digest.
- Normalize gradient stops and color interpolation.
- Track path build and path draw time separately.

Exit gate:

- F0 remains unchanged.
- F1 parity passes at all golden frames.
- Path cache hit rate and memory are reported.

### F2 - Text and fonts

Coverage:

- Latin and Vietnamese;
- regular, bold and italic;
- fallback across multiple font assets;
- CJK sample;
- emoji and color-font diagnostic;
- variable-font diagnostic;
- kerning, ligature, multiline layout and clipping;
- text opacity, transform, shadow and blur integration.

Docker and runtime contract:

```text
Docker image
  - FreeType-enabled native Skia
  - pinned fallback font set
  - fixture fonts with compatible redistribution licenses

Runtime job
  - user font stored in R2
  - manifest contains asset ID, object key, digest and metadata
  - worker downloads and verifies bytes
  - native Skia registers the exact bytes
  - cache key is the font digest
```

Production must not depend on `SkFontMgr::RefDefault()` or incidental Ubuntu
fonts. Missing fonts either use an explicitly declared fallback or fail before
publication.

The shared evaluator should remain the source of glyph IDs and positions when
available. Native HarfBuzz shaping is added only for a documented command that
cannot use pre-shaped glyph data.

Exit gate:

- Preview and native use identical font bytes.
- No silent system-font fallback.
- Vietnamese, fallback and multiline golden frames pass.
- Font cache is stable across 1,800 frames.

### F3 - Images and SVG assets

Coverage:

- PNG with alpha;
- JPEG;
- WebP;
- SVG normalized asset;
- crop and object-fit behavior;
- interpolation/filtering;
- repeated image reuse;
- projective image transform;
- missing and corrupt asset behavior.

Preferred parity design:

- Keep one shared asset normalization contract.
- Decode or normalize assets once per digest.
- Send canonical encoded bytes or canonical RGBA to native.
- Do not let browser, sharp/libvips and native Skia independently choose
  different orientation, color profile or animation-frame behavior.

Native PNG/JPEG/WebP codecs are enabled only if the selected asset contract
requires native encoded-byte decode. Codec enablement is not used as a proxy
for parity.

Exit gate:

- Each asset is downloaded/decoded once per worker cache identity.
- F3 parity passes.
- Corrupt assets fail explicitly.
- Asset memory remains below the resource gate.

### F4 - Layers, masks, blend modes and effects

Coverage:

- `saveLayer`/restore;
- bounded offscreen surfaces;
- opacity isolation;
- masks;
- blur;
- drop shadow;
- color filters;
- supported blend modes;
- nested effects;
- effect cache reuse.

Implementation tasks:

- Introduce a native surface pool keyed by dimensions and color contract.
- Bound every offscreen surface to drawable/effect bounds.
- Record allocation, reuse, filter-cache and mask-cache counters.
- Fail on unsupported blend/filter semantics.

Exit gate:

- F0-F3 remain within their parity thresholds.
- F4 effect threshold passes.
- No full-frame offscreen allocation where bounded allocation is possible.
- Pool/cache memory remains bounded over 1,800 frames.

### F5 - Video frame assets

Coverage:

- sequential playback;
- non-zero trim/start offset;
- seek;
- reverse;
- loop;
- duplicated source reuse;
- source video with embedded audio represented as detached visual and audio
  tracks;
- source frame dimensions different from runtime metadata.

The initial native renderer does not own media demux/decode. The media
preparer/asset resolver supplies deterministic frame assets and timestamps.
Native Skia owns visual composition only.

Exit gate:

- Selected source-frame hashes match the expected timestamp contract.
- Seek/reverse/loop fixtures pass.
- Video frame cache and decode wait are measured separately from replay.
- No embedded audio is mixed by the visual renderer.

### F6 - Audio mix and final mux

Coverage:

- detached audio;
- video source with detached embedded audio;
- trim, delay, volume, pan, fade and tempo;
- multiple overlapping sources;
- silence and missing-audio cases;
- chunked video segments followed by one central audio mix.

Native Skia is not responsible for audio. F6 verifies that replacing the
visual backend does not break the current audio/finalizer contract.

Exit gate:

- Exactly one AAC stream at 48 kHz stereo when audio is enabled.
- Duration drift stays within one output video frame.
- No duplicate audio after chunk concatenation.
- Audio preparation, mux and finalizer times are reported separately.

### F7 - Full production-shaped runtime

Coverage:

- 97-node Neonix overview fixture;
- 1,800 frames / 60 seconds / 1920x1080 / 30 FPS;
- text, image, SVG, effects, video and audio;
- six 300-frame chunks;
- chunk parallelism 1, 2 and 4;
- Supabase source-of-truth lifecycle;
- R2 segments and final publication;
- retry, cancellation and stale recovery.

Execution sequence:

1. One chunk, one task, no audio.
2. Six chunks, parallelism 1, no audio.
3. Six chunks, parallelism 2, no audio.
4. Six chunks, parallelism 4, no audio.
5. Repeat the selected topology with F6 audio/finalizer enabled.
6. Run one cold and three warm repetitions of the final topology.

Exit gate:

- All 1,800 frames verified.
- No skipped commands.
- Cross-backend parity threshold passes on golden frames.
- Same-native determinism passes.
- Parent wall and memory targets pass.
- Final MP4 and R2 lifecycle pass.

## 12. Phase P3 - Remove Node relay if justified

This phase is executed only if P1 shows M9 materially outperforming M8.

Preferred implementation:

- Node starts one native worker with an encoder configuration.
- Native starts FFmpeg directly and writes RGBA to its stdin.
- Node receives structured metrics and final status, not raw frames.
- FFmpeg stderr is captured and bounded.
- Native propagates cancellation and exit codes.
- Segment output remains at the existing path expected by the chunk worker.

This removes one userspace relay and one pair of Node stream buffers while
preserving process isolation and the existing FFmpeg CLI.

Exit gate:

- Improvement is at least 10% or 2 seconds on F0 1,800 frames.
- F4 and F7 do not regress.
- Cancellation and FFmpeg failures propagate correctly.
- If the gain is below the gate, retain Node relay and close this phase.

## 13. Phase P4 - Encoder and color conversion optimization

### Tasks

- Benchmark libx264 threads 1, 2 and 4 on F0, F4 and F7.
- Benchmark `ultrafast`, `veryfast` and `faster` with a fixed CRF.
- Record output size and decoded-frame quality.
- Measure RGBA-to-YUV420p separately.
- Test whether BGRA or another Skia-compatible input format improves FFmpeg
  conversion on the deployed build.
- Pin the selected FFmpeg version and encoder configuration.
- Keep video-only chunk output compatible with the finalizer.

### Selection rule

Choose the fastest configuration that:

- passes decoded-frame quality;
- fits the 4-vCPU budget without starving native replay;
- remains deterministic under the declared encoder policy;
- does not create materially larger segments without an accepted latency
  reason.

## 14. Phase P5 - libavcodec in-process decision

Do not start this implementation until F0-F4 work and P1/P3/P4 results exist.

### Entry conditions

All of the following are required:

- direct native-to-FFmpeg pipe has already been measured;
- renderer feature parity is not the current critical path;
- IPC/raw-output wait remains at least 20% of application wall;
- F7 still misses the required latency SLO;
- expected recoverable gain is at least 15%;
- the team accepts tighter native dependency and crash coupling.

### POC design

- Link pinned `libavcodec`, `libavformat`, `libavutil` and `libswscale`.
- Wrap the Skia RGBA buffer without copying where API ownership permits.
- Measure color conversion separately; do not label the path zero-copy if
  RGBA-to-YUV creates another frame.
- Reuse AVFrame/packet/buffer allocations.
- Emit fragmented or final MP4 compatible with current chunk/finalizer flow.
- Preserve structured cancellation and cleanup.

### A/B gate

Compare direct FFmpeg CLI pipe and in-process libavcodec using identical
encoder settings and fixture:

- wall time;
- CPU seconds;
- peak RSS;
- copies/allocated bytes where measurable;
- output quality and frame count;
- crash isolation and cleanup;
- image size and cold start;
- operational complexity.

Adopt in-process encoding only if it improves F7 wall by at least 15% and does
not fail reliability or maintainability gates. Otherwise keep the CLI path.

## 15. Docker image plan

### Build image

- Pin Skia revision.
- Pin compiler and GN flags.
- Build only the required CPU raster features.
- Enable FreeType.
- Enable native image codecs only when required by the F3 asset contract.
- Include fixture fonts and explicitly licensed fallback fonts.
- Build the native command worker as a release binary.

### Runtime image

- Multi-stage copy of the native binary and required shared libraries.
- FFmpeg CLI remains present until P5 is accepted.
- No compiler, depot_tools, Skia source tree or pnpm workspace in the final
  production image.
- Run the Node control plane from compiled JavaScript rather than `tsx`.
- Do not copy the entire monorepo.
- Add startup self-test reporting Skia version, protocol version, codec/font
  capability and FFmpeg version.
- Keep the runtime image CPU-only.

### Font content

Docker contains:

- FreeType runtime;
- deterministic fallback font set;
- F2 fixture fonts;
- font license files.

Docker does not contain arbitrary user fonts. User fonts remain R2 assets,
verified by digest and registered from bytes for each job/cache lifetime.

## 16. Test strategy

### Unit tests

- Protocol encode/decode.
- Matrix conversion.
- Color/alpha conversion.
- Path serialization.
- Font and asset cache identity.
- Surface pool lifecycle.
- Unsupported-command failure.
- Cancellation and child-process cleanup.

### Golden frame tests

- F0-F7 selected frames.
- Same-native exact hashes.
- CanvasKit/native diff artifacts.
- Edge-mask metrics.
- Human-readable montage for review.

### Cloud Run tests

- Cold and warm execution.
- 4 vCPU / 16 GiB reference shape.
- Timeout and SIGTERM.
- Chunk retry and duplicate delivery.
- R2 transient failure.
- Supabase lease recovery.
- Finalizer audio contract.

## 17. Phase execution order

```text
P0  Baseline and instrumentation
P1  Renderer/IPC/color/encoder isolation matrix
P2  Protocol and process hardening
F0  Geometry parity
F1  Paths/gradients/clipping
F2  Text/fonts
F3  Images/SVG
F4  Layers/masks/effects
P3  Remove Node relay if P1 gate passed
P4  Encoder/color conversion tuning
F5  Video frame assets
F6  Audio/finalizer regression
F7  Full production-shaped E2E
P5  libavcodec only if entry gate passed
F7  Final re-benchmark after accepted P5 change
GPU Re-evaluation only after the native CPU decision
```

P3 and P4 may begin after F4 because the effect-heavy fixture is needed to
ensure an encoder optimization does not simply move CPU contention back into
Skia replay.

## 18. Definition of done

Native Skia CPU export is complete when:

- F0-F7 all pass their declared command coverage;
- no supported fixture contains skipped commands;
- fonts and assets are deterministic and digest-addressed;
- native memory remains bounded;
- the selected FFmpeg boundary is justified by A/B evidence;
- Node is absent from the raw RGBA hot path if the P3 gate passed;
- libavcodec is either adopted with a quantified gain or explicitly rejected
  with evidence;
- the 60-second production fixture meets the accepted wall-time SLO;
- audio/finalizer/R2/Supabase lifecycle remains correct;
- one cold and three warm final runs are recorded in the canonical report;
- rollback to the CanvasKit compatibility export remains available through an
  explicit backend flag during rollout.

Only after this definition of done is met should Neonix decide whether GPU is
still necessary.

