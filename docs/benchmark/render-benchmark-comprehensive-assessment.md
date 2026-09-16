# Neonix Render Benchmark - Comprehensive Assessment

Date: 2026-09-16
Project: `neonix-506607`
Primary region: `asia-southeast1`
Timezone for interpretation: Asia/Bangkok

This is the consolidated assessment of the render benchmarks completed for
CanvasKit, native Skia CPU, native Skia Vulkan/L4 and the production-shaped
Cloud Run pipeline. It separates measured results from gated or invalid
experiments. A GPU device being visible is not treated as proof that Skia
rendered through the GPU.

## 1. Executive conclusion

The strongest valid result is the Cloud Run 4 vCPU / 16 GiB A/B benchmark on a
small but identical fixture:

- Native Skia CPU was about **30.3x faster** than CanvasKit for the measured
  render plus readback stage.
- Native Skia CPU was about **3.6x faster** for total application wall time.
- CanvasKit spent approximately **133.7 seconds in replay**, of which
  approximately **130.7 seconds was shape work**.
- Native Skia spent approximately **4.7 seconds in native render plus
  readback**; the remaining time was dominated by the raw RGBA pipe and
  FFmpeg pipeline.
- This is strong evidence that the current export bottleneck is the
  CanvasKit-WASM command replay path, especially the per-command shape/layer
  path. It is not evidence that every full Neonix project will obtain the same
  speedup after native feature parity.

The production-shaped 60-second benchmark remains much slower:

- Full-runtime Cloud Run result: **1,500.142 seconds / 25.00 minutes**.
- This equals approximately **25 seconds of wall time per second of output**.
- The aggregate Skia render time was **2,316.645 seconds** across six chunks.
- Segment encode was only **10.264 seconds** in aggregate and finalization was
  **44.455 seconds**.

The GPU experiment did not produce a valid Cloud Run render benchmark:

- Cloud Run exposed an NVIDIA L4 and `nvidia-smi` saw the device.
- Native Skia could not create a Vulkan instance because the runtime did not
  expose a usable NVIDIA Vulkan ICD.
- Every Cloud Run Vulkan attempt failed with
  `VK_ERROR_INCOMPATIBLE_DRIVER` or `fail:vulkan_context_unavailable`.
- GCE host validation succeeded: native Skia Ganesh created a real Vulkan
  context on an L4 with `softwareRenderer=false`.
- The same binary still failed inside the GCE Docker container, so the
  container/device/ICD contract is not solved.
- There is currently **no valid GPU render time, GPU speedup, GPU utilization,
  GPU MP4 or GPU parity result**.

Current strategic recommendation:

```text
CanvasKit       -> browser preview and compatibility reference
Native Skia CPU -> next export backend to complete and benchmark
GPU Vulkan      -> separate experiment after the runtime contract is solved
```

Do not switch production export to GPU based on the current evidence. Do not
claim that L4 improves render throughput yet.

## 2. What was actually measured

There are four different benchmark families. They must not be merged into one
statistical sample.

| Family | Environment | Backend | Fixture | Status |
| --- | --- | --- | --- | --- |
| Local P0 | Developer machine | CanvasKit-WASM raster | 30/300 frames | Valid directional CPU baseline |
| Production-shaped | Cloud Run | CanvasKit-based pipeline | 97 nodes, 1,800 frames, audio | Valid, slow full-runtime result |
| Controlled A/B | Cloud Run, 4 vCPU/16 GiB | CanvasKit vs native Skia CPU | 3 simple shape layers, 1,800 frames | Strong bottleneck evidence; native subset only |
| GPU L4 | Cloud Run and GCE | Skia Ganesh/Vulkan | POC / 3-frame smoke | Runtime proof only; no valid video benchmark |

This file supersedes the earlier benchmark baseline, native CPU report, GPU
L4 report and GPU backend plan. The implementation source files and Cloud Run
job manifests remain in the repository; only the duplicate standalone
benchmark documents are removed after this consolidation.

