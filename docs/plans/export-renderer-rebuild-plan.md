# Neonix Export Renderer Rebuild Plan

## 1. Mục tiêu

Build lại luồng export video của Neonix để đạt bốn mục tiêu:

- đo đúng thời gian của từng tầng thay vì gộp frame production vào `encodeMilliseconds`;
- export ổn định video 60 giây ở 1920×1080, 30 FPS mà không phụ thuộc vào một HTTP request kéo dài;
- giảm chi phí compile/runtime trước khi đầu tư vào GPU hoặc thay encoder;
- giữ tính deterministic và pixel parity giữa Preview, Runtime và Export.

Kế hoạch này không phải một đợt rewrite toàn bộ. Các abstraction đang đúng và cần giữ lại:

```text
MotionProtocolV2
  → RuntimeProject
  → PaintCommandBuffer
  → Renderer
  → Encoder
  → Muxer / Artifact
```

Skia + FFmpeg hiện tại tiếp tục là golden export backend trong lúc xây pipeline mới.

---

## 2. Baseline đã quan sát

Fixture chuẩn:

```text
docs/preview/html-compiler/export-samples/neonix-overview-60s.html
1920 × 1080
30 FPS
60 giây
1.800 frame
```

Kết quả hiện tại:

| Chỉ số | Giá trị quan sát |
| --- | ---: |
| Compile + prepare Runtime V3 | khoảng 60,9 giây |
| Runtime JSON | khoảng 77 MB |
| Probe 30 frame: worker request | khoảng 10,9 giây |
| Probe 30 frame: download | khoảng 38 ms |
| Full 1.800 frame | chưa hoàn tất sau hơn 18 phút |
| CPU trong full render | Node cao, FFmpeg thấp |

Lưu ý: số `encodeMilliseconds` hiện tại không phải thời gian encode thuần. FFmpeg bắt đầu timer trước khi consume async frame stream, nên metric này đang bao gồm:

```text
evaluate
+ asset resolve
+ Skia paint
+ readPixels
+ Buffer copy
+ pipe backpressure
+ H.264 encode
```

Do đó chưa được dùng số liệu cũ để kết luận Skia hay FFmpeg chiếm bao nhiêu phần trăm.

---

## 3. Pipeline hiện tại

```text
HTML/CSS
  → HTML Compiler
  → MotionProtocolV2
  → compileAndPrepareRuntimeProjectV3
  → bake visualTimeline cho 1.800 frame
  → JSON.stringify RuntimeProjectV3
  → POST /v1/renders
  → validate project
  → evaluateRuntimeProjectV3(frame)
  → PaintCommandBuffer
  → CanvasKit/Skia raster surface
  → readPixels RGBA
  → Buffer.from(pixels)
  → FFmpeg stdin
  → libx264/yuv420p
  → MP4
  → tải artifact về web service
  → lưu object storage
```

Các vấn đề chính:

1. Compiler gọi `sampleMotionProtocolAtTime()` và `compileVisualProject()` cho gần như mọi frame.
2. Runtime payload lớn và được gửi nguyên khối trong request.
3. Runtime validation đang xảy ra trong đường evaluate frame.
4. Mỗi frame map/merge lại scene nodes và tạo command buffer mới.
5. Node export dùng CanvasKit raster/readback, không phải GPU direct presentation.
6. Render và encode bị ghép trong một async iterator tuần tự.
7. Chưa có frame-range concurrency.
8. Worker API chờ toàn bộ render hoàn tất mới trả response.
9. Partial MP4 không hợp lệ nếu process bị dừng trước khi mux hoàn tất.

---

## 4. Phạm vi

### Trong phạm vi

- benchmark và instrumentation;
- compiler/runtime representation cho animation;
- prepared runtime và frame evaluator;
- Skia CPU renderer hiện tại;
- asset/font/cache lifecycle;
- async render jobs;
- progress, cancellation, retry và idempotency;
- render theo frame range/chunk;
- FFmpeg software encoding và hardware encoder tùy chọn;
- artifact storage và atomic publish;
- thử nghiệm GPU renderer sau khi CPU baseline ổn định;
- E2E fixture 60 giây và pixel parity.

### Ngoài phạm vi ban đầu

- rewrite toàn bộ Runtime V3;
- loại bỏ FFmpeg hoàn toàn;
- hỗ trợ mọi CSS trực tiếp trong export worker;
- bắt buộc WebGPU/WebCodecs trong production;
- distributed render đa vùng;
- thay đổi editor/preview UI không liên quan đến export progress.

