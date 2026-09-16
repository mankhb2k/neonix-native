# Native Skia CPU benchmark — 2026-09-16

## Scope

This run locks the export experiment to Native Skia CPU on Cloud Run with one
task, 4 vCPU, 16 GiB RAM, no GPU, `1920x1080`, `30 fps`, and `srgb`. CanvasKit
and GPU/Vulkan are controls outside this run.

The benchmark ladder is defined in
[`apps/web/public/docs/benchmark`](../../apps/web/public/docs/benchmark), and
the raw fixture audit is stored at
[`native-skia-cpu-fixture-audit-2026-09-16.json`](./results/native-skia-cpu-fixture-audit-2026-09-16.json).

## Cloud Run baseline executions

### Existing native raster smoke

Execution: `neonix-native-skia-cpu-bench-nlkgd`  
Job: `neonix-native-skia-cpu-bench`  
Image: `skia-cpu-bench@sha256:92691b...`  
Configuration: 4 vCPU / 16 GiB / one task / no GPU / 1,800 frames.

| Metric | Measured |
| --- | ---: |
| Cloud Run execution elapsed | 36.3 s |
| Worker wall time | 24.279 s |
| Native render | 3.118 s |
| Native readback | 0.707 s |
| Native process totalWithoutPipe | 24.157 s |
| Raw RGBA bytes | 14,929,920,000 |
| Output | MP4, 203,631 bytes |

This image renders a synthetic native Skia raster scene. It is a useful CPU
and FFmpeg baseline, but it does not consume the HTML fixtures.

### Native command-buffer bridge

Execution: `neonix-skia-command-cpu-bench-r4-7fhxl`  
Job: `neonix-skia-command-cpu-bench-r4`  
Configuration: 4 vCPU / 16 GiB / one task / no GPU / 1,800 frames.

| Metric | Measured |
| --- | ---: |
| Cloud Run execution elapsed | 1m 2.48s |
| Application wall | 53.040 s |
| Native process | 52.801 s |
| Native render | 5.669 s |
| Native readback | 2.476 s |
| Native raw write | 44.583 s |
| Protocol backpressure wait | 48.645 s |
| TypeScript evaluator | 0.157 s |
| TypeScript protocol encode | 0.071 s |
| Raw RGBA transferred | 14,929,920,000 bytes |
| Output | MP4, 203,631 bytes |

The raw producer/consumer path is the dominant measured cost. Raw write alone
is about 84.1% of application wall; backpressure is about 91.7%. These values
overlap and must not be added together. Render plus readback is 8.145 s, while
the native process span is 52.801 s, so the current timing label
`protocolDecode` includes waiting for the pipe consumer and is not pure decode
CPU time.

The sampled output hash was stable for the synthetic scene:

```text
frame 0:   dd114914
frame mid: dd114914
frame last:dd114914
MP4 SHA-256: 9c4d1cc7424b1317d2f3394747e2995a8b0bbae4e3b3da56a0476e96d6de6ecd
```

## Fixture audit result

All eight fixtures compile and prepare successfully on the local audit runner.
The audit samples first, middle and last frames and counts the emitted
`PaintCommandBuffer` operations.

| Fixture | Compile/prepare | Representative operations | Native command bridge |
| --- | --- | --- | --- |
| F0 | Pass | `drawPath`, groups, layers | Opcode-ready; parity gaps |
| F1 | Pass | `drawText`, `drawPath`, groups | Opcode-ready; parity gaps |
| F2 | Pass | `drawImage`, `drawText`, layers | Blocked on image decode |
| F3 | Pass | animation plus `drawText`, `drawPath` | Opcode-ready; parity gaps |
| F4 | Pass | effects plus `drawText`, `drawPath`, layers | Opcode-ready; parity gaps |
| F5 | Pass | `drawVideo`, `drawText`, layers | Blocked |
| F6 | Pass | `drawImage`, `drawText`, groups/layers | Blocked |
| F7 | Pass | `drawImage`, `drawText`, groups/layers | Blocked |

The native command process now accepts the following replay subset:

```text
beginFrame, setTransform, beginGroup/endGroup, beginLayer/endLayer,
drawShape, drawSolid, drawPath, drawText, endFrame
```

The audit now separates `nativeReplayOpcodeReady` from
`nativeParityReady`. F0, F1, F3 and F4 are opcode-ready, but all fixtures
still have visual parity gaps. F2, F5, F6 and F7 remain blocked by image/video
decode and/or unsupported effect features. This is an implementation coverage
result, not a rendering failure.
The fixture compile/prepare times were approximately:

```text
F0  compile 24.071 ms / prepare 16.032 ms
F1  compile  9.450 ms / prepare 88.187 ms
F2  compile  3.560 ms / prepare 56.328 ms
F3  compile 10.045 ms / prepare 636.216 ms
F4  compile  8.841 ms / prepare 46.391 ms
F5  compile 24.890 ms / prepare 6497.022 ms
F6  compile 24.897 ms / prepare 2749.666 ms
F7  compile 29.591 ms / prepare 19950.338 ms
```

The large F5–F7 preparation values are local Node preparation measurements,
not Cloud Run native render measurements. They identify media/font/resource
preparation as a separate stage that must not be mixed into Skia replay time.

## F0 native replay on Cloud Run

The first real fixture run used image digest
`sha256:fe6e9ca27142c790d27fdddaa2ae12e3dba891257a7ad271ddb46a6484a00e99`
on the same Cloud Run Job shape: 4 vCPU, 16 GiB, one task, no GPU,
`1920x1080`, 30 fps, 150 frames. The fixture is not yet a parity pass: the
current bridge still omits gradients, blend modes, clips and other effect
programs. It is a valid native replay/timing measurement.

| F0 mode | Execution | App wall | Native process | Render | Readback | Raw write | Pipe wait | FFmpeg encode |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| render-only | `-l6mdz` | 1,174.533 ms | 1,103.072 ms | 277.797 ms | 200.029 ms | 0 ms | 869.379 ms | 0 ms |
| raw-file | `-9fb5c` | 1,740.770 ms | 1,697.974 ms | 273.156 ms | 124.261 ms | 560.450 ms | 1,346.805 ms | 0 ms |
| encode-file | `-5vw7w` | 6,367.318 ms | 1,770.750 ms | 275.931 ms | 149.536 ms | 566.807 ms | 1,404.328 ms | 4,546.689 ms |
| pipe | `-x4z7z` | 5,438.094 ms | 5,266.038 ms | 341.041 ms | 200.969 ms | 3,898.902 ms | 4,504.913 ms | 147.671 ms |

All four F0 runs rendered successfully with `actualBackend=skia-native-raster`
and `softwareRenderer=true`. Raw output was `1,244,160,000 bytes`; the native
sample hash was stable at `6e03d832` for raw-file, encode-file and pipe. The
encoded MP4 was 19,609 bytes with SHA-256
`041e7a54c5a10c6907d395c8aaaa56c712a120a68dc46b0f9665c807ab55568e`.

Cloud Run observations were recorded separately: image import was 62.36 s on
the first F0 run and about 1 s on subsequent runs; start waits were 11.96 s,
14.81 s, 15.54 s and 12.79 s. These are platform provisioning/import costs,
not native rendering costs. The complete machine-readable records are in
`docs/benchmark/results/native-skia-cpu-bridge-matrix-2026-09-16.json`.

The F0 result changes the bottleneck picture in two ways. First, native Skia
render plus readback is only about 0.48 s per 5-second fixture, so Skia replay
is not the dominant stage for this scene. Second, FFmpeg isolated encode is
4.55 s, while the current stdout pipe keeps the native process blocked for
4.50 s and reaches 5.44 s application wall. The next optimization target is
therefore the raw-frame bridge and encoder configuration, while parity work
must proceed in parallel.

## F1 native text replay on Cloud Run

After fixing the container repo-root resolution for HarfBuzz, F1 completed on
the same 4 vCPU/no-GPU job. The first failed F1 attempt (`-twxw7`) was an
`ERR_MODULE_NOT_FOUND` packaging/integration error and did not exercise the
renderer; it is retained in the JSON error record.

| F1 mode | Execution | App wall | Native process | Render | Readback | Protocol encode |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| render-only | `-h5545` | 798.874 ms | 751.042 ms | 594.378 ms | 144.773 ms | 97.023 ms |
| raw-file | `-729wx` | 1,613.993 ms | 1,559.240 ms | 732.006 ms | 170.224 ms | 133.112 ms |

F1 raw output was `1,244,160,000 bytes` and its stable native sample hash was
`6f7b4fcd`. Compared with F0 render-only, text increased native render from
`277.797 ms` to `594.378 ms` (about 2.14x) and protocol encoding from
`26.358 ms` to `97.023 ms`, but the result is still sub-second for 150
frames. F1 is therefore a measurable native workload, not yet evidence that
Skia is the end-to-end bottleneck. Visual parity remains open because the
bridge does not yet serialize every paint/effect feature emitted by the
canonical evaluator.

## F3 animation/transform native replay on Cloud Run

F3 was measured at its manifest duration of 10 seconds, 300 frames, in
`render-only` mode. The image, dimensions and 4 vCPU/no-GPU resource shape
were unchanged.

| Fixture | Execution | App wall | Evaluate | Native process | Protocol decode | Render | Readback |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| F3 | `-hx786` | 3,825.443 ms | 367.786 ms | 3,776.124 ms | 3,769.837 ms | 1,244.388 ms | 480.937 ms |

