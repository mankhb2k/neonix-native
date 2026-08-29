# Native Export Renderer Plan

## Yêu cầu deploy độc lập

`packages/export-renderer` phải có thể build thành Docker image và chạy như
một service độc lập trên VPS hoặc EC2, không cần chạy Next.js. Package gồm cả
reusable renderer library và HTTP/worker entrypoint.

```text
Web UI → Neonix Web API/BFF → Native Export Renderer API → VPS local storage
```

Browser không giữ service token. Web API chịu trách nhiệm authentication,
ownership, quote/billing và ký request; Export Renderer API chỉ nhận request đã
được xác thực.

Build từ monorepo root:

```bash
docker build -f packages/export-renderer/Dockerfile -t neonix-export-renderer .
docker run --env-file .env.export-renderer -p 8080:8080 neonix-export-renderer
```

HTTP API hiện tại của vertical slice:

```text
GET  /healthz
GET  /readyz
POST /v1/renders
GET  /v1/outputs/:token
```

`POST /v1/renders` hiện chạy đồng bộ để kiểm chứng E2E. Web BFF giữ lifecycle
job ở phía ứng dụng và gọi worker qua `EXPORT_RENDERER_URL`:

```text
POST /api/renders
        ↓
Web BFF → POST /v1/renders
        ↓
render → encode → tmp/export-renderer/{userId}/{jobId}.mp4
        ↓
Web BFF records status = done + artifact URL
```

Docker image phải chạy non-root, chứa FFmpeg/native dependencies, có graceful
shutdown, health/readiness checks, giới hạn temp disk, log JSON và không ghi
secret vào image layer. Cấu hình đi qua environment variables:

```text
EXPORT_RENDERER_PORT
EXPORT_RENDERER_AUTH_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_EXPORT_BUCKET
FFMPEG_PATH
EXPORT_TEMP_DIR
EXPORT_CACHE_DIR
```

Worker phải dùng lease/heartbeat để tránh hai instance render cùng một job.
Job hết lease được retry theo attempt và idempotency key.

## Trạng thái triển khai local — 2026-08-29

Đã có vertical slice đầu tiên trong `packages/export-renderer`:

- `RuntimeProjectV3` được validate và đánh giá bằng `evaluateRuntimeProjectV3`.
- Paint command subset được rasterize thành SVG bằng `sharp/libvips` rồi pipe
  RGBA trực tiếp vào một tiến trình FFmpeg để tạo H.264 MP4.
- Có CLI smoke 1080p/30fps và HTTP worker local; mặc định chỉ ghi vào
  `tmp/export-renderer`, chưa gọi R2/Supabase.
- Có test command serialization và test fail-closed cho video command.

Chưa coi là parity hoàn chỉnh: text glyph atlas, image/video decode, effects,
mask/isolation, audio, pixel-diff trực tiếp với WebGL2 preview và async job
lease vẫn là các gate tiếp theo. Remotion renderer và Lambda path đã được loại
bỏ; mọi tiến triển tiếp theo phải mở rộng native VPS worker này.
## Mục tiêu

Tạo package `packages/export-renderer` để render video thật từ
`RuntimeProjectV3`/`RuntimeFrameV3`, không phụ thuộc Remotion hoặc Lambda.

Phạm vi của kế hoạch này là **đúng hình ảnh và chạy được E2E**, chưa tối ưu
GPU, chưa tối ưu cache, chưa autoscale worker và chưa thay đổi pricing.

## Nguyên tắc không thay đổi

- `MotionProtocolV2` vẫn là authoring contract.
- `compileProtocol()` là compiler duy nhất.
- `RuntimeProjectV3` là nguồn semantics duy nhất cho preview và export.
- `evaluateRuntimeProjectV3()` là frame evaluator duy nhất.
- Export renderer không tự tính lại timing, transform, parent hierarchy hoặc
  text layout.
- Không đưa DOM object, GPU handle, decoder handle hoặc encoder command vào
  `RuntimeProjectV3`.
- Một export phải tạo đúng số frame, đúng FPS, đúng kích thước và đúng thứ tự.
- Unsupported capability phải fail closed, không âm thầm render sai.

## Định nghĩa hoàn thành

Kế hoạch hoàn thành khi tất cả điều kiện sau đúng:

1. `packages/export-renderer` có public API ổn định để nhận một
   `RuntimeProjectV3` và tạo MP4.
2. Có local CLI/test harness render được MP4 thật từ ít nhất một project V3.
3. Video output có đúng width, height, FPS, duration và số frame.
4. Các frame trước encode của export được so sánh với Runtime V3/reference
   image bằng golden test hoặc pixel-diff có ngưỡng rõ ràng.