---

## 5. Quyết định kiến trúc

### 5.1 Giữ các boundary hiện có

```text
Compiler
  → Runtime
  → Frame Evaluator
  → Paint Commands
  → Frame Renderer
  → Encoder
  → Muxer
```

Không để renderer tự diễn giải HTML/CSS. Export worker chỉ consume runtime đã compile.

### 5.2 Validation chỉ chạy tại boundary

Validation đầy đủ chạy khi:

- nhận render bundle;
- restore bundle từ storage;
- bắt đầu một render job.

Render loop chỉ nhận `PreparedRuntimeProject`, không validate lại toàn project cho từng frame.

### 5.3 Renderer và encoder là hai interface độc lập

Target interface:

```ts
type FrameRange = {
  startFrame: number;
  endFrameExclusive: number;
};

type RenderedFrame = {
  frame: number;
  rgba: Uint8Array;
  timings: FrameTimings;
};

interface FrameRenderer {
  prepare(project: PreparedRuntimeProject): Promise<void>;
  render(frame: number): Promise<RenderedFrame>;
  dispose(): Promise<void>;
}

interface VideoEncoder {
  open(config: EncodeConfig): Promise<void>;
  write(frame: RenderedFrame): Promise<void>;
  finalize(): Promise<EncodedArtifact>;
  abort(reason: Error): Promise<void>;
}
```

Implementation đầu tiên:

```text
SkiaCpuFrameRenderer
FfmpegH264Encoder
```

Các implementation thử nghiệm về sau:

```text
SkiaGpuFrameRenderer
WebGl2FrameRenderer
HardwareFfmpegEncoder
WebCodecsEncoder
```

### 5.4 Không truyền Runtime JSON lớn trong request dài hạn

Web service tạo immutable render bundle:

```text
runtime.json hoặc runtime binary
manifest.json
asset references
content hash
```

Bundle được lưu một lần. Worker nhận manifest URL/key và checksum thay vì body JSON 77 MB.

### 5.5 Export là async job

```text
POST /v1/render-jobs       → 202 + jobId
GET  /v1/render-jobs/:id   → status + progress + metrics
DELETE /v1/render-jobs/:id → cancel
```

Không giữ request mở trong toàn bộ quá trình render.

### 5.6 GPU là optimization có feature flag

GPU backend chỉ được bật khi:

- host có GPU và driver đã xác nhận;
- backend pass pixel parity suite;
- benchmark nhanh hơn Skia CPU trên cùng fixture;
- có fallback tự động về golden backend.

Không giả định WebGL/WebGPU trong Docker sẽ tự động dùng hardware acceleration.

---

## 6. Kiến trúc mục tiêu

```text
Client / API
    │
    ▼
Create Export Job
    │
    ├── compile immutable render bundle
    ├── validate once
    ├── persist manifest/runtime/assets
    └── enqueue job
    │
    ▼
Render Planner
    │
    ├── capability check
    ├── select backend/preset
    ├── calculate frame ranges
    └── reserve worker resources
    │
    ▼
Frame Workers
    │
    ├── prepare runtime once
    ├── cache fonts/images/geometry
    ├── evaluate frame delta
    ├── render frame
    └── produce encoded segment
    │
    ▼
Stitch / Audio / Mux
    │
    ├── verify frame continuity
    ├── mix AAC audio
    ├── concatenate encoded segments
    └── finalize MP4
    │
    ▼
Atomic Artifact Publish
    │
    ├── object storage
    ├── checksum / ffprobe validation
    └── webhook / status done
```

Backend baseline:

```text
Prepared Runtime
  → Skia CPU
  → RGBA stream
  → FFmpeg H.264
```

Backend thử nghiệm:

```text
Prepared Runtime
  → GPU compositor
  → hardware encoder hoặc readback
  → MP4 muxer
```

---

## 7. Phase 0 — Measurement và benchmark contract

### Mục tiêu

Có số liệu độc lập cho từng stage trước khi tối ưu.

### Việc cần làm

- thay `renderMilliseconds` và `encodeMilliseconds` bằng stage timings rõ nghĩa;
- đo cold start và warm start riêng;
- thêm timing cho mỗi frame:
  - `validateMs`;
  - `evaluateMs`;
  - `assetResolveMs`;
  - `paintMs`;
  - `readbackMs`;
  - `bufferCopyMs`;
  - `pipeWriteMs`;
  - `pipeDrainWaitMs`;