F3 completed successfully with `actualBackend=skia-native-raster` and
`softwareRenderer=true`. The renderer replayed 300 frames in about 3.78 s,
or roughly 0.38x the 10-second media duration; the Skia draw portion alone
was about 1.24 s. Evaluator time grew to 367.786 ms, so the next F3 follow-up
is to compare command count/serialized bytes per frame before attributing the
remaining process span to Skia. This run had no raw output, so it intentionally
does not measure the 2.49 GB raw-frame bridge.

## F4 effects native replay on Cloud Run

F4 also completed in `render-only` mode at 10 seconds and 300 frames, but it
is explicitly a transport/replay smoke result, not a visual-quality result.
The current protocol does not yet serialize all effect programs, clip paths,
masks, blend modes and non-solid paints; those parity gaps are retained by the
fixture audit.

| Fixture | Execution | App wall | Evaluate | Native process | Protocol decode | Render | Readback | Pipe wait |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| F4 | `-rzhh2` | 7,442.568 ms | 173.571 ms | 7,411.009 ms | 7,403.684 ms | 1,158.819 ms | 396.917 ms | 6,990.101 ms |

The native process completed with `skia-native-raster` and
`softwareRenderer=true`, but no raw frame was emitted in this mode, so no
pixel hash or parity claim is valid. Protocol decode/backpressure accounts
for most of the measured process span. The next implementation task is to
reduce command volume or batch the protocol, then rerun F3/F4 with raw output
before optimizing individual Skia effects.

## Unsupported fixture executions (r8)

The remaining ladder fixtures were executed on the same Cloud Run Job and r8
image in `render-only` mode. They failed closed during TypeScript protocol
encoding, before a complete native replay result could be emitted. These are
intentional capability-gate results, not successful render benchmarks.

| Fixture | Execution | Cloud Run execution | Failure stage | Error |
| --- | --- | ---: | --- | --- |
| F2 image/SVG | `-hm7bt` | 18.33 s | protocol encode | unsupported `drawImage` |
| F5 video/audio | `-hc5pv` | 26.53 s | protocol encode | unsupported `drawVideo` |
| F6 text/shape/audio | `-2n7vz` | 30.48 s | protocol encode | unsupported `drawImage` |
| F7 full visual | `-w4r27` | 42.34 s | protocol encode | unsupported `drawImage` |

The fixture audit shows that all four documents compile and prepare
successfully, but F2/F6/F7 require image decoding and F5 requires video
decoding. Audio is not represented as a frame paint opcode; it belongs to the
later finalizer/mix stage. No render/readback/encode timing is claimed for
these failed executions. The exact stderr errors and execution IDs are kept
in the JSON result file.

Instrumentation note: the pre-r7 native image labeled `protocolDecode` as the
whole frame interval, including render/readback. Those historical values are
therefore `protocol+render+readback`, not decode-only. The r7 image changes the
metric to exclude the separately accumulated render, readback and raw-write
intervals; all transport conclusions below must use r7 or later for a clean
stage attribution.

## Protocol batching A/B on F3

The r5 image was tested on the same Cloud Run Job shape with F3, 10 seconds,
300 frames, `render-only`, and no GPU. The only intended variable was the
number of encoded frames accumulated per write to the native process stdin.
Both runs completed with `actualBackend=skia-native-raster` and
`softwareRenderer=true`.

| Batch frames | Execution | App wall | Native process | Protocol decode | Backpressure | Render | Readback |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `-2wh9q` | 3,224.064 ms | 3,159.066 ms | 3,148.095 ms | 2,654.479 ms | 1,017.312 ms | 359.016 ms |
| 8 | `-h8qg2` | 3,303.518 ms | 3,238.911 ms | 3,130.492 ms | 2,779.047 ms | 1,013.768 ms | 353.489 ms |

Batching eight frames did not improve this workload: application wall time was
about 2.5% slower and measured backpressure about 4.7% higher. Native render
was effectively unchanged. The result does not justify keeping batch 8 as a
default optimization; the dominant cost is the command-stream producer/child
stdin flow (`protocolBackpressure` plus native protocol decode), not Skia draw
time. The next experiment should change the transport itself (file/mmap or
in-process binding), not only the write batch size.

A second pair on the same r5 image confirmed the direction:

| Batch | Repeat execution | App wall | Native process | Protocol decode | Backpressure | Render |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 8 | `-n72hp` | 3,364.767 ms | 3,319.717 ms | 3,223.090 ms | 2,870.994 ms | 1,025.757 ms |
| 1 | `-769gz` | 3,372.318 ms | 3,331.763 ms | 3,318.449 ms | 2,811.902 ms | 1,095.675 ms |