5. Audio không bị giả mạo: nếu vertical slice chưa hỗ trợ audio thì export
   phải fail với diagnostic rõ ràng; không tạo video thiếu audio mà báo thành
   công.
6. Có E2E test gồm compile → export → MP4 probe → frame extraction → image
   assertion.
7. Native VPS worker được gọi bởi application path qua `EXPORT_RENDERER_URL`.
8. Không còn package, route, dependency hoặc script Lambda/Remotion trong
   runtime export.

## Kiến trúc vertical slice đầu tiên

```text
RuntimeProjectV3
      │
      ├── frame 0..N-1
      │
      ▼
evaluateRuntimeProjectV3()
      │
      ▼
RuntimeFrameV3 / PaintCommandBuffer
      │
      ▼
Canvas export backend
      │
      ▼
raw RGBA frame stream
      │
      ▼
FFmpeg encoder
      │
      ▼
MP4 artifact
```

Để kiểm chứng đúng semantics trước, backend đầu tiên nên dùng một surface
Canvas/OffscreenCanvas hoặc adapter canvas tương thích Node. Không bắt đầu bằng
GPU optimization hay zero-copy. Renderer phải tái sử dụng các command và mesh
đã được Runtime chuẩn bị.

## API đề xuất

```ts
export type ExportRendererOptions = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  background?: string;
  outputPath: string;
  codec?: "h264";
  pixelFormat?: "yuv420p";
};

export type ExportFrameMetrics = {
  frame: number;
  evaluateMs: number;
  paintMs: number;
  encodeMs?: number;
};

export type ExportResult = {
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  framesRendered: number;
  durationInFrames: number;
  durationSeconds: number;
  metrics: {
    totalMs: number;
    frames: ExportFrameMetrics[];
  };
};

export async function renderRuntimeProjectV3(
  project: RuntimeProjectV3,
  options: ExportRendererOptions,
): Promise<ExportResult>;
```

API không được nhận raw authoring JSON. Nếu application có authoring input,
application phải compile trước rồi truyền `RuntimeProjectV3` vào package.

## Package structure

```text
packages/export-renderer/
├── package.json
├── tsconfig.json
├── Dockerfile
├── README.md
└── src/
    ├── index.ts                 # reusable library API
    ├── server.ts                # standalone HTTP API
    ├── types.ts
    ├── render-runtime-v3.ts
    ├── frame-scheduler.ts
    ├── surface.ts
    ├── paint-backend.ts
    ├── ffmpeg-encoder.ts
    ├── job-runner.ts
    ├── job-lease.ts
    ├── auth.ts
    ├── health.ts
    ├── metrics.ts
    ├── diagnostics.ts
    └── __tests__/
        ├── export-renderer.test.ts
        ├── frame-parity.test.ts
        ├── e2e-mp4.test.ts
        ├── api.test.ts
        └── docker-smoke.test.ts
```

### Trách nhiệm module

`render-runtime-v3.ts`

- Validate `RuntimeProjectV3`.
- Validate output options against the composition.
- Call `evaluateRuntimeProjectV3()` exactly once per requested frame.
- Reject invalid runtime or unsupported export commands before spending encode
  time.

`frame-scheduler.ts`

- Generate integer frame indices `0..durationInFrames - 1`.
- Calculate composition time using the canonical FPS.
- Preserve monotonic frame order.
- Report progress and per-frame metrics.

`surface.ts`

- Own the output canvas/surface.
- Expose an RGBA readback operation.
- Reset/clear the surface for every frame.
- Keep the surface implementation behind an interface so WebGL2/wgpu can be
  added later without changing the scheduler.

`paint-backend.ts`

- Consume `PaintCommandBuffer` only.
- Implement the first certified command subset:
  `beginFrame`, `endFrame`, groups, transforms, solid, rectangle, ellipse,
  image and pre-tessellated path.
- Surface unsupported text/media/effect cases as explicit diagnostics until
  their implementation is certified.

`ffmpeg-encoder.ts`

- Start one long-lived FFmpeg process per export.
- Feed raw RGBA frames through stdin.
- Never write one PNG file per frame.
- Validate FFmpeg exit status and output file existence.
- Keep codec settings deterministic for the test preset.

`server.ts`, `job-runner.ts`, `job-lease.ts`

- Expose the standalone HTTP API.
- Return `202` for accepted asynchronous jobs.
- Claim and renew Supabase job leases.
- Start exactly one render slot in the first deployment.
- Update status, progress, metrics, artifact path and output key.
- Never block the HTTP request until the MP4 is complete.

## Capability rollout

Native export should not claim full Runtime V3 support immediately. Use a
capability matrix owned by `export-renderer` and keep it synchronized with the
runtime capability ledger.

### Slice A: deterministic visual smoke test