## 3. Benchmark configurations

### 3.1 Production-shaped Cloud Run pipeline

This is the closest measurement to the current application flow, including
queue, chunk workers, Supabase job state, R2 segments, central audio mix and
final MP4 publication.

| Parameter | Value |
| --- | --- |
| Project | `neonix-506607` |
| Region | `asia-southeast1` |
| Renderer resource | 2 CPU, 4 GiB |
| Renderer max instances | 1 |
| Renderer concurrency | 1 |
| Sequential job | 1 task, parallelism 1 |
| Chunk template | 8 tasks, actual count follows chunks |
| Actual benchmark chunks | 6 chunks x 300 frames |
| Chunk parallelism | 4, therefore two Cloud Run task waves |
| Finalizer | 1 task, parallelism 1 |
| Timeout | 3,600 seconds |
| Retries | 2 in the production-shaped configuration |
| Output scratch | `/tmp/neonix-export` |
| Output | R2 final MP4 |

### 3.2 Controlled CanvasKit/native CPU A/B

Both jobs used the same Cloud Run resource shape and one task. The only
meaningful backend change was the render implementation.

| Parameter | Value |
| --- | --- |
| CPU | 4 vCPU |
| Memory | 16 GiB |
| GPU | None |
| Tasks / parallelism | 1 / 1 |
| Timeout | 3,600 seconds |
| Retries | 0 |
| Resolution | 1920x1080 |
| Frame rate | 30 FPS |
| Duration | 60 seconds |
| Frames | 1,800 |
| FFmpeg video codec | `libx264` |
| FFmpeg preset | `veryfast` |
| FFmpeg threads | 1 |
| Pixel format | `yuv420p` |
| CRF | Default, 23 |
| Audio | None |

CanvasKit control:

- Job: `neonix-canvaskit-cpu-bench-r7`
- Image digest:
  `sha256:a882c55a48cf20fb1b5f2c538fefa9bd1a92707e3e5aa2e506b3bb20fca0ffe5`
- Execution: `neonix-canvaskit-cpu-bench-r7-sx4j6`

Native Skia CPU:

- Job: `neonix-skia-command-cpu-bench-r4`
- Image digest:
  `sha256:930460b2600a31e2744911f73a0a3e4102855bc4a4dd846ec6261269e416e9d5`
- Execution: `neonix-skia-command-cpu-bench-r4-l8m9s`

### 3.3 Cloud Run GPU probe and POC

| Parameter | Value |
| --- | --- |
| GPU | 1 x NVIDIA L4 |
| CPU | 4 vCPU |
| Memory | 16 GiB |
| Tasks / parallelism | 1 / 1 |
| Timeout | 3,600 seconds |
| Retries in smoke probe | 0 |
| Region | `asia-southeast1` |
| GPU zonal redundancy | Disabled |
| Intended backend | Native Skia Ganesh + Vulkan |
| Browser/CanvasKit | Not used in the native GPU POC |

### 3.4 GCE validation environment

GCE was introduced because Cloud Run exposed the L4 but did not expose a
usable Vulkan ICD to the container.

| Parameter | Value |
| --- | --- |
| Machine | `g2-standard-4` |
| Zone | `asia-southeast1-c` |
| GPU | NVIDIA L4 |
| Host driver | `615.71.09` |
| GPU memory reported | 23,034 MiB |
| Compute capability | 8.9 |
| Host Vulkan | Vulkan 1.4.351 |
| Host ICD | `/usr/share/vulkan/icd.d/nvidia_icd.json` |
| Container toolkit | NVIDIA Container Toolkit 1.20.0 |
| Container invocation | `--gpus all` |

The GCE VM was used to separate host driver/ICD behavior from Cloud Run's
managed GPU runtime. It was not a full production render worker.

## 4. Local CanvasKit CPU baseline

These runs used the local software CanvasKit backend and are not Cloud Run
latency measurements.