Across two runs per variant, batch 1 averaged `3,298.191 ms` application
wall versus `3,334.142 ms` for batch 8, and `2,733.191 ms` versus
`2,825.020 ms` backpressure. This is a small `1.1%` wall-time and `3.3%`
backpressure difference, so the safe conclusion is that batching is not a
material optimization. It should not drive the architecture decision.

The failed execution `-ktrcn` is recorded in the JSON result as an
orchestration error. It never entered the renderer and is excluded from all
timing comparisons.

## FFmpeg thread scaling on F0

The raw-file-to-FFmpeg path was repeated with `-threads 2` and `-threads 4`
on the same 4 vCPU Cloud Run job. This is an encoder-only A/B; it does not
change the native Skia backend.

| FFmpeg threads | Execution | App wall | Native process | Native render | Raw write | Encode |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 2 | `-42fcn` | 5,790.522 ms | 1,879.105 ms | 284.767 ms | 641.691 ms | 3,871.554 ms |
| 4 | `-nnb69` | 4,349.843 ms | 1,307.140 ms | 196.736 ms | 581.105 ms | 2,988.575 ms |

The `threads=4` run reduced isolated encode by about 22.8% versus
`threads=2`, and total application wall by about 24.8%. The native render
variation is normal run-to-run noise at this short duration; it does not
explain the wall-time improvement. For this 4 vCPU shape, `FFMPEG_THREADS=4`
is the current benchmark default candidate, but it must be rechecked on the
30-second and 60-second fixtures because short-run startup and scheduling
noise are material.

## Controlled bridge/encoder experiment (Cloud Run 4 vCPU, no GPU)

The same image revision and synthetic `native-export-smoke` scene were run at
`1920x1080`, `30 fps`, for 150 frames (5 seconds). These short runs isolate
the raw path without spending 15 GB per run. Cloud Run provisioning/start is
recorded separately and is not part of application stage timings.

| Mode | App wall | Native process | Render | Readback | Raw write | Pipe wait | FFmpeg encode | Raw bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| render-only | 578.018 ms | 523.086 ms | 373.891 ms | 140.804 ms | 0 ms | 144.330 ms | 0 ms | 0 |
| raw-file | 976.731 ms | 923.112 ms | 268.889 ms | 53.480 ms | 563.289 ms | 266.908 ms | 0 ms | 1,244,160,000 |
| encode-file | 4,887.667 ms | 894.282 ms | 329.792 ms | 90.502 ms | 437.751 ms | 276.593 ms | 3,945.881 ms | 1,244,160,000 |
| pipe | 6,295.409 ms | 6,046.699 ms | 487.352 ms | 229.966 ms | 5,288.634 ms | 2,624.760 ms | 187.287 ms | 1,244,160,000 |

Execution IDs, in order, are `neonix-skia-command-cpu-bench-r4-477hm`
(failed env override), `-snx6m` (render-only), `-x6vgr` (raw-file), `-6jxx8`
(encode-file), and `-mn52f` (pipe). The failed control was an orchestration
error: the first `gcloud` invocation put all env pairs into the
`BENCHMARK_MODE` value. It did not exercise the renderer and is kept as an
operational error record.

`rawWrite` and `pipe wait` overlap with the native process span and must not be
summed. The controlled A/B isolates the direction: raw file plus independent
encode completed in `4.888 s`, while the same raw frames through
stdout-to-FFmpeg completed in `6.295 s`; the pipe path added about `1.408 s`
of application wall. FFmpeg itself remains the largest isolated stage at
`3.946 s`, while the current pipe adds producer/consumer backpressure.

Cloud Run CLI reported deployed-start waits of approximately `11.58 s`,
`13.74 s` and similar values for these executions. These are provisioning/start
observations and must be recorded as `cloudRunProvisioning` in the production
timeline, never attributed to Skia.

## Bottleneck diagnosis

1. **Confirmed:** Native Skia draw/readback is not the dominant cost in the
   command-buffer run.
2. **Qualified:** stdout pipe backpressure is large (`2.597 s`) but overlaps
   native replay; replacing it with a file did not reduce native process or
   application wall time on F3. It remains important for the raw RGBA/FFmpeg
   path, where approximately 14.93 GB crosses the process boundary for 60s at
   1080p30.
3. **Confirmed:** TypeScript evaluation and binary serialization are small
   relative to native process time on F3 (`0.329 s` and `0.134 s`).
4. **Measured but incomplete:** FFmpeg encode isolation exists on r9 F0 (`2.526 s` for 5s), but it still needs 30s/60s runs before production defaults are fixed. The current command
   benchmark measures a combined native stdout → FFmpeg stdin pipeline.
5. **Confirmed for the command path:** file-vs-pipe isolates transport from
   native replay; the next CPU optimization is command decoding/replay and
   feature implementation before shared memory.