- thêm job timings:
  - `compileMs`;
  - `runtimePrepareMs`;
  - `serializeMs`;
  - `uploadMs`;
  - `workerStartupMs`;
  - `frameProductionMs`;
  - `encoderFinalizeMs`;
  - `artifactPersistMs`;
  - `totalMs`;
- ghi p50/p95/max frame time và danh sách slowest frames;
- ghi peak RSS, heap used, external buffer bytes và CPU utilization;
- log progress mỗi 30 frame hoặc mỗi 1 giây;
- output benchmark JSON có version để so sánh giữa commit;
- không ghi URL ký, token hoặc credential vào benchmark artifact.

### Benchmark matrix

Chạy cùng một image Docker và cùng một máy:

| Case | Frame count | Mục đích |
| --- | ---: | --- |
| startup | 1 | CanvasKit/font/FFmpeg cold start |
| smoke | 30 | correctness nhanh |
| short | 300 | throughput 10 giây |
| full | 1.800 | E2E 60 giây |

Mỗi case chạy:

- một lần cold;
- ba lần warm;
- không audio;
- có audio;
- fixture ít effect;
- fixture nhiều blur/mask/text.

### Tiêu chí hoàn thành

- tổng stage timings sai lệch không quá 2% so với wall clock;
- `frameProductionMs` không còn bị tính vào `encodeMs`;
- biết được top 10 slowest frame và stage gây chậm;
- full run luôn có progress và có thể phân biệt slow với stalled;
- benchmark artifact chứa git commit, image digest và thông tin CPU/GPU.

### File dự kiến

- `packages/export-renderer/src/render/types.ts`
- `packages/export-renderer/src/render/render.ts`
- `packages/export-renderer/src/render/ffmpeg.ts`
- `packages/export-renderer/src/api/server.ts`
- `apps/web/scripts/export-neonix-60s.ts`
- `packages/export-renderer/test/*`

---

## 8. Phase 1 — Compiler và compact animation runtime

### Mục tiêu

Không compile toàn bộ visual project 1.800 lần chỉ để tạo frame deltas.

### Bước ngắn hạn, tương thích Runtime V3

- compile static visual nodes đúng một lần;
- xác định trước node/property nào có animation;
- sample trực tiếp animation tracks cho các property thay đổi;
- không gọi `compileVisualProject()` cho toàn scene ở mỗi frame;
- chỉ tạo delta cho node thực sự thay đổi;
- bỏ field bằng base value khỏi delta;
- tránh `JSON.stringify()` lặp lại để fingerprint matrix/content;
- thêm thống kê:
  - số static nodes;
  - số animated nodes;
  - số delta trung bình mỗi frame;
  - payload bytes/frame.

### Bước dài hạn

Nếu V3 vẫn cần đủ 1.800 frame entries và payload không đạt mục tiêu, thiết kế contract version mới:

```text
RuntimeProjectV4
  ├── static visual scene
  ├── compiled animation tracks
  ├── media timeline
  ├── audio timeline
  └── deterministic evaluator metadata
```

Không thay đổi ngầm semantic của Runtime V3. Contract mới phải có migration và parity tests.

### Tiêu chí hoàn thành

- compile fixture 60 giây giảm ít nhất 80% so với baseline;
- runtime payload giảm ít nhất 70%;
- frame 0, giữa và cuối khớp golden command buffer;
- mọi frame có kết quả deterministic qua nhiều lần chạy;
- compiler tests và runtime validation tests pass.

### File dự kiến

- `packages/motion-compiler/src/runtime-project-v3.ts`
- `packages/motion-compiler/src/animation/*`
- `packages/motion-runtime/src/project/types.ts`
- `packages/motion-runtime/src/project/validate.ts`
- `packages/motion-compiler/src/runtime-project-v3.test.ts`

---

## 9. Phase 2 — Prepared runtime và frame evaluator

### Mục tiêu

Giảm công việc lặp lại trong mỗi frame.

### Việc cần làm

- tạo `prepareRuntimeProject()` chạy một lần/job;
- validation đầy đủ trước khi tạo prepared runtime;
- build các index dùng lại:
  - node by id;
  - ordered nodes;
  - animated node ids;
  - asset references;
  - text/font references;
  - effect dependencies;