### 4.1 Local 30-frame run

| Stage | Time |
| --- | ---: |
| Compile and prepare | 3.512 s |
| Worker request | 4.134 s |
| Worker render | 2.469 s |
| Worker encode | 0.761 s |
| Artifact download | 0.062 s |
| End to end | 8.244 s |
| Frames | 30 |

Render breakdown:

| Stage | Time |
| --- | ---: |
| Evaluate | 0.008 s |
| Asset resolve | 0.001 s |
| Skia replay | 2.154 s |
| Readback | 0.085 s |
| `endLayer` | 2.004 s |

### 4.2 Local 300-frame run

| Stage | Time | Share |
| --- | ---: | ---: |
| Compile and prepare | 3.567 s | - |
| Worker request | 66.199 s | - |
| Worker render | 64.781 s | - |
| Worker encode | 0.563 s | - |
| Artifact download | 0.032 s | - |
| End to end | 70.353 s | - |
| Evaluate | 0.084 s | 0.13% of render |
| Asset resolve | 0.003 s | 0.00% of render |
| Skia replay | 63.885 s | 98.62% |
| Readback | 0.739 s | 1.14% |
| `endLayer` | 60.808 s | 93.87% |

### 4.3 Local parallelism result

The local 1,800-frame run with parallelism 4 took:

- Render: **540.16 seconds**
- Encode: **0.25 seconds**
- Frames: **1,800 / 60 seconds of output**

This confirms the local bottleneck was not H.264 encoding. It also shows that
parallelism alone does not solve an expensive per-frame replay path.

### 4.4 Local audio run

The latest local 10-second audio run reported:

| Stage | Time |
| --- | ---: |
| R2 source download | 15.73 s |
| Audio preparation | 15.52 s |
| Skia render | 63.95 s |
| Encode/mux | 0.51 s |
| Output | 300 H.264 frames, one AAC stream, 10.000 s |

The timers have different scopes and were not treated as strictly additive.

## 5. Production-shaped Cloud Run result

Run: `rnd_phase5_mu2jf68s`

Fixture:

- 97 visual nodes.
- 1920x1080, 30 FPS, 60 seconds.
- 1,800 frames.
- Six chunks of 300 frames.
- Audio enabled.
- Final output had one AAC stream at 48 kHz stereo.
- Pretty runtime JSON: 77,716,002 bytes.
- Compact manifest: 30,072,139 bytes.
- Manifest persisted as 29 private chunks of 1 MiB.

### 5.1 End-to-end timing

| Stage | Time |
| --- | ---: |
| Job creation to first chunk started | 671.414 s |
| Chunk execution wall | 781.191 s |
| Aggregate Skia render across chunks | 2,316.645 s |
| Aggregate segment encode | 10.264 s |
| Finalizer execution wall | 44.455 s |
| Parent end-to-end | 1,500.142 s = 25.00 min |

The six chunk render times were:

| Chunk | Render time | Output span |
| --- | ---: | ---: |
| 0 | 78.464 s | 10 s |
| 1 | 281.769 s | 10 s |
| 2 | 433.089 s | 10 s |
| 3 | 463.571 s | 10 s |
| 4 | 602.776 s | 10 s |
| 5 | 456.977 s | 10 s |

The slowest chunk took approximately 60.3 seconds of compute per second of
output. The total parent wall time was approximately 25 seconds per second of
output.

### 5.2 Initialization diagnosis

The 671.414-second value must not be called pure Docker or Cloud Run cold
start. Cloud Run reported:

- Chunk container startup: 12.1 s.
- Chunk image import: 1.13 s.
- Finalizer container startup: 23.28 s.
- Finalizer image import: 1.17 s.

The Supabase job was created at `10:37:14Z`; the chunk execution was created at
`10:48:04Z`. Approximately 649.5 seconds elapsed before the Cloud Run
execution existed. The evidence points to queue/control-plane dispatch or
benchmark orchestration, not container boot, as the main initialization gap.