6. **Confirmed on F4:** after correcting layer timing, native compositing is
   `3.259 s` of `3.873 s` Skia render time; effects/layers are a real CPU
   bottleneck even though visual parity is not complete.
7. **Blocking feature gap:** the native replay bridge cannot yet consume the
   real F0–F7 command vocabulary, so no F0–F7 native pixel or parity claim is
   valid yet.

## Next controlled experiments

Run these on the same 4 vCPU Cloud Run shape and the same image revision:

1. Native render-only with no raw output.
2. Native render plus raw output to a local file.
3. Native raw output through the current stdout pipe with FFmpeg disabled.
4. Raw file into FFmpeg, isolating encoder time.
5. Current raw pipe into FFmpeg, repeated with FFmpeg threads `1`, `2` and
   `4`.
6. Repeat at 150, 300, 900 and 1,800 frames.
7. Extend the command protocol in this order: groups/layers, paths,
   text/fonts, images/SVG, effects, video, then audio/finalizer.
8. Re-run the audit after each opcode family and require a native frame hash
   plus CanvasKit/native diff metrics before accepting the family.

9. With transport now isolated on r7, profile and reduce native command
   decode/replay overhead: count commands/opcodes and serialized bytes per
   frame, then compare a compact binary representation or in-process binding
   only if it lowers native decode-only time without changing hashes.

The current F3 transport A/B adds a decision gate: if batch size 1 remains as
fast as or faster than batch 8 across a repeat, revert the default to 1 and
prioritize a transport benchmark. A transport change is accepted only when it
reduces `protocolBackpressure` and `nativeProtocolDecode` without changing
native frame hashes or frame count.

The next optimization decision is only valid after these measurements. A
shared-memory or in-process encoder bridge should be selected if experiment 3
and 4 confirm that pipe/backpressure, rather than Skia replay, accounts for the
gap.

## Transport benchmark implementation status

The runner now supports `BENCHMARK_PROTOCOL_TRANSPORT=pipe|file` and reports
`protocolTransport`, `protocolBytes`, `protocolWrites` and
`protocolFileWrite`. In `file` mode, TypeScript writes the exact same binary
command stream to `/tmp/native-skia-command-cpu.protocol`; the native backend
then replays it with `--input-file`. This removes Node-child stdin flow from
the critical path while preserving the same native decoder and Skia replay.

The first r6 transport pair is intentionally provisional because it used the
pre-r7 inclusive protocol timer. It still proved that `file` removes measured
Node-side backpressure (`0 ms` versus `2,702.703 ms` on the r6 pipe run), but
it cannot quantify native decode-only cost. Re-run the pair on r7 before
making a production bridge decision.

### r7 controlled transport result

The clean r7 comparison used the same image digest
`sha256:5d1f02c69f29053b908a47abf2498d99da6ceb64f6176d9882b7cef27a4b1e81`,
Cloud Run `4 vCPU/16 GiB`, no GPU, F3 at 1920x1080/30 fps, 300 frames,
render-only, batch size 1.

| Transport | Execution | App wall | Native process | Decode-only | Render | Readback | Backpressure | File write |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pipe | `-q2lqx` | 3,122.404 ms | 3,098.185 ms | 1,717.880 ms | 1,013.823 ms | 359.948 ms | 2,597.047 ms | 0 ms |
| file | `-mvgqz` | 3,625.022 ms | 3,085.425 ms | 1,735.769 ms | 998.555 ms | 345.315 ms | 0 ms | 45.473 ms |

The command stream was exactly `14,017,521 bytes` over `302` writes and both
runs produced the same native sample hash `811c9dc5` for frame 0/mid/last.
The file transport removed Node stdin backpressure but did not reduce native
process time or wall time; pipe overlaps producer writes with native replay.
Therefore the next optimization target is the 1.718-second native
decode/command replay plus the 1.014-second Skia render, not a shared-memory
bridge solely for this command transport. An in-process encoder remains a
separate question for the 1.244 GB raw-video path and must be measured with
`raw-file`/`encode-file` before implementation.

### r8 command-stream profile

The r8 baseline adds command-level telemetry to F3. The command stream is
`14,017,500 bytes` across `6,600` commands, or exactly `46,725 bytes/frame`;
there was no frame-size variance in this fixture.

| Opcode | Count |
| --- | ---: |
| `setTransform` | 1,800 |
| `drawPath` | 1,200 |
| `beginGroup` / `endGroup` | 900 / 900 |
| `drawText` | 600 |
| `beginFrame` / `endFrame` | 300 / 300 |
| `beginLayer` / `endLayer` | 300 / 300 |