- evaluator nhận prepared runtime và không validate lại;
- áp dụng delta theo frame mà không map/clone toàn bộ node không đổi;
- reuse command buffer arrays khi an toàn;
- phân biệt dirty state:
  - transform dirty;
  - opacity dirty;
  - geometry dirty;
  - paint dirty;
  - effect dirty;
  - media frame dirty;
- giữ API thuần/deterministic để có thể render frame ranges độc lập;
- không dùng mutable global state giữa các job.

### Tiêu chí hoàn thành

- validation chỉ chạy một lần/job;
- evaluate p95 giảm ít nhất 70% trên fixture chuẩn;
- random-access frame cho kết quả giống sequential frame;
- render cùng project ở hai process tạo cùng golden frame hashes;
- không tăng memory theo số frame đã render.

### File dự kiến

- `packages/motion-runtime/src/project/visual.ts`
- `packages/motion-runtime/src/visual/evaluate.ts`
- `packages/motion-runtime/src/paint/*`
- `packages/export-renderer/src/render/render.ts`
- runtime/evaluator tests tương ứng.

---

## 10. Phase 3 — Tối ưu Skia CPU golden backend

### Mục tiêu

Có một backend CPU đúng, ổn định và đủ nhanh trước khi thử GPU.

### Việc cần làm

- load CanvasKit một lần/process thay vì một lần/job nếu lifecycle cho phép;
- cache font/typeface theo content hash;
- chỉ gọi `setAsset()` khi asset identity thay đổi;
- xác nhận image/filter/mask/projective cache hit rate;
- thêm geometry/path cache theo immutable fingerprint;
- đo và giảm allocation trong `readPixels`/`Buffer.from`;
- dùng buffer pool có giới hạn nếu CanvasKit API cho phép;
- không giữ nhiều frame RGBA trong RAM;
- kiểm tra effect bounds để tránh offscreen surface bằng full composition khi không cần;
- thử static subtree surface cache sau khi có dirty-state contract;
- thêm memory budget và cache eviction;
- đảm bảo renderer dispose mọi native/WASM resource.

### Không làm trong phase này

- không thêm WebGPU;
- không thay FFmpeg bằng WebCodecs;
- không cache surface khi chưa có fingerprint/dependency chính xác;
- không chấp nhận pixel difference chỉ để lấy throughput.

### Tiêu chí hoàn thành

- không có memory growth tuyến tính theo số frame;
- cache metrics giải thích được hit/miss;
- 300-frame benchmark chạy ổn định ba lần liên tiếp;
- golden pixel tests không regression;
- unsupported command/effect luôn tạo diagnostic.

### File dự kiến

- `packages/skia-renderer/src/backend.ts`
- `packages/skia-renderer/src/command/*`
- `packages/export-renderer/src/render/node-skia.ts`
- `packages/export-renderer/src/render/skia-assets.ts`
- `packages/export-renderer/test/*`

---

## 11. Phase 4 — Async job API và artifact lifecycle

### Mục tiêu

Render dài không còn phụ thuộc vào timeout của request.

### API mục tiêu

```text
POST /v1/render-jobs
  body: manifest reference + output preset + idempotency key
  response: 202 { jobId, statusUrl }

GET /v1/render-jobs/:jobId
  response: status, stage, progress, metrics, artifact

DELETE /v1/render-jobs/:jobId
  response: cancellation accepted
```

### State machine

```text
queued
  → planning
  → preparing
  → rendering
  → encoding
  → muxing
  → publishing
  → done
```

Terminal states:

```text
failed
cancelled
```

### Việc cần làm

- worker nhận job và trả `202` ngay;
- persist job trước khi dispatch;
- progress dựa trên completed frames/chunks, không dùng giá trị giả;
- heartbeat và stale-job detection;
- retry ở chunk boundary;
- cancellation truyền xuống renderer và FFmpeg process;
- temp artifact dùng tên riêng theo job/attempt;
- chỉ publish sau khi:
  - encoder exit code 0;
  - `ffprobe` xác nhận duration/frame count/codec;
  - checksum đã tạo;
- atomic rename/upload final artifact;
- dọn temp artifact theo TTL;
- webhook có chữ ký và retry;
- giữ idempotency theo user/project/revision/preset.

### Storage

- production job store phải dùng persistent database/queue adapter;
- file-backed store chỉ dùng local development/test;
- render bundle và artifact lưu object storage;
- worker không tải toàn bộ MP4 vào một `Buffer` nếu provider hỗ trợ stream upload.