The renderer image was also too large for an ideal production image:
approximately 3.73 GB unpacked. It is an optimization target, but the evidence
does not establish it as the cause of the 11-minute pre-execution gap.

### 5.3 Compact Cloud Run parallelism matrix

All rows rendered 1,800 frames / 60 seconds using the compact visual fixture.

| Run | Topology | Parent wall | Chunk wall | Finalizer wall |
| --- | --- | ---: | ---: | ---: |
| `rnd_phase5_mu25ik79` | 6 x 300, p2 | 227.249 s | 177.244 s | 32.250 s |
| `rnd_phase5_mu24wv9p` | 6 x 300, p4 | 147.823 s | 114.807 s | 21.772 s |
| `rnd_phase5_mu25obhm` | 6 x 300, p8 | 111.744 s | 74.386 s | 26.006 s |
| `rnd_phase5_mu26cmje` | 6 x 300, p4, FFmpeg 1 thread | 184.242 s | 116.281 s | 22.292 s |
| `rnd_phase5_mu26h2kg` | 6 x 300, p4, FFmpeg 1 thread | 150.216 s | 104.848 s | 28.754 s |

Observed sample over 11 recorded rows, combining image revisions and Cloud
Run scheduling conditions:

- Minimum: 111.744 s.
- p50: 175.613 s.
- Linear-sample p95: 216.723 s.
- Maximum: 227.249 s.
- Mean: 173.529 s.

The 150-frame chunk run took 176.995 s. Smaller chunks increased coordination
and encoding overhead for this fixture.

## 6. Controlled CanvasKit versus native Skia CPU A/B

This is the cleanest bottleneck experiment because both jobs used the same
Cloud Run resource shape, duration, frame count and fixture.

### 6.1 Summary

| Application stage | Native Skia CPU | CanvasKit-WASM CPU |
| --- | ---: | ---: |
| Runtime evaluation | 142.573 ms | 378.588 ms |
| Native/direct render | 3,642.943 ms | - |
| Native/readback | 1,055.947 ms | 7,370.007 ms |
| CanvasKit replay | - | 133,694.763 ms |
| CanvasKit shape work | - | 130,684.065 ms |
| Render total | 4,698.890 ms | 142,243.210 ms |
| Encode total | Part of pipeline | 5,751.120 ms |
| Producer/output blocking | 36,372.854 ms raw write | 5,340.374 ms backpressure |
| Application wall | 41,278.672 ms | 147,994.331 ms |
| Cloud Run execution elapsed | 62.459 s | 168.437 s |

Derived ratios:

- Render + readback: `142,243.210 / 4,698.890 = 30.27x`.
- Application wall: `147,994.331 / 41,278.672 = 3.58x`.
- Cloud Run execution elapsed: `168.437 / 62.459 = 2.70x`.
- Application wall per second of output:
  - Native: approximately 0.688 s/s.
  - CanvasKit: approximately 2.467 s/s.

### 6.2 CanvasKit control details

Execution: `neonix-canvaskit-cpu-bench-r7-sx4j6`

| Metric | Value |
| --- | ---: |
| Render | 142,243.210 ms |
| Encode | 5,751.120 ms |
| Evaluate | 378.588 ms |
| Asset resolve | 16.900 ms |
| Paint and readback | 141,168.209 ms |
| Replay | 133,694.763 ms |
| Shape | 130,684.065 ms |
| Readback | 7,370.007 ms |
| Flush | 10.805 ms |
| Draw calls | 5,400 |
| Pipe write | 206.128 ms |
| Backpressure wait | 5,340.374 ms |
| Finalize | 161.244 ms |
| Output | 203,025 bytes |
| MP4 SHA-256 | `c7affbc84b03ff4c305ce1b38ed8636fbebbd7765a9244d64d6309d057aedc5a` |
| Raw sample FNV32 | `45c06e5d` for frame 0, 900 and 1799 |