The r8 run `-8zhjm` measured application wall `3,204.718 ms`, native process
`3,154.070 ms`, decode-only `1,758.001 ms`, render `1,049.864 ms`, readback
`340.309 ms`, protocol serialization `148.333 ms`, and pipe backpressure
`2,640.230 ms`. This profile makes the next optimization measurable: reduce
the cost of decoding 6,600 commands and replaying 1,200 paths/600 text draws,
then rerun the same fixture and require the hash `811c9dc5` to remain stable.

The r7 Cloud Run run compared `file` versus `pipe` with identical fixture,
frame count, CPU/memory, and output mode. The decision criteria were:

| Signal | Interpretation |
| --- | --- |
| `file` drops native process time close to render + readback | stdin IPC/backpressure is the bottleneck |
| `file` remains close to `pipe` | decoder/replay or CPU scheduling is the bottleneck |
| native render grows while transport is unchanged | Skia feature implementation is the next target |
| sample hash/frame count changes | transport implementation is invalid and must be rejected |

This comparison is still a benchmark harness change, not a production
architecture decision. Shared memory or in-process FFmpeg is considered only
after the file-vs-pipe result and a raw-file-vs-encode-file measurement are
both stable; the r7 result is recorded above.

## r9 corrected text and encoder measurements

r9 moved native glyph input parsing and SVG path construction out of the
Skia-draw timer. This makes text attribution comparable with path attribution.
Rows marked r9 use the same 4 vCPU/no-GPU job and image digest
`sha256:f692bbfc15acaec864cbdbdb5389d26a0fdb22ed4f2f1769ccbd5bf9e8b865f2`;
the F0 render-only row is retained as the earlier r8 reference.

| Fixture/mode | Execution | App wall | Native process | Decode-only | Render | Readback | Raw write | Encode |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| F0 render-only | `-hs9nl` (r8) | 1,156.137 ms | 1,102.953 ms | 687.427 ms | 253.656 ms | 153.859 ms | 0 ms | 0 ms |
| F1 render-only | `-9sq4j` | 764.172 ms | 738.815 ms | 183.530 ms | 422.375 ms | 123.043 ms | 0 ms | 0 ms |
| F3 render-only | `-g6csn` | 1,949.538 ms | 1,925.697 ms | 1,216.844 ms | 561.431 ms | 140.342 ms | 0 ms | 0 ms |
| F4 render-only | `-llrfd` | 7,219.127 ms | 7,196.251 ms | 5,973.379 ms | 824.561 ms | 390.719 ms | 0 ms | 0 ms |
| F0 raw-file | `-87r45` | 1,330.730 ms | 1,315.607 ms | 446.173 ms | 201.290 ms | 67.804 ms | 595.426 ms | 0 ms |
| F0 encode-file | `-jhcqp` | 3,852.543 ms | 1,298.513 ms | 442.937 ms | 201.142 ms | 69.404 ms | 580.284 ms | 2,525.949 ms |
| F0 encode-file (r10) | `-fgm94` | 5,147.618 ms | 1,312.480 ms | 42.264 ms | 609.509 ms | 73.544 ms | 582.375 ms | 3,810.493 ms |

F0 raw output was `1,244,160,000 bytes`; the encode-file output was `19,609`
bytes with SHA-256
`3786f33cff006a3bd5f0ae7027f6a94e891bf2295d69803e7c79725b5f3e1cf4`.
On this 4 vCPU shape, FFmpeg encode is the largest isolated stage in the
5-second F0 export (`2.526–3.810 s` across r9/r10), while native render is only
`201–610 ms`. The F3 r9 run is materially faster than the earlier r8 run, but because the image and
timing instrumentation changed together, repeat F3 on r9 is required before
assigning the entire improvement to the text parsing refactor.

The r9 repeat `-x9jhd` measured application wall `3,027.822 ms`, native
process `3,006.390 ms`, decode-only `1,939.905 ms`, render `747.143 ms`, and
readback `312.859 ms`, with the same `6,600` commands and sample hash. Across
the two r9 samples, the range is `1,925.697–3,006.390 ms` native process and
`1,949.538–3,027.822 ms` application wall. The median native process is
approximately `2,466.044 ms`; the spread is large enough that any future
optimization must use at least three repetitions or a longer fixture.

## r10 effects compositing attribution

r10 instruments `saveLayer/restore` as native compositing and includes it in
the Skia render interval. F4 produced `9,000` commands and `14,838,900`
frame-protocol bytes:

| Execution | Native process | Decode-only | Skia render | Composite | Readback | App wall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `-r5sq5` | 4,232.828 ms | 176.934 ms | 3,873.194 ms | 3,259.060 ms | 178.145 ms | 4,258.087 ms |