- Background/solid.
- Rectangle and ellipse.
- Matrix4 affine 2D transform.
- Opacity and visibility.
- Layer ordering.

### Slice B: production MVP visual primitives

- Image texture loading from a local file or signed URL.
- Image fit/crop.
- Pre-tessellated path fill/stroke.
- Gradient fill if the reference backend supports it.
- Prepared glyph outlines and glyph atlas/text paint.

### Slice C: compositing and media

- Nested groups.
- Offscreen isolation.
- Blend modes.
- Masks.
- Video frame decode at exact `mediaTime`.
- Audio decode, trim, gain, pan, fade and mux.

Effects, video and audio must not be marked supported until there are dedicated
tests. The current runtime records explicit gaps for video/audio/parity, so the
plan must close those gaps rather than infer support from type definitions.

## Testing strategy

### Quy tắc preview/export parity

Mọi preview test kiểm tra hình ảnh, layout, transform, compositing, media hoặc
effect phải có một export counterpart chạy trên **cùng fixture, cùng frame,
cùng resolution và cùng FPS**. Preview pass không được coi là bằng chứng
export đúng nếu chưa tạo artifact export thực tế.

```text
Shared RuntimeProjectV3 fixture
          │
          ├── Preview backend → preview RGBA/PNG
          │
          └── Export renderer → export RGBA/PNG → export MP4
                                      │
                                      ▼
                                pixel diff + ffprobe
```

Mỗi parity run phải ghi artifact vào thư mục tạm:

```text
tmp/export-renderer/parity/
└── <suite>/<case>/
    ├── fixture.json
    ├── preview-frame-0000.png
    ├── export-frame-0000.png
    ├── diff-frame-0000.png
    ├── export.mp4
    └── result.json
```

`tmp/export-renderer` phải nằm trong `.gitignore`; chỉ lưu golden fixtures và
metadata tối thiểu trong repository. `result.json` phải ghi runtime hash,
renderer version, preview backend, output preset, frame indices, changed pixel
count, max channel delta và pass/fail.

Các test visual của `@motionvideo/preview-renderer` phải được phân loại thành:

| Nhóm preview test | Export counterpart |
| --- | --- |
| shape/solid/transform/opacity | Render MP4 thật và compare raw frame |
| path/stroke/gradient | Render raw frame và compare geometry/pixels |
| text/glyph atlas | Render cùng prepared font fixture và compare text region |
| image/fit/crop/texture upload | Render cùng asset hash và compare frame |
| video frame upload/media time | Render các timestamp cố định và compare frame |
| blur/shadow/glow/mask/blend | Render isolated frame/sequence và compare effect region |
| WebGPU/WebGL2 lifecycle/resource tests | Unit test riêng, không tự coi là parity |
| UI/playback interaction tests | Tách shared frame fixture nếu có visual assertion |

So sánh correctness theo hai tầng:

1. **Raw raster parity**: lấy RGBA trước encode từ preview và export. Đây là tiêu
   chí chính để phát hiện lệch evaluator, transform, text, path, asset và
   compositing.
2. **Container/output parity**: export MP4 thật vào `tmp/export-renderer`, dùng
   `ffprobe` kiểm tra dimensions/FPS/frame count/duration/codec, sau đó extract
   frame để kiểm tra video có phát lại được. Frame sau H.264 chỉ là kiểm tra phụ
   vì codec có thể tạo sai số.

Không dùng screenshot UI làm reference duy nhất. Preview phải expose helper
render frame từ shared `RuntimeFrameV3` fixture để test không phụ thuộc layout
hoặc browser viewport.

Mỗi suite phải khai báo threshold:

- solid/shape/transform: exact hoặc channel delta 0–1;
- text/path/antialiasing: channel tolerance ghi trong fixture;
- effect/blur: max delta và changed-pixel ratio;
- video: đúng media timestamp và tolerance cho decoder color conversion;
- audio: so sánh PCM trước AAC, không so sánh waveform đã nén.

Nếu export bỏ qua command, thiếu asset, thiếu glyph hoặc không dựng được layer
scope thì parity test phải fail, không chuyển thành warning.
### Unit tests

- Scheduler creates the expected frame sequence.
- `frame = 0` and `frame = durationInFrames - 1` are included exactly once.
- FPS/time conversion is deterministic.
- Invalid dimensions, FPS, duration and runtime version fail early.
- Unsupported paint command fails closed.
- FFmpeg failures are surfaced with a stable error code.

### Paint backend tests

For each certified operation:

1. Build a minimal `RuntimeProjectV3` fixture.
2. Evaluate it at a fixed frame.
3. Paint to the export surface.
4. Read RGBA pixels.
5. Compare against a checked-in golden image.

Pixel comparison must define:

- color space;
- alpha interpretation;
- channel tolerance;
- allowed changed-pixel ratio;
- whether antialiasing is exact or tolerance-based.

Do not compare decoded H.264 frames for renderer correctness; codec artifacts
would hide rasterization errors. Compare raw RGBA before encode, then separately
test that the MP4 is playable.

### MP4 E2E test

The test must:

1. Load a deterministic fixture runtime.
2. Render a short MP4, initially 1–3 seconds at 1080p30.
3. Run `ffprobe` and assert width, height, FPS, frame count, duration and codec.
4. Extract selected frames with FFmpeg.
5. Compare extracted frames to golden images with the documented tolerance.
6. Verify the output file is non-empty and playable.

### Seed-project acceptance suite

Use the existing five projects as performance/coverage fixtures:

- text + shapes;
- media mix;
- long video source;
- long timeline shapes;
- heavy mixed-media composite.

They are sufficient for the first render smoke and endurance run, but not full
semantic parity. Add fixtures for path/gradient, nested group/mask, effects,
complex text shaping, video trim/rate and overlapping audio before declaring
the native renderer complete.

Run acceptance in this order:

```text
P1 short → P1 60s → P2 media/audio → P3 long video
→ P4 dense timeline → P5 heavy composite
```

## Application integration — completed VPS cutover

The application now calls the native VPS worker through a server-only client.

```ts
type ExportProvider = {
  id: string;
  start(input: ExportRequest): Promise<ExportHandle>;
  status(handle: ExportHandle): Promise<ExportStatus>;
  cancel(handle: ExportHandle): Promise<void>;
};
```

First provider:

```text
native-vps
```

Later provider:

```text
packages/export-renderer HTTP worker
```

The API no longer imports a Lambda adapter. `EXPORT_RENDERER_URL` points to the
standalone worker; dashboard ownership, output key and job lifecycle remain in
the web application.

The output key remains:

```text
{userId}/{jobId}.mp4
```

The worker updates the same job with:

- `status`;
- `progress`;
- `stage`;
- `outputKey`;
- `artifactPath`;
- renderer version;
- frame count and output size;
- render/encode/upload timings.

## Local worker and VPS deployment

The first deployment target is a local CLI, not Lambda or a VPS:

```text
compile fixture
→ render-runtime-v3
→ write MP4 to tmp
→ ffprobe
→ golden frame comparison
```

The same `packages/export-renderer` server is the local worker and the VPS
deployment unit; it must not be duplicated inside the web app.

## Parity gate after native cutover

Preview test suites và native export counterparts phải chạy trong cùng một
command. Command phải tạo parity report dưới
`tmp/export-renderer/parity/` và fail nếu bất kỳ visual preview case nào không có
export case tương ứng.

Report tối thiểu phải gồm:

- preview test/case id;
- export test/case id;
- runtime/content hash;
- frame index và composition time;
- preview backend và export backend;
- raw pixel diff result;
- MP4 `ffprobe` result;
- unsupported command/asset diagnostics;
- artifact paths của preview, export và diff.

Chỉ các capability đã được export capability matrix đánh dấu supported mới cần
pass parity. Tuy nhiên, mọi case đã đánh dấu supported bắt buộc phải có raw-raster
comparison pass. MP4 encode thành công một mình không đủ để xác nhận renderer
đúng.
## Native VPS verification gate

The native VPS path is considered verified for the current subset when:

- no application import references Remotion or Lambda;
- no manifest schema requires a provider-specific runtime pin;
- local MP4 E2E passes;
- P1–P5 acceptance passes for the currently supported capability subset;
- dashboard shows completed job metadata;
- R2 contains the expected `{userId}/{jobId}.mp4` object;
- failed/cancelled jobs do not leave a false `done` record;
- a clean install succeeds without Remotion or Lambda renderer dependencies;
- typecheck, lint and the relevant test suites pass.

These removal actions are complete. Future work is limited to native parity,
media/audio support, persistence to R2, and asynchronous VPS job scheduling.

## Explicit non-goals for this iteration

- GPU rendering.
- NVENC or zero-copy framebuffer encoding.
- Static-layer surface cache.
- Distributed frame rendering.
- Autoscaling.
- Spot instances.
- Dynamic customer pricing based on actual render time.
- Full effects/mask/3D parity before the visual slice is proven.

## Recommended first implementation milestone

Build only this path first:

```text
P1 RuntimeProjectV3
  → evaluate frame
  → solid/rectangle/ellipse/transform/opacity
  → RGBA surface
  → FFmpeg H.264
  → 1080p30 MP4
  → ffprobe + golden frame test
```

Once this passes, add image and text. Only after those pass should media/audio
be introduced. This sequencing isolates renderer correctness from decoder and
encoder failures and gives Neonix a reliable native export foundation before
any performance work.