Interpretation: the dominant work is replay/shape, not evaluator, asset
resolution, flush or H.264 encoding.

### 6.3 Native Skia CPU details

Execution: `neonix-skia-command-cpu-bench-r4-l8m9s`

| Metric | Value |
| --- | ---: |
| Protocol encode | 54.084 ms |
| Protocol backpressure | 38,022.499 ms |
| Native process | 41,128.812 ms |
| Native protocol decode / blocked process time | 41,117.743 ms |
| Native render | 3,642.943 ms |
| Native readback | 1,055.947 ms |
| Native raw write | 36,372.854 ms |
| Application wall | 41,278.672 ms |
| FFmpeg pipeline | 41,259.596 ms |
| Output | 203,631 bytes |
| MP4 SHA-256 | `9c4d1cc7424b1317d2f3394747e2995a8b0bbae4e3b3da56a0476e96d6de6ecd` |
| Raw sample FNV32 | `dd114914` for frame 0, middle and last |

Important interpretation: `protocolDecode` is not pure binary parsing time. It
includes time during which the native process is blocked writing raw frames to
the FFmpeg pipeline. The clean native raster numbers are render plus readback:
4,698.890 ms.

One 1920x1080 RGBA frame is about 8.29 MB decimal, and 1,800 frames produced
14,929,920,000 bytes of raw data. The raw pipe therefore became the next
visible bottleneck after CanvasKit replay was removed.

### 6.4 Limitations of the native CPU result

The native benchmark used the same TypeScript evaluator but a versioned binary
protocol containing only a certified subset:

```text
beginFrame
setTransform
drawShape
endFrame
```

Unsupported commands fail closed. The native path did not yet render the full
Neonix command set, including text, images, paths, video, masks, filters and
complex effects. It therefore proves the performance direction, not full
production parity.

## 7. Visual parity and correctness

The native and CanvasKit outputs were not pixel-identical in the A/B run:

| Artifact | Native | CanvasKit |
| --- | --- | --- |
| Raw sample FNV32 | `dd114914` | `45c06e5d` |
| MP4 size | 203,631 bytes | 203,025 bytes |
| MP4 SHA-256 | `9c4d1c...e6ecd` | `c7affb...edc5a` |

Different MP4 hashes alone are not enough to conclude visual failure because
container metadata and encoder decisions can differ. In this case the raw
sample hashes also differ, so native parity is not yet proven.

Reasons that must be controlled before production switching:

1. Same pinned Skia revision and build flags.
2. Same premultiplied RGBA format and explicit sRGB color space.
3. Same anti-aliasing, filtering, rounding and transform rules.
4. Same image decode and normalization path.
5. Same bundled font bytes, glyph shaping and fallback behavior.
6. Same frame time, frame index and deterministic random/effect seed.
7. Pixel-diff thresholds measured on decoded frames, not MP4 SHA-256 alone.

## 8. GPU L4 results

### 8.1 Cloud Run capacity smoke

Execution: `neonix-render-chunk-l4-bench-4h524`

| Metric | Value |
| --- | ---: |
| GPU | NVIDIA L4 |
| GPU memory | 23,034 MiB |
| Compute capability | 8.9 |
| Driver | 580.126.20 |
| Image import | 3.1 s |
| Started deployed execution | 12.76 s |
| Execution duration | 19.04 s |
| Probe duration | 1,381.316 ms |
| Vulkan result | `VK_ERROR_INCOMPATIBLE_DRIVER` |
| Estimated compute cost | approximately $0.0055 |
| Verdict | L4 visible; Vulkan not proven |

This first probe was too permissive and returned exit 0 despite Vulkan failure.
It is retained as historical evidence only.

### 8.2 Strict Cloud Run failure probe

Execution: `neonix-render-chunk-l4-bench-smjsl`

