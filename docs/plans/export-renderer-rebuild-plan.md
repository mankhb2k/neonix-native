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

### 5.7 Preview và Export dùng chung frame semantics

Preview và Export không bắt buộc dùng cùng raster backend, nhưng bắt buộc dùng chung:

- frame clock và quy tắc đổi `frame ↔ time`;
- animation evaluator;
- media-time mapping;
- text shaping/layout;
- effect/compositing semantics;
- `PaintCommandBuffer` contract;
- deterministic seed và epsilon rules.

Boundary mục tiêu:

```text
Prepared Runtime
  → Shared Frame Evaluator
  → PaintCommandBuffer
       ├── Preview GPU backend
       ├── Export Skia CPU golden backend
       └── Export GPU backend optional
```

Không tạo một evaluator riêng cho GPU export. Mọi backend mới phải consume cùng command contract và được so với golden backend tại cùng frame/time.

### 5.8 Tách logical composition khỏi physical output

Runtime luôn evaluate trong logical coordinate space của composition. Resolution export chỉ thay physical backing size và pixel ratio:

```text
Logical composition: 1920 × 1080

Physical output:
  1280 × 720   → pixelRatio 0,667
  1920 × 1080  → pixelRatio 1
  2560 × 1440  → pixelRatio 1,333
  3840 × 2160  → pixelRatio 2
```

Renderer chịu trách nhiệm scale geometry, stroke, blur, shadow, mask và text rasterization nhất quán. Encoder chỉ nhận physical dimensions đã được chuẩn hóa về số chẵn khi codec yêu cầu.

### 5.9 Failure policy phải rõ ràng

Mỗi output preset khai báo một trong hai policy:

```text
strict
  → thiếu/lỗi video, image, font hoặc audio làm job failed

best-effort
  → chỉ tiếp tục với loại lỗi được preset cho phép
  → bắt buộc có diagnostic và artifact metadata
```

Production preset mặc định là `strict`. Không silently bỏ audio, asset hoặc effect rồi vẫn đánh dấu artifact hoàn chỉnh.

### 5.10 Browser renderer chỉ là backend tùy chọn

Headless Chrome + WebGL/WebGPU + WebCodecs có thể dùng cho local development hoặc GPU spike, nhưng không phải production core mặc định. Nếu dùng browser worker phải đo và ghi rõ:

- Chrome version;
- requested backend và actual backend;
- GPU adapter/driver;
- hardware hay software renderer, bao gồm SwiftShader;
- actual video/audio encoder implementation;
- mọi fallback reason.

Không được báo `webgpu` hoặc `webgl2` như một GPU result nếu implementation thực tế chạy software.

### 5.11 Reference hygiene

ClipKit được dùng làm architectural reference cho evaluator, cache, backpressure và backend abstraction. Không copy trực tiếp `@clipkit/runtime` vào Neonix; runtime trong reference hiện mang BSL 1.1. Neonix phải triển khai độc lập trên protocol/runtime contract của chính mình và giữ provenance rõ ràng cho mọi dependency hoặc đoạn code bên thứ ba.

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
    ├── prepare deterministic media providers
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
- ghi requested/actual renderer, GPU adapter/driver, software fallback và actual encoder;
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
- benchmark không gộp kết quả SwiftShader/software WebGL vào nhóm hardware GPU.

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

### Deterministic MediaFrameProvider

Video layer không được seek/decode ad-hoc trong từng element renderer. Chuẩn hóa qua một interface riêng:

```ts
interface MediaFrameProvider {
  prepare(asset: RuntimeMediaAsset): Promise<void>;
  getFrame(assetId: string, mediaTimeUs: number): Promise<DecodedMediaFrame>;
  dispose(): Promise<void>;
}
```

Yêu cầu implementation:

- demux và probe mỗi asset một lần/job hoặc lấy từ cache theo content hash;
- resolve exact media timestamp từ timeline contract;
- decode tuần tự và feed-ahead khi timeline tiến về phía trước;
- reset decoder về keyframe gần nhất khi seek xa hoặc reverse;
- cache một cửa sổ frame có giới hạn, không giữ toàn clip trong RAM/VRAM;
- đóng `VideoFrame`, bitmap hoặc native surface ngay khi bị evict;
- không dùng chung mutable decoder cho hai clip instance có timing khác nhau;
- có FFmpeg/native fallback khi WebCodecs không hỗ trợ codec;
- cùng một `mediaTimeUs` phải trả về cùng source frame giữa preview và export.

### Tiêu chí hoàn thành

- validation chỉ chạy một lần/job;
- evaluate p95 giảm ít nhất 70% trên fixture chuẩn;
- random-access frame cho kết quả giống sequential frame;
- render cùng project ở hai process tạo cùng golden frame hashes;
- sequential và random-access media frames resolve cùng timestamp/frame;
- reverse/loop/time-remap không làm decoder cache tăng không giới hạn;
- không tăng memory theo số frame đã render.