### Tiêu chí hoàn thành

- create-job response dưới 2 giây, không phụ thuộc video duration;
- restart web process không làm mất job;
- worker crash không publish MP4 thiếu `moov`;
- cancel dừng frame production và encoder;
- retry không tạo hai final artifacts;
- progress tăng đơn điệu và kết thúc chính xác ở 1.

### File dự kiến

- `packages/export-renderer/src/api/server.ts`
- `packages/export-renderer/src/contracts/render-job.ts`
- `packages/export-renderer/src/contracts/render-manifest.ts`
- `apps/web/lib/server/render/export-worker.ts`
- `apps/web/lib/server/render/job-store.ts`
- API route và tests liên quan.

---

## 12. Phase 5 — Frame-range scheduler và parallel rendering

### Mục tiêu

Tận dụng nhiều CPU core/process và chuẩn bị cho distributed workers.

### Planner

Input:

```text
composition
frame count
backend capability
available CPU/GPU
memory budget
output preset
```

Output:

```text
chunk 0: frames 0..299
chunk 1: frames 300..599
chunk 2: frames 600..899
...
```

Chunk size phải cấu hình được. Bắt đầu với 150–300 frame/chunk và benchmark.

### Quy tắc

- mỗi chunk render độc lập từ immutable runtime;
- frame number/timestamp luôn là absolute timeline time;
- mỗi chunk có checksum, attempt và status riêng;
- concurrency bị giới hạn theo CPU/RAM, không mặc định bằng logical core count;
- asset cache có thể dùng chung read-only trên disk nhưng không dùng mutable renderer state chung;
- chunk retry không render lại toàn job;
- final output phải kiểm tra không thiếu/trùng frame ở boundary.

### Chiến lược intermediate

Benchmark hai phương án:

1. Render song song thành encoded segments có cùng codec parameters, force keyframe tại chunk boundary, sau đó concat/remux không re-encode.
2. Render frame sequence rồi encode tập trung, chỉ dùng làm correctness/reference vì chi phí storage lớn.

Không chọn chiến lược chỉ dựa trên intuition. Đo throughput, disk I/O, final quality và audio sync.

### Tiêu chí hoàn thành

- concurrency 2 và 4 tạo output có đúng 1.800 frame;
- không có duplicate/missing frame tại chunk boundary;
- output video-only giống golden frames tại các sample cố định;
- audio sync sai lệch không quá một frame;
- worker/chunk failure có thể retry riêng;
- speedup được báo cáo cùng CPU/RAM, không chỉ wall time.

---

## 13. Phase 6 — Encoder và muxing

### Mục tiêu

Giữ FFmpeg làm encoder/muxer đáng tin cậy, nhưng tách rõ khỏi renderer và có capability-based presets.

### Software baseline

```text
libx264
yuv420p
configurable CRF/bitrate
configurable preset
AAC audio
faststart
```

### Việc cần làm

- đo pipe write và drain wait riêng;
- log FFmpeg progress machine-readable;
- không giữ toàn bộ stderr vô hạn trong RAM;
- dùng temporary output rồi atomic finalize;
- kiểm tra frame count, duration, codec và audio streams bằng `ffprobe`;
- định nghĩa presets theo contract thay vì hard-code `veryfast`;
- thêm bitrate/CRF/GOP policy nhất quán giữa chunks;
- xử lý encoder abort và child process cleanup;
- benchmark `ultrafast`, `veryfast`, `faster` trên cùng chất lượng mục tiêu.

### Hardware encoder thử nghiệm

Probe capability khi worker boot:

```text
NVENC
VAAPI
Quick Sync
VideoToolbox nếu có worker macOS
```

Hardware encoder chỉ được chọn khi:

- capability probe pass;
- preset có quality target tương đương;
- không silently fallback;
- metrics ghi đúng encoder thực tế.

### Tiêu chí hoàn thành

- encoder metrics không chứa thời gian frame production;
- failed/cancelled job không để lại child process;
- output pass `ffprobe` và playback E2E;
- software fallback luôn hoạt động;
- hardware path có parity về duration/frame/audio sync.

---

## 14. Phase 7 — GPU renderer spike

### Mục tiêu

Xác minh bằng benchmark liệu GPU backend có đáng để productionize.

### Thứ tự thử nghiệm