| Metric | Value |
| --- | ---: |
| GPU | NVIDIA L4, 23,034 MiB |
| Driver | 580.126.20 |
| Cloud Run result | Failed as expected |
| Exit code | 11 |
| Vulkan result | `fail:vulkan_context_unavailable` |
| Probe duration | 1,532.187 ms |
| Estimated compute cost | approximately $0.0062 |
| Verdict | Fail-closed behavior works; Vulkan unavailable |

The runtime set an NVIDIA library path and exposed libraries such as
`libnvidia-glvkspirv.so.580.126.20` and
`libnvidia-vksc-core.so.580.126.20`, but no usable NVIDIA Vulkan ICD JSON was
available to the Vulkan loader.

### 8.3 Native Skia POC on Cloud Run

The native Ganesh/Vulkan image compiled successfully, but the Cloud Run
execution failed before frame rendering.

| Metric | Value |
| --- | --- |
| Job | `neonix-skia-gpu-poc-l4` |
| Resource | 1 L4, 4 CPU, 16 GiB |
| Skia revision | `00bc6c117cf10d37e02753b014cd5b5df979e67f` |
| Build duration | 7m44s for initial POC image |
| Cloud Run result | Failed, exit 11 |
| GPU identity | L4, 23,034 MiB, driver 580.126.20 |
| Native error | `vkCreateInstance failed: -9` |
| Skia error | `Skia_test_context_creation_failed` |
| Frame timing | Not available |
| GPU utilization | Not available |
| MP4 output | None |

The source-matched follow-up image also failed:

| Metric | Value |
| --- | ---: |
| Build | `b62ce5e6-44fa-492d-a3b3-dcb3258c21d6` |
| Build duration | 8m08s |
| Image digest | `sha256:0ed8b12b91ade89b35578042370316a28e97c395cf08cc36633f948033279435` |
| Image import | 2.03 s |
| Started deployed execution | 13.4 s |
| Result | Failed, exit 11 |
| Vulkan error | `vkCreateInstance failed: -9` |

Setting `NVIDIA_DRIVER_CAPABILITIES=all` did not change the result. Adding
loader dependencies and testing a synthetic ICD manifest also did not solve
the problem. The EGL diagnostic branch failed at `eglInitialize` as well.

These are startup/fail-fast timings only. They are not GPU render timings.

### 8.4 GCE host-native Vulkan proof

On the GCE `g2-standard-4` host, the r17 native executable ran outside Docker:

```json
{
  "ok": true,
  "requestedBackend": "skia-gpu",
  "actualBackend": "skia-ganesh-vulkan",
  "surfaceKind": "vulkan",
  "softwareRenderer": false,
  "adapter": "NVIDIA L4",
  "width": 320,
  "height": 180,
  "frames": 3,
  "timingsMs": {
    "contextSetup": 234.727,
    "surfaceCreate": 0.168,
    "renderSubmit": 30.898,
    "readback": 0.451,
    "total": 269.597
  }
}
```

This is the first valid proof that the native Skia Vulkan implementation can
create a real L4-backed context. It is not a production container benchmark:

- only 3 frames;
- only 320x180;
- executable ran directly on the host, outside Docker;
- no full PaintCommandBuffer replay;
- no 1920x1080 video;
- no FFmpeg pipeline;
- no audio;
- no Cloud Run execution;
- no GPU throughput comparison.

### 8.5 GCE Docker result

The same r17 artifact was run with `--gpus all`, explicit graphics
capabilities, mounted host ICD and NVIDIA device files. Host-native Vulkan
passed, but the container failed with:

```text
Could not get 'vkCreateInstance' via 'vk_icdGetInstanceProcAddr'
vkCreateInstance failed with ERROR_INCOMPATIBLE_DRIVER
```

The following experiments did not make the container pass:

- `libvulkan1` and `vulkan-tools` installation;
- X11/XCB/Wayland runtime libraries;
- `NVIDIA_DRIVER_CAPABILITIES=all`;
- `NVIDIA_DISABLE_REQUIRE=1`;
- explicit `VK_ICD_FILENAMES`;
- CDI device mode;
- privileged mode;
- read-only mounting of `nvidia_icd.json`.