### File dự kiến

- `packages/motion-runtime/src/project/visual.ts`
- `packages/motion-runtime/src/visual/evaluate.ts`
- `packages/motion-runtime/src/paint/*`
- `packages/motion-runtime/src/media/*`
- `packages/export-renderer/src/media/*`
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
- thêm resource fingerprints để chỉ raster/upload khi dependency thay đổi:
  - image texture: asset content hash;
  - SVG/path raster: geometry, trim, morph, dimensions và paint hash;
  - text: content, font, size, shaping options và style hash;
  - static subtree: descendants, effects và asset identities hash;
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
- static resource không bị raster/upload lại khi fingerprint không đổi;
- thay một dependency chỉ invalidate đúng resource/subtree liên quan;
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

Production path không được dùng chuỗi copy toàn-file:

```text
MP4
  → ArrayBuffer
  → Blob
  → base64
  → Node Buffer
```

Output phải đi theo một trong hai đường:

```text
Encoder/Muxer → temporary file → verify → atomic upload/publish
```

hoặc:

```text
Encoder/Muxer → bounded multipart stream → finalize → verify metadata/checksum
```

### Tiêu chí hoàn thành

- create-job response dưới 2 giây, không phụ thuộc video duration;
- restart web process không làm mất job;
- worker crash không publish MP4 thiếu `moov`;
- peak memory không phụ thuộc tuyến tính vào kích thước MP4 output;
- production render không chuyển artifact qua base64;
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
- giới hạn rõ `maxFramesInFlight` và encoder queue size;
- khi queue vượt ngưỡng, frame producer phải chờ drain thay vì tiếp tục allocate frame;
- progress tách thành `renderedFrames`, `submittedFrames`, `encodedFrames` và `muxedFrames`;
- progress chỉ đạt 100% sau encoder flush và muxer finalize;
- thêm `encoderDrainTimeout` và `encoderFlushTimeout` để phát hiện stall;
- log FFmpeg progress machine-readable;
- không giữ toàn bộ stderr vô hạn trong RAM;
- dùng temporary output rồi atomic finalize;
- kiểm tra frame count, duration, codec và audio streams bằng `ffprobe`;
- định nghĩa presets theo contract thay vì hard-code `veryfast`;
- thêm bitrate/CRF/GOP policy nhất quán giữa chunks;
- chuẩn hóa physical width/height thành số chẵn khi codec/pixel format yêu cầu;
- định nghĩa GOP/keyframe tại chunk boundaries để concat/remux không thiếu frame;
- áp dụng `strict`/`best-effort` failure policy cho audio và media tracks;
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
- encoder queue luôn nằm trong configured bound;
- 100% progress đồng nghĩa output đã flush, mux và verify xong;
- flush/drain stall trả về failure code cụ thể;
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
- `gpuFinish()` sau mọi frame đảm bảo correctness nhưng có thể serialize CPU/GPU; phải benchmark fence strategy thay vì mặc định chờ toàn GPU queue;
- copy GPU canvas sang Canvas 2D trước `VideoFrame` vẫn là full-frame copy và không được gọi là zero-copy;
- mọi tuyên bố zero-copy phải được xác nhận bằng tracing/metrics.

### Backend identity bắt buộc

Mỗi GPU benchmark/job phải lưu:

```text
requestedBackend
actualBackend
adapterName
driverVersion
softwareRenderer
encoderName
hardwareAcceleration
fallbackReason
```

Kết quả chạy bằng SwiftShader được so với CPU renderer như một software backend riêng, không được dùng để chứng minh hiệu năng GPU.

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

### Resolution matrix bắt buộc

Mỗi backend phải test cùng logical composition tại:

```text
720p
1080p
1440p
4K nếu backend khai báo hỗ trợ
```

Kiểm tra geometry, font, stroke, blur, shadow, mask, crop và effect radius theo physical pixel ratio. H.264 outputs phải có even dimensions.

### Media timeline cases bắt buộc

- forward sequential decode;
- seek xa về phía trước;
- seek ngược;
- loop;
- trim;
- playback rate;
- time remap/freeze/reverse;
- hai clip instance dùng cùng asset nhưng timing khác nhau;
- codec unsupported đi qua fallback đúng policy.

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

Với browser/GPU backend phải bổ sung:

```text
requestedBackend
actualBackend
GPU adapter/driver
softwareRenderer
requestedEncoder
actualEncoder
hardwareAcceleration
fallbackReason
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
- shared Preview/Export evaluator contract;
- deterministic `MediaFrameProvider` và bounded decode cache;
- command buffer and frame determinism tests.

### PR 4 — Skia CPU lifecycle

- CanvasKit/font/asset cache lifecycle;
- resource fingerprints và precise invalidation;
- allocation/readback metrics;
- bounded pools và disposal tests.

### PR 5 — Async job protocol

- `POST/GET/DELETE /v1/render-jobs`;
- persistent job adapter;
- heartbeat/progress/cancel;
- streaming artifact, không full-buffer/base64;
- strict/best-effort failure policy;
- atomic artifact publish.

### PR 6 — Frame-range scheduler

- chunk planner;
- bounded concurrency;
- retry và chunk progress;
- boundary correctness suite.

### PR 7 — Encoder abstraction

- FFmpeg adapter;
- bounded backpressure và flush watchdog;
- rendered/submitted/encoded/muxed progress;
- software presets;
- capability probe;
- optional hardware encoder;
- final mux/audio sync tests.

### PR 8 — GPU spike

- primitive subset;
- explicit GPU health check;
- requested/actual backend identity và SwiftShader detection;
- logical/physical resolution parity;
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
- Preview và Export dùng chung frame evaluator, media-time mapping và command semantics;
- deterministic media provider pass forward/seek/reverse/loop tests;
- worker API là async và không phụ thuộc request timeout;
- progress, cancel, retry và idempotency hoạt động;
- partial artifact không bao giờ được publish như output hoàn chỉnh;
- production artifact không đi qua base64 hoặc full-file Node `Buffer`;
- frame-range concurrency pass boundary tests;
- encoder queue/backpressure có bound và flush stall có watchdog;
- software FFmpeg path luôn là fallback hoạt động;
- GPU/hardware path, nếu bật, có capability check và fallback;
- metrics phân biệt requested backend với actual hardware/software backend;
- logical composition render đúng tại mọi physical output resolution được hỗ trợ;
- output pass golden command, pixel và A/V sync tests;
- benchmark cold/warm 1/30/300/1.800 frame được lưu cùng thông tin môi trường;
- production metrics cho biết rõ bottleneck nằm ở compile, evaluate, paint, readback, pipe, encode, mux hay storage.
- Cloud Run validation chạy thành công từ image immutable theo digest, gồm cold/warm run, external artifact upload và retry/failure checks.

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

---

## 23. Phase 8 — Cloud Run validation sau khi rebuild

Cloud Run là môi trường validation sau khi các phase sửa renderer đã qua
correctness và performance gates. Phase này không được dùng để che giấu
regression của local Docker hoặc để thay đổi semantics của Runtime.

### Mục tiêu

- build đúng image production từ repository root;
- chạy cùng một image bằng Cloud Run Service và Cloud Run Job ở môi trường
  Linux/amd64;
- đo riêng cold start, preparation, rendering, encoding, mux/finalize,
  upload và callback;
- xác nhận fixture Neonix 60 giây hoạt động với artifact lifecycle hoàn chỉnh;
- chứng minh output trên Cloud Run có cùng resolution, FPS, duration, frame
  count và pixel/A-V correctness với local golden baseline.

### Mô hình triển khai bắt buộc

~~~text
Web API / control plane
        |
        | tạo render job, theo dõi status
        v
Cloud Run Service
        |
        | trigger authenticated execution
        v
Cloud Run Job
        |
        +--> prepared runtime + Skia/CPU renderer
        +--> FFmpeg encode/mux
        +--> upload artifact lên R2 hoặc GCS
        +--> callback cập nhật job status
        v
External artifact storage
~~~

Cloud Run Service chỉ giữ các endpoint control-plane như health, submit và
status hoặc smoke render ngắn. Video export production phải chạy bằng Cloud
Run Job: container đọc job manifest, render, upload/callback rồi exit '0' khi
thành công hoặc exit khác '0' khi thất bại. Không chạy HTTP server trong Job.

### Điều kiện đầu vào

- Google Cloud CLI ('gcloud') và Docker đã cài;
- GCP project và region đã chọn, mặc định benchmark dùng
  'asia-southeast1';
- Artifact Registry repository;
- quyền deploy Cloud Run, push Artifact Registry và impersonate runtime
  service account;
- 'run.googleapis.com' và 'artifactregistry.googleapis.com' đã bật;
- R2/GCS credentials, callback token và các secret khác được inject qua
  Secret Manager hoặc runtime secret reference, không bake vào image;
- image có Linux 'amd64' manifest; không dùng image chỉ build cho Windows.

### Thay đổi bắt buộc trước khi deploy

1. Server đọc port theo thứ tự 'PORT', rồi mới đến
   'EXPORT_RENDERER_PORT', để tuân thủ Cloud Run container contract.
2. 'OUTPUT_ROOT' chỉ là scratch space, ví dụ '/tmp/neonix-export'; MP4 hoàn
   chỉnh phải được upload ra external storage trước khi job kết thúc.
3. Thêm entrypoint/script 'render:job' cho Cloud Run Job; script phải nhận
   manifest hoặc job ID, có idempotency key, callback kết quả và exit code
   chính xác.
4. Không coi '/v1/outputs/*' trên local filesystem là artifact production;
   download URL phải trỏ đến storage artifact đã publish.
5. Đặt 'concurrency=1' cho renderer benchmark ban đầu và giới hạn
   'max-instances' để không trộn nhiều export nặng trong một instance.
6. Ghi lại image digest, git SHA, preset, CPU, memory, region, actual backend,
   actual encoder và fallback reason cho mỗi run.

### Build và publish image

Các lệnh dưới đây là skeleton validation; thay PROJECT_ID và repository theo
môi trường thực tế:

~~~powershell
$env:GCP_PROJECT_ID = "PROJECT_ID"
$env:GCP_REGION = "asia-southeast1"
$env:GCP_REPOSITORY = "neonix"
$env:GCP_IMAGE = "$env:GCP_REGION-docker.pkg.dev/$env:GCP_PROJECT_ID/$env:GCP_REPOSITORY/export-renderer"

gcloud auth list
gcloud config set project $env:GCP_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
gcloud auth configure-docker "$env:GCP_REGION-docker.pkg.dev"

docker build --platform linux/amd64 -f packages/export-renderer/Dockerfile -t "$env:GCP_IMAGE:$env:GIT_SHA" .
docker push "$env:GCP_IMAGE:$env:GIT_SHA"
docker inspect --format="{{index .RepoDigests 0}}" "$env:GCP_IMAGE:$env:GIT_SHA"
~~~

Tag phải gắn với git SHA hoặc release ID. Không benchmark bằng 'latest' vì
không thể truy nguyên chính xác binary đã chạy.

### Service smoke validation

Deploy một Service riêng cho health check, authenticated API và smoke render
ngắn. Cấu hình khởi đầu cần được ghi lại cùng benchmark:

~~~text
port: 8080 hoặc port được Cloud Run cấu hình
CPU: 2 vCPU
memory: 4 GiB, điều chỉnh theo peak RSS thực tế
concurrency: 1
request timeout: không vượt giới hạn của Cloud Run Service
authentication: không public mặc định
output root: /tmp/neonix-export
~~~

Smoke checks:

- 'GET /health' trả renderer version và backend identity;
- request không có credentials bị từ chối;
- render ngắn trả job/result hợp lệ;
- container không phụ thuộc working directory của local workspace;
- output được upload và đọc lại từ external storage;
- restart hoặc instance replacement không làm mất artifact đã publish.

### Job validation cho fixture 60 giây

Fixture chuẩn là 1.800 frames ở 30 FPS, cùng project và preset đã dùng trong
local benchmark. Chạy tối thiểu:

~~~text
1 cold run
3 warm runs
1 retry sau simulated failure
1 run với callback chậm hoặc storage upload chậm
~~~

Mỗi run phải lưu:

~~~text
job ID và Cloud Run execution ID
image digest và git SHA
queue/startup time
prepare time
evaluate time
Skia paint time
readback/copy time
encoder pipe wait time
FFmpeg encode time
mux/finalize time
artifact upload time
callback time
wall-clock duration
peak RSS và scratch bytes
frames in flight
requested/actual renderer backend
requested/actual encoder
~~~

Kết quả Cloud Run chỉ được pass khi:

- MP4 có đúng duration, FPS, frame count và physical resolution;
- golden frame và A/V sync pass theo tolerance đã công bố;
- output không đi qua base64 hoặc full-file Node 'Buffer';
- peak memory không tăng tuyến tính theo kích thước MP4;
- encoder queue và temporary storage đều có bound;
- retry không publish artifact trùng hoặc artifact chưa hoàn chỉnh;
- timeout, SIGTERM, unsupported asset và callback failure chuyển job sang
  trạng thái chẩn đoán được;
- metrics xác định được bottleneck nằm ở render, encode, mux, storage hay
  startup, không gộp tất cả thành một latency duy nhất.

### Cloud Run-specific acceptance gate

Không gọi phase này là hoàn thành nếu chỉ deploy được container. Phase chỉ
đạt khi có report so sánh local Docker và Cloud Run cùng image digest, kèm
log/metrics cho cold và warm run. Software CPU baseline của Cloud Run được
đánh giá riêng; không dùng nó để kết luận về hiệu năng GPU. GPU benchmark chỉ
được mở thành một track riêng sau khi GPU backend đã qua parity gate.

Sau khi phase này pass, mới quyết định production topology, resource budget,
autoscaling limit, retry policy và có cần Cloud Run Job song song theo
frame-range hay không.