1. Kiểm tra native Skia GPU backend phù hợp với môi trường worker.
2. Nếu không phù hợp, thử WebGL2/EGL hoặc headless Chromium có GPU passthrough.
3. Chỉ thử WebGPU khi WebGL2/native path đã có số liệu và deployment contract rõ ràng.
4. WebCodecs là encoder option riêng, không gộp vào GPU renderer milestone.

### Primitive scope ban đầu

```text
solid
rectangle
ellipse
polygon/path cơ bản
image
text
transform
opacity
source-over blend
clip cơ bản
```

Unsupported effect phải fallback toàn frame hoặc toàn job về Skia golden backend; không silently bỏ qua.

### Cache scope

- image texture cache;
- geometry/path cache;
- shaped-text/glyph cache;
- offscreen surface pool;
- static subtree texture cache dựa trên dependency fingerprint.

### Cảnh báo kỹ thuật

- WebGPU `importExternalTexture()` hỗ trợ video frame làm input; không được coi là bằng chứng encode framebuffer zero-copy;
- `VideoEncoder` availability và hardware acceleration phụ thuộc host/browser;
- headless Docker có thể dùng software renderer;
- mọi tuyên bố zero-copy phải được xác nhận bằng tracing/metrics.

### Gate để productionize

- nhanh hơn Skia CPU tối thiểu 2 lần trên fixture GPU-suitable;
- không chậm hơn đáng kể trên scene text-heavy;
- pixel parity trong tolerance đã định nghĩa;
- có deterministic fallback;
- worker image và driver có health check;
- crash GPU không làm mất toàn job.

---

## 15. Correctness và regression strategy

### Golden artifacts

Mỗi fixture giữ:

- compiled runtime hash;
- command buffer snapshots tại frame chọn lọc;
- PNG golden frames;
- MP4 metadata expected;
- audio duration/sync markers;
- diagnostics expected.

### Frame samples bắt buộc

Với fixture 60 giây:

```text
0
1
29
30
149
299
300
899
900
1798
1799
```

Các frame sát chunk boundary phải luôn có trong regression suite.

### Kiểm tra

- command buffer equality khi chỉ tối ưu evaluator;
- exact pixel hash khi cùng Skia backend và môi trường;
- pixel diff có tolerance được version hóa khi đổi backend;
- `ffprobe` kiểm tra codec, resolution, FPS, frame count và duration;
- decode sample frames từ output để so với golden renderer;
- audio marker test để kiểm tra A/V sync.

---

## 16. Performance gates

Mọi performance result phải ghi kèm cấu hình máy. Dùng chỉ số:

```text
RTF = export wall time / video duration
```

Các gate ban đầu:

| Gate | Mục tiêu |
| --- | --- |
| Correctness | Full 1.800-frame export hoàn tất và MP4 hợp lệ |
| Measurement | Stage timings khớp wall time trong sai số 2% |
| Compiler | giảm ít nhất 80% compile time |
| Payload | giảm ít nhất 70% Runtime bytes |
| Memory | không tăng tuyến tính theo số frame |
| CPU MVP | RTF ≤ 3 trên worker chuẩn đã công bố |
| GPU stretch | RTF ≤ 1,5 trên worker GPU chuẩn |
| Job API | create response dưới 2 giây |
| Reliability | retry/cancel không publish partial artifact |

Các con số RTF chỉ trở thành SLO chính thức sau khi chốt cấu hình worker chuẩn.

---

## 17. Observability

Mỗi job cần có:

```text
jobId
attemptId
projectId/revision
runtime content hash
image digest
backend
encoder
frame/chunk range
stage
progress
CPU/RAM/GPU metrics
stage timings
slowest frames
output checksum
failure code
```

Failure code phải phân biệt:

- invalid runtime;
- missing/corrupt asset;
- unsupported command/effect;
- renderer failure;
- encoder failure;
- mux failure;
- worker lost;
- timeout/stale heartbeat;
- cancelled;
- artifact upload failure.

Không dùng một message `render_failed` cho mọi trường hợp.

---

## 18. Security và isolation

- worker không fetch URL tùy ý ngoài asset allowlist/signed manifest;
- giới hạn project payload, resolution, duration, frame count và asset size;
- xác minh checksum trước khi decode asset;
- temp directory tách theo job/attempt;
- output name không được phép path traversal;
- FFmpeg arguments được tạo từ typed preset, không nối chuỗi user input;
- giới hạn CPU/RAM/process/time cho mỗi job;
- xóa temp artifact theo TTL;
- log không chứa signed URL, OAuth token hoặc secret.