Conclusion:

```text
GCE host driver + host ICD + native Skia: proven
GCE Docker + NVIDIA Toolkit + Vulkan ICD: unresolved
Cloud Run managed Vulkan: unresolved/failed
```

## 9. GPU build and runtime errors

### 9.1 Cloud Run errors

The main error was:

```text
VK_ERROR_INCOMPATIBLE_DRIVER
vkCreateInstance failed: -9
```

The root evidence is a missing or unusable Vulkan ICD contract inside the
managed container runtime. `nvidia-smi` visibility was insufficient.

### 9.2 GPU probe false-positive contract

The first probe exited successfully even though Vulkan initialization failed.
The probe was corrected to return non-zero on Vulkan failure. This is why the
strict probe is the authoritative result.

### 9.3 Native Skia build errors

The reproducible Docker build required several iterations:

- dependency transport failures;
- `depot_tools` bootstrap issues;
- missing optional partition/wuffs sources;
- GCC/PDF incompatibility;
- dependency synchronization behavior in the build environment.

The Docker build was made reproducible. No CPU fallback was added to hide GPU
initialization failure.

### 9.4 Native POC teardown error

An earlier GCE host run exposed a teardown-order segmentation fault. The native
code was corrected to release Skia's VMA allocator before manually destroying
`VkDevice`. This was a POC lifecycle bug, not evidence of a render failure.

### 9.5 Local test reliability error

The full export-renderer test suite first reported 145/146 because a Windows
file-backed job store encountered `EPERM` during an atomic rename under
concurrent test activity. The affected async-render test passed when rerun
alone. This remains a local test-environment reliability issue, not a GPU
result.

### 9.6 Docker and image issues

- The local Docker daemon was unavailable during the initial P0 GPU setup.
- The full-runtime renderer image was approximately 3.73 GB unpacked.
- The benchmark image copied the monorepo and installed the workspace, which
  is suitable for an experiment but not ideal for production cold/import time.
- Image import was only a few seconds in the controlled A/B runs, so image size
  has not been proven to be the main CanvasKit render bottleneck.

## 10. Architecture interpretation

The shared architecture is valid:

```text
RuntimeProjectV3
  -> shared frame evaluator
  -> PaintCommandBuffer
  -> backend-specific replay
```

Current production path:

```text
PaintCommandBuffer
  -> CanvasKit-WASM raster surface
  -> readPixels()
  -> bounded FFmpeg input
  -> MP4
```

Current native CPU experiment:

```text
PaintCommandBuffer subset
  -> versioned binary protocol
  -> native Skia child process
  -> raster RGBA stdout
  -> FFmpeg
```

Current native GPU experiment:

```text
native Skia POC
  -> Ganesh Vulkan context
  -> L4 surface
  -> readback
```

The native CPU benchmark is not an N-API or Rust binding yet. It is a separate
process. That is a valid isolation strategy for benchmarking and can later be
replaced by an addon or a long-lived worker process after the protocol and
capability contract stabilize.

## 11. Why native CPU is the next rational path

The A/B data supports completing native CPU before investing further in GPU:

1. CanvasKit replay/shape dominates the controlled CPU run.
2. Native Skia removes the measured WASM replay cost on the certified subset.
3. FFmpeg was negligible in the local and production-shaped render breakdowns.
4. Native CPU already achieved less than one second of application wall time
   per second of output on the simple fixture.
5. GPU has not passed the runtime environment gate.
6. GPU readback would still be required for the current FFmpeg architecture,
   so GPU drawing speed could be reduced by GPU-to-CPU transfer.

This does not prove that no GPU will ever be needed. It means the next valid
decision must be made after a full native CPU fixture, not before.

## 12. Native CPU work still required

Before native CPU can replace CanvasKit for export, implement and benchmark:

- `drawText` with bundled fonts, glyph shaping and fallback;
- `drawImage` with PNG/JPEG/WebP/SVG normalization;
- `drawVideo` with deterministic frame extraction and asset cache;
- `drawPath`, stroke joins, caps, dash effects and transforms;
- save/restore and isolated offscreen surfaces;
- blur, shadow, color filter, blend and masks;
- projective image/mesh rendering;
- color and alpha parity;
- deterministic cache lifecycle across frame ranges;
- long-lived native worker or efficient IPC without raw-frame copies;
- audio remains a separate preparation/mix/finalizer concern.

The current native Docker POC disables several font and image codec features:

```text
skia_use_freetype=false
skia_use_fontconfig=false
skia_use_harfbuzz=false
skia_use_libjpeg_turbo_decode=false
skia_use_libpng_decode=false
skia_use_libwebp_decode=false
```

Those flags are acceptable for the simple POC but must not remain in a full
production native image.

## 13. Required next benchmark matrix

The next benchmark should use one pinned native CPU image and a fixture ladder:

| Fixture | Content | Purpose |
| --- | --- | --- |
| F0 | Solid background and basic shapes | Protocol/raster baseline |
| F1 | Text, multiple fonts and fallback | Font correctness/performance |
| F2 | PNG/JPEG/WebP/SVG images | Decode/cache behavior |
| F3 | Paths, stroke, clip, blend | Vector parity |
| F4 | Blur, shadow, masks, saveLayer | Offscreen/effect cost |
| F5 | Video poster and video frame | Media decode path |
| F6 | Detached audio and mixed audio | Finalizer/mux contract |
| F7 | Full 97-node, 60-second runtime | Production-shaped throughput |

For each fixture, run:

- 1 second / 30 frames;
- 10 seconds / 300 frames;
- 60 seconds / 1,800 frames;
- cold image run;
- at least three warm runs;
- 1, 2 and 4 worker/chunk parallelism where applicable.

Record:

```text
job_created
queue_received
execution_created
container_started
renderer_ready
manifest_loaded
first_frame_started
last_frame_finished
finalizer_started
published
verified
evaluate_ms
asset_decode_ms
replay_ms
flush_ms
readback_ms
native_ipc_ms
raw_pipe_ms
encode_ms
audio_prepare_ms
upload_ms
peak_rss
cpu_seconds
gpu_utilization_when_applicable
output_frame_count
pixel_diff / SSIM / PSNR
artifact checksum
error code
```

## 14. Acceptance gates

### Native CPU export gate

- Full F7 fixture completes successfully.
- All commands are either supported or fail explicitly before publishing.
- No silent missing text, image, video or effect commands.
- Native output passes decoded-frame parity thresholds against CanvasKit.
- 60-second F7 wall time meets the agreed product target.
- Audio output contains exactly one correctly mixed AAC stream.
- R2 publication, retry, cancellation and cleanup remain correct.

### GPU gate

GPU work should resume only when all of these are true:

1. The exact worker container creates a Vulkan instance.
2. The adapter is NVIDIA L4 and `softwareRenderer=false`.
3. Full command replay works on the GPU surface.
4. Pixel parity passes.
5. GPU-to-CPU readback is measured.
6. GPU total pipeline time beats native CPU after readback and encoding.
7. Cost per finished video is better or the latency benefit justifies cost.

## 15. Final decision

Based on the evidence currently available:

```text
CanvasKit is the measured render bottleneck for the certified simple fixture.
Native Skia CPU is the highest-confidence next export strategy.
Cloud Run 4 vCPU is sufficient for the next native CPU experiment.
GPU L4 is not yet a usable Cloud Run backend.
GCE proved the host can run Vulkan, but not the Docker container contract.
```

The immediate engineering priority should be to complete native CPU replay and
run the full fixture ladder. GPU should remain isolated behind a feature flag
and should not receive production traffic until its runtime, parity and total
pipeline benchmarks are valid.