This corrects the earlier F4 interpretation. The previous r9 value of
`5,973.379 ms` labeled decode was largely layer work that had not been timed
as render. F4 now confirms a real native Skia compositing bottleneck: roughly
84% of native render time is layer compositing. Effects parity is still not
verified because effect programs, masks, clips and non-solid paints remain
omitted by the bridge.

## Reproducibility

Run the fixture audit from the repository root:

```powershell
pnpm --filter @motionvideo/web run benchmark:native-fixture-audit
```

Run the existing native command baseline after the Cloud Run Job image is
updated:

```powershell
gcloud run jobs execute neonix-skia-command-cpu-bench-r4 `
  --region=asia-southeast1 --wait
```

Every future run must record the Cloud Run execution name, image digest,
resource limits, frame count, output hash, stage timings and all stderr/stdout
errors in this report family.

## In-process FFmpeg experiment: 60s on Cloud Run 4 vCPU

This experiment tests the next bridge strategy: native Skia raster renders
RGBA into memory, then the same C++ process converts RGBA to YUV420P with
`libswscale` and encodes/muxes H.264 through FFmpeg libraries. No FFmpeg CLI
process is started and no raw RGBA crosses stdout/stdin. The command protocol
itself uses a temporary file so its transport cost is isolated from video
encoding.

Configuration:

| Parameter | Value |
| --- | --- |
| Cloud Run project/region | `neonix-506607` / `asia-southeast1` |
| Job/execution | `neonix-skia-command-cpu-bench-r4` / `-d2764` |
| Image | `20260916-native-inprocess-r15` |
| Image digest | `sha256:fe43e1dc1b32f658ac77a309b74976d2c8aae1bc25f6897601e8accb59f5965a` |
| Resources | 4 vCPU / 16 GiB / one task / no GPU |
| Surface/backend | Native Skia raster / `softwareRenderer=true` |
| Video | 1920x1080, 30 fps, 1,800 frames, nominal 60s |
| Encoder | in-process FFmpeg `libavcodec` + `libavformat` + `libswscale`, `libx264`, 4 threads |
| Protocol transport | file, batch size 1, 1,802 writes, 1.58 MB command stream |

The run completed successfully. The MP4 was retained in the container output
path for the duration of the job and its identity was recorded before the
container exited:

| Stage/metric | Measured |
| --- | ---: |
| Cloud Run execution elapsed | 36.58 s |
| Cloud Run start/deploy wait | 7.38 s |
| Application wall | 24.900 s |
| TypeScript evaluator | 138.192 ms |
| Protocol encode | 63.904 ms |
| Protocol file write | 96.329 ms |
| Native process total | 24.023 s |
| Native protocol decode/timed loop | 17.227 s |
| Native Skia render | 5.147 s |
| Native readback | 1.506 s |
| RGBA -> YUV420P (`libswscale`) | 13.756 s |
| H.264 encode (`libx264`) | 3.456 s |
| MP4 mux | 59.450 ms |
| Encoder finalize/trailer | 41.256 ms |
| Raw RGBA write / pipe backpressure | 0 / 0 |
| MP4 output | 356,533 bytes |
| MP4 SHA-256 | `9a3fbe4cbb17cee800b9d556d76bd6eac80b5642730e0a0893b77521ca1c2bba` |

The native sample hash was stable at `811c9dc5` for frame 0, middle and last
frame. This confirms frame iteration and output sampling completed for all
1,800 frames, but it is not a visual parity proof: the current synthetic
scene is largely static and the bridge still has feature coverage gaps.

### Comparison with the previous 60s raw-pipe command bridge

The closest previous control was the same Cloud Run 4 vCPU/no-GPU command
bridge with native Skia output piped as raw RGBA to FFmpeg: application wall
`53.040 s`, native process `52.801 s`, Skia render `5.669 s`, readback
`2.476 s`, and raw write `44.583 s`. The new run is not a perfectly paired
repeat because the image and encoder path changed, but it isolates the impact
of removing raw-frame IPC:

| Metric | Previous raw pipe | In-process r15 | Change |
| --- | ---: | ---: | ---: |
| Cloud Run execution | 62.48 s | 36.58 s | -41.5% |
| Application wall | 53.040 s | 24.900 s | -53.1% |
| Native process | 52.801 s | 24.023 s | -54.5% |
| Skia render | 5.669 s | 5.147 s | -9.2% |
| Readback | 2.476 s | 1.506 s | -39.2% |
| Raw RGBA write | 44.583 s | 0 | eliminated |

The conclusion is that the raw RGBA process boundary was a real bottleneck,
but the in-process path does not make Skia disappear as a cost. After removing
raw pipe overhead, measured native time is now dominated by two CPU stages:

1. protocol decode/timed loop: `17.227 s` (this timer includes the native
   frame loop and should not be interpreted as pure parser CPU), and
2. color conversion: `13.756 s`, approximately 57.3% of the native process
   span when shown as an attribution ratio.

Skia render plus readback is `6.653 s`, approximately 27.7% of native process
time. H.264 encode is `3.456 s`, approximately 14.4%. These stage timers are
not additive: conversion and encode are nested in the frame loop, and the
protocol timer includes waiting/processing around those operations.

### Important harness correction and failure log

The first r14 60s attempt completed the native encoder but reported the same
output size/hash as the 5s smoke. Investigation found that the common native
shutdown path wrote a PPM preview to the same `outputPath` after MP4 finalize,
overwriting the MP4. r15 gates the PPM write behind `!inProcessEncoding`.
The r15 smoke produced a distinct MP4 (`33,744` bytes), and the r15 60s run
produced the `356,533` byte MP4 recorded above. Therefore r14 timing is
diagnostic only; r15 is the accepted result.

### Decision and next feedback loop

The in-process direction is viable on 4 vCPU and removes the 14.9 GB raw
RGBA IPC path. It is not yet a production zero-copy encoder: `libswscale`
still performs an RGBA-to-YUV420P conversion and the current binary is a
feature-limited synthetic command bridge.

Next measurements should be paired on the same 60s fixture and image family:

- repeat r15 at least twice to obtain a median and p95;
- benchmark `libswscale` against `libyuv` using identical RGBA/YUV format,
  color range and hash checks;
- run render-only, in-process, and CLI encode controls with the same command
  stream;
- add a dynamic fixture so frame hashes differ at first/middle/last;
- validate the MP4 with `ffprobe` (duration, 1,800 frames, pixel format,
  time base) and compare decoded frame hashes against the control;
- only then consider a native `libavcodec` pixel-format path that avoids the
  RGBA intermediate where Skia can provide a compatible surface.

The machine-readable r15 record is in
`docs/benchmark/results/native-skia-cpu-bridge-matrix-2026-09-16.json`.

## r16 correctness and instrumentation baseline

r16 keeps the r15 encoder path unchanged (`libx264`, `yuv420p`, `veryfast`,
CRF 23, in-process FFmpeg) and changes only frame correctness guarantees and
stage attribution. The native surface is now opaque RGBA with an explicit sRGB
color space. Each frame starts from an opaque background, and sampled output
frames verify that alpha is 255. The encoder advertises BT.709 primaries,
transfer and matrix, limited/MPEG range, and center chroma location.

The previous `protocolDecode` metric was removed because it included work
performed after command decoding. r16 reports `protocolOverhead`, calculated
as the residual of total native process time after render, readback, raw write,
color conversion, frame encode and finalize. `mux` remains a sub-measurement
of `encode` and must not be added to it.

The r16 smoke execution `neonix-skia-command-cpu-bench-r4-qdswn` passed with
`alphaSamplesOpaque=true`, `surfaceColorSpace=srgb`,
`videoColorSpace=bt709`, and `videoColorRange=limited`. The 60s execution was
`neonix-skia-command-cpu-bench-r4-vfwkb` using image digest
`sha256:fed67c7be8f3b0cc16536ffd8e4b22667208c12e4fb75ebc6f1f5d2aeffeef67`.

| Stage/metric | r16 60s |
| --- | ---: |
| Cloud Run execution elapsed | 30.48 s |
| Cloud Run start/deploy wait | 8.90 s |
| Application wall | 19.150 s |
| Native process total | 18.467 s |
| Protocol overhead | 230.677 ms |
| Native Skia render | 4.601 s |
| Readback | 1.366 s |
| RGBA -> YUV420P (`libswscale`) | 10.215 s |
| H.264 encode | 2.029 s |
| MP4 mux | 37.372 ms |
| Finalize | 24.824 ms |
| Raw RGBA write / pipe backpressure | 0 / 0 |
| Native sample hash | `cd702832` at frame 0/mid/last |
| MP4 output | 355,238 bytes |
| MP4 SHA-256 | `80c6432514f1f722e44a7098ec33bbc0f67a2875ac8c3b2ae5fca8efe1846ac4` |

This is a cleaner attribution than r15. The protocol overhead is only about
`1.25%` of native process time, so the earlier `17s` protocol/decode value was
not a real parser bottleneck. The dominant measured stage remains color
conversion, followed by Skia render/readback and H.264 encode. Stage timings
are sequential attribution values; mux is nested inside the encode submission
path and must not be double-counted.

The r16 fixture is still the synthetic 60s shape scene. It proves the
correctness contract and instrumentation plumbing, but not F7 feature parity or
quality after decoding. The next quality gate is to retain a decoded MP4 sample
and compare it with the opaque RGBA reference using frame count, duration,
color metadata, pixel-diff, SSIM/PSNR and a dynamic fixture whose first, middle
and last frame hashes differ.