---

## 19. Thứ tự PR đề xuất

### PR 1 — Benchmark correctness

- sửa timing ownership;
- thêm stage/frame metrics;
- benchmark JSON version mới;
- thêm 1/30/300/1.800 frame runners;
- chưa tối ưu behavior.

### PR 2 — Compiler hot path

- static/animated node analysis;
- không compile full visual project mỗi frame;
- payload statistics;
- compiler/runtime parity tests.

### PR 3 — Prepared runtime

- validate once;
- prebuilt indexes;
- evaluator không clone/map toàn scene không cần thiết;
- command buffer and frame determinism tests.

### PR 4 — Skia CPU lifecycle

- CanvasKit/font/asset cache lifecycle;
- allocation/readback metrics;
- bounded pools và disposal tests.

### PR 5 — Async job protocol

- `POST/GET/DELETE /v1/render-jobs`;
- persistent job adapter;
- heartbeat/progress/cancel;
- atomic artifact publish.

### PR 6 — Frame-range scheduler

- chunk planner;
- bounded concurrency;
- retry và chunk progress;
- boundary correctness suite.

### PR 7 — Encoder abstraction

- FFmpeg adapter;
- software presets;
- capability probe;
- optional hardware encoder;
- final mux/audio sync tests.

### PR 8 — GPU spike

- primitive subset;
- explicit GPU health check;
- parity benchmark;
- feature flag và fallback.

Không gộp PR 1–7 thành một thay đổi lớn. Mỗi PR phải có benchmark trước/sau và regression tests tương ứng.

---

## 20. Commands kiểm chứng

Typecheck:

```powershell
pnpm --filter @motionvideo/motion-compiler typecheck
pnpm --filter @motionvideo/motion-runtime typecheck
pnpm --filter @motionvideo/skia-renderer typecheck
pnpm --filter @motionvideo/export-renderer typecheck
pnpm --filter @motionvideo/web typecheck
```

Tests:

```powershell
pnpm --filter @motionvideo/motion-compiler test
pnpm --filter @motionvideo/motion-runtime test
pnpm --filter @motionvideo/skia-renderer test
pnpm --filter @motionvideo/export-renderer test
```

Build Docker:

```powershell
docker build -f packages/export-renderer/Dockerfile -t neonix-export-renderer:benchmark .
```

Benchmark fixture:

```powershell
$env:NEONIX_RENDER_FRAME_COUNT = "30"
pnpm --filter @motionvideo/web export:neonix-60s

$env:NEONIX_RENDER_FRAME_COUNT = "300"
pnpm --filter @motionvideo/web export:neonix-60s

Remove-Item Env:NEONIX_RENDER_FRAME_COUNT
pnpm --filter @motionvideo/web export:neonix-60s
```

Mỗi lần benchmark phải dùng output path riêng; không ghi đè artifact dùng để so sánh.

---

## 21. Definition of Done

Rebuild export renderer được xem là hoàn thành khi:

- fixture Neonix 60 giây export hoàn tất ổn định;
- MP4 có đúng resolution, FPS, duration và frame count;
- compile/runtime payload đạt performance gates;
- timing từng stage không bị tính chồng;
- validation không chạy trong mỗi frame;
- worker API là async và không phụ thuộc request timeout;
- progress, cancel, retry và idempotency hoạt động;
- partial artifact không bao giờ được publish như output hoàn chỉnh;
- frame-range concurrency pass boundary tests;
- software FFmpeg path luôn là fallback hoạt động;
- GPU/hardware path, nếu bật, có capability check và fallback;
- output pass golden command, pixel và A/V sync tests;
- benchmark cold/warm 1/30/300/1.800 frame được lưu cùng thông tin môi trường;
- production metrics cho biết rõ bottleneck nằm ở compile, evaluate, paint, readback, pipe, encode, mux hay storage.

---

## 22. Bước bắt đầu

Bắt đầu bằng PR 1, không bắt đầu bằng GPU renderer.

Deliverable đầu tiên phải trả lời chính xác:

```text
Trong 10,9 giây của probe 30 frame:
- evaluate mất bao lâu?
- Skia paint mất bao lâu?
- readPixels/copy mất bao lâu?
- chờ pipe mất bao lâu?
- FFmpeg encode/finalize mất bao lâu?
```

Sau khi có breakdown này mới chốt ngân sách và phạm vi cho PR 2–8.
