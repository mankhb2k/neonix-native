# Kế hoạch triển khai Playback Engine Next và Runtime Audio V3

> Trạng thái: đề xuất kiến trúc và kế hoạch triển khai.
>
> Phạm vi: giữ nguyên MotionProtocolV2 ở authoring boundary; xây RuntimeProjectV3,
> compiler lowering mới cho media/audio, `playback-engine-next`, audio derivative
> pipeline và các backend media có thể thay thế.
>
> Mục tiêu cuối: một realtime playback path duy nhất cho editor, một semantic
> runtime dùng chung cho preview/export, HTML video là backend mặc định, audio
> streaming là pipeline chính, và có thể thêm WebCodecs, proxy media hoặc backend
> mới mà không đổi lại Runtime IR.

Khi có xung đột về hướng triển khai playback/audio, tài liệu này thay thế phần
roadmap tương ứng trong:

- [`linked-video-audio-playback-plan.md`](./linked-video-audio-playback-plan.md);
- [`unified-media-buffer-seek-playhead-plan.md`](./unified-media-buffer-seek-playhead-plan.md).

Hai tài liệu cũ vẫn có giá trị như audit, baseline và lịch sử quyết định. Source of
truth cho Protocol V2 hiện hành vẫn là schema/code; hướng Runtime/Playback mới là
tài liệu này. Các tài liệu cần cập nhật khi cutover gồm:

- [`v2-architechture.md`](../guide/v2-architechture.md);
- [`editor-playback.md`](../web/editor-playback.md);
- [`playback-soak-report-2026-08-28.md`](../reports/playback-soak-report-2026-08-28.md).

## 1. Quyết định tổng quát

Không rewrite toàn bộ hệ thống. Giữ các phần đúng đã có và thay đúng boundary
đang cản trở playback dài hạn.

### Giữ nguyên

- `MotionProtocolV2` và JSON authoring hiện tại.
- Authoring contract `video.payload.audio`: video và embedded audio là một intent.
- Toàn bộ schema/capability validation của Protocol V2.
- Visual semantics đã chứng nhận: timing, hierarchy, transform, paint command,
  WebGPU/WebGL2 rendering và Remotion visual parity.
- Nguyên tắc compiler/runtime là source of truth; React không sở hữu realtime
  playback state.
- Các thuật toán audio đã đúng và có thể tái sử dụng sau khi chuyển sang contract
  mới: seconds-to-samples, bounded source segmentation, gain conversion, fade curves,
  deterministic input order.
- Generation/stale-work guard, bounded diagnostics, byte accounting, scrub
  coalescing và texture upload policy nếu contract hiện tại đáp ứng invariant mới.

### Xây lại

- Internal runtime project boundary: `RuntimeProjectV2` chuyển thành
  `RuntimeProjectV3` nhưng input vẫn là `MotionProtocolV2`.
- Runtime audio IR: tách static timeline plan khỏi per-window mix plan; dùng sample
  integer sau compilation; tham chiếu logical media stream thay vì lặp URI trong
  từng clip.
- Runtime video scheduling IR: video instance độc lập với asset identity, hỗ trợ
  cùng một asset xuất hiện đồng thời ở nhiều media time.
- Compiler lowering cho media catalog, video timeline và audio timeline.
- Realtime transport/state machine, clock controller, readiness/buffer policy.
- Audio decode/cache/mixer path; implementation AudioWorklet hiện tại không được
  mang nguyên trạng sang engine mới.
- HTML video lifecycle/backend; không keyed element duy nhất theo `assetId`.
- Asset ingest/probe/audio derivative metadata và resource resolution.
- Editor playback controller integration và diagnostics.

### Không làm trong đợt rewrite nền tảng

- Không thay đổi shape của MotionProtocolV2 chỉ để phục vụ backend.
- Không tự xây general-purpose MP4/MOV/WebM demuxer cho video ngay.
- Không làm WebCodecs video thành release gate của engine mới.
- Không đưa decoder, DOM element, AudioContext, PCM, GPU handle hoặc signed URL
  lifecycle vào Runtime IR.
- Không giữ hai production playback engines lâu dài.
- Không buộc WebGPU; WebGL2 vẫn là fallback được chứng nhận.

## 2. Tại sao cần xây lại playback/media boundary

Current code có nhiều contract tốt nhưng trạng thái tài liệu, test double và hot
path browser chưa hoàn toàn trùng nhau.

### 2.1 Clock chưa thực sự là audio master

`PlaybackEngineV2` tạo `PlaybackClock` bằng scheduler time. `PlaybackClock` có khả
năng nhận `AudioContext`, nhưng engine không truyền context đó vào. Trong khi đó
`WebAudioAdapterV2` tự tạo và tự anchor một AudioContext riêng.

Hệ quả:

- visual timeline dùng `performance.now()`;
- audio scheduling dùng `AudioContext.currentTime`;
- hai clock được anchor gần nhau nhưng không có một authority chung;
- drift chỉ được chữa ở video element, không được định nghĩa bằng clock policy;
- silent project, muted project và audible project chưa có explicit clock mode.

Engine mới phải có một `ClockController` với clock source có thể thay thế. Audio
clock là master khi có audible output; monotonic clock là fallback có chủ đích,
không phải fallback vô tình.

### 2.2 Audio path hiện decode toàn asset

`WebAudioAdapterV2` fetch toàn source, gọi `decodeAudioData()`, resample toàn buffer
và cache decoded PCM. Cache đã byte-bounded và có pinning, nhưng working set thực
tế vẫn có thể vượt budget khi nhiều source active cùng lúc.

Stereo Float32 48 kHz dài 5 phút chiếm:

```text
48,000 samples/s × 2 channels × 4 bytes × 300 s
= 115,200,000 bytes
≈ 109.9 MiB
```

Đây là mỗi decoded source riêng biệt, không nhất thiết mỗi track. Reuse cùng asset
có thể share cache, nhưng nhiều asset active vẫn cộng dồn và pinned buffers không
thể bị evict giữa playback.

`RollingPcmBufferV2` và `AudioStreamingSessionV2` hiện là contract độc lập cho
future worker; chúng chưa phải production audio path. Engine mới phải biến bounded
PCM window thành hot path thật, không chỉ là abstraction được export.

### 2.3 AudioWorklet hiện tại không đủ làm nền tảng

Processor hiện tại reset cursor về sample 0, nhận chunk dùng absolute composition
sample, downmix stereo trước khi pan và dùng một gain trung bình cho cả chunk. Nó
chưa định nghĩa timeline anchor cho play từ non-zero time, seek, resume hoặc
playback-rate change.

AudioWorklet mới phải được thiết kế từ transport contract:

- reset theo generation và timeline sample;
- output sample cursor là clock authority;
- giữ channel separation;
- sample-accurate envelope và pan;
- bounded queue/ring buffer;
- underrun telemetry;
- không fetch hoặc decode trong audio rendering thread.

Cho đến khi implementation mới qua browser certification, BufferSource backend
có thể là compatibility backend của `playback-engine-next`, nhưng không phải kiến
trúc audio cuối cùng.

### 2.4 Video ownership đang theo asset thay vì instance

Editor controller và resource registration hiện map một `HTMLVideoElement` theo
`assetId`. Một asset có thể được dùng bởi hai layer/clip đồng thời với trim hoặc
media time khác nhau; một element không thể trình bày hai frame tại hai timestamp
khác nhau trong cùng composition frame.

Engine mới phải phân biệt:

- asset/source identity: có thể share URI, metadata và encoded browser cache;
- video instance identity: một timeline consumer có playhead/media time riêng;
- renderer resource identity: frame/revision cụ thể được upload.

### 2.5 Latest seek chưa là invariant xuyên suốt

Scrub đã được coalesce và operation generations đã tồn tại. Tuy nhiên video session
hiện có đường chỉ suppress seek mới khi element đang seeking; target mới chưa được
biểu diễn thành một pending target bắt buộc replay sau completion.

Engine mới phải đảm bảo:

```text
seek A -> seek B -> seek C

completion order bất kỳ
=> visible/audio state cuối cùng luôn là C
```

Invariant này áp dụng cho video seek, audio decode, resource load, GPU upload,
AudioContext resume và preparation.

### 2.6 Audio derivative mới có schema, chưa có production lifecycle đầy đủ

Protocol đã mô tả import-time audio derivative trên video asset và compiler có thể
lower nó. Asset database/API hiện chủ yếu lưu poster metadata và `has_audio`; chưa
có contract đầy đủ cho audio derivative key, manifest, codec config, chunk index,
integrity và signed-resource refresh.

Do adapter không được phép dùng original video container như audio fallback, ingest
pipeline phải trở thành một phần của release plan, không thể chỉ là future infra.

### 2.7 WebCodecs code hiện là skeleton, không phải backend hoàn chỉnh

Frame queue và backend chooser hiện có ích như proof of contract, nhưng chưa có:

- demux/index;
- decoder configuration from media probe;
- encoded-chunk fetch/range policy;
- keyframe-aware seek;
- decode backpressure;
- renderer resource integration;
- browser fallback certification.

Không nối skeleton này vào hot path. Backend interface mới phải cho phép một
WebCodecs implementation độc lập được thêm sau, khi có feature/performance trigger.

### 2.8 Baseline hiện tại vẫn có giá trị

Không xem toàn bộ code hiện tại là thất bại:

- playback-engine unit tests và editor playback tests đang pass;
- 10 phút WebGL2 soak không cho thấy leak tuyến tính ở fixture hiện tại;
- generation propagation, React boundary, byte-aware caches và renderer contracts
  là nền tốt để viết acceptance tests cho engine mới.

Rewrite phải dùng các kết quả này làm baseline và parity oracle, không bỏ chúng.

## 3. Kiến trúc đích

```text
AUTHORING — MotionProtocolV2
│
│  VideoLayer
│  ├── visual intent
│  └── embedded audio intent
│
▼
PURE COMPILER
│
▼
RuntimeProjectV3
├── composition
├── mediaCatalog
├── visual                    # reuse visual runtime semantics đã chứng nhận
├── videoTimeline             # static VideoTimelinePlanV3
└── audioTimeline             # static AudioTimelinePlanV3
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
resolveVideoAt(time)                       resolveAudioWindow(sampleRange)
        │                                              │
        ▼                                              ▼
VideoRenderPlanV3                            AudioMixPlanV3
        │                                              │
        └───────────────────┬──────────────────────────┘
                            ▼
                    PlaybackEngineNext
                    ├── TransportStateMachine
                    ├── ClockController
                    ├── OperationEpoch
                    ├── ReadinessCoordinator
                    ├── BufferPolicy
                    ├── ResourceCoordinator
                    └── Diagnostics/Metrics
                         │                 │
              ┌──────────┘                 └──────────┐
              ▼                                       ▼
         VideoBackend                            AudioBackend
         ├── HTMLVideo                       ├── StreamingWorklet
         └── WebCodecs (later)               └── BufferSource fallback
              │                                       │
              └──────────────────┬────────────────────┘
                                 ▼
                         Preview Renderer
                         ├── WebGPU
                         └── WebGL2

Export consumes the same RuntimeProjectV3 semantics through an offline backend.
```

## 4. Boundary và ownership bắt buộc

| Boundary | Sở hữu | Không sở hữu |
| --- | --- | --- |
| MotionProtocolV2 | Authoring intent, asset identity, video embedded-audio intent, independent audio tracks | Stream handle, proxy choice, signed URL refresh, samples, decoder state |
| Compiler | Validation, lowering, seconds-to-samples, media/source references, static visual/video/audio plans | Network I/O, decode, buffer readiness, clock |
| Runtime V3 | Deterministic visual/media/audio semantics và range resolution | DOM, WebAudio, WebCodecs, PCM, GPU resources, transport state |
| PlaybackEngineNext | Transport state, clock policy, generations, readiness, scheduling, diagnostics | Authoring JSON mutation, media container semantics, pixel rendering |
| MediaResourceProvider | Logical resource -> current authorized rendition/URL/manifest | Timeline semantics |
| VideoBackend | Instance lifecycle, prepare/seek/frame readiness, backend-specific buffering | Composition clock và audio |
| AudioDecodeBackend | Encoded audio chunks -> timestamped PCM | Mix semantics và transport state |
| AudioOutputBackend | Realtime mix/output, rendered sample counter, underrun | Fetch, project compilation |
| Preview renderer | Frame upload/cache và paint | Media timing, seek policy, audio clock |
| Export backend | Offline frame/audio execution from the same runtime plans | Alternative semantics |
| React/editor UI | Commands và throttled snapshots | RAF clock, decoded resources, worklet/decoder lifecycle |

## 5. Protocol V2 giữ nguyên

Authoring tiếp tục dùng một video layer có embedded audio intent:

```json
{
  "id": "video-layer-01",
  "type": "video",
  "timing": { "start": 5, "duration": 10 },
  "payload": {
    "assetId": "video-file",
    "trimStart": 2,
    "trimEnd": 12,
    "audio": {
      "enabled": true,
      "gainDb": -3,
      "fadeIn": { "duration": 0.2, "curve": "equal-power" }
    }
  }
}
```

Không yêu cầu authoring tạo một audio clip phụ và `linkedTo` video. Nếu user detach
audio, editor command mới chuyển intent thành một independent audio clip trong
Protocol V2. Compiler luôn lower cả hai trường hợp về cùng RuntimeAudioClipV3.

## 6. RuntimeProjectV3

Runtime version độc lập với protocol version. Input vẫn là MotionProtocolV2 nhưng
internal output được version thành V3 để TypeScript không cho phép consumer cũ và
mới trộn lẫn.

```ts
type RuntimeProjectV3 = {
  format: "motion-runtime";
  runtimeVersion: 3;
  projectId: string;
  composition: RuntimeCompositionV3;
  mediaCatalog: RuntimeMediaCatalogV3;
  visual: RuntimeVisualProjectV3;
  videoTimeline: RuntimeVideoTimelinePlanV3;
  audioTimeline: RuntimeAudioTimelinePlanV3;
  diagnostics: readonly RuntimeCompileDiagnosticV3[];
};
```

`RuntimeVisualProjectV3` được phép reuse types/algorithms visual V2. Không copy hoặc
viết lại transform/effect/paint semantics chỉ để đổi root runtime version.

### 6.1 Runtime media catalog

Runtime plan tham chiếu logical media/stream identity. URI có thể tồn tại trong
catalog snapshot cho deterministic export, nhưng backend không được giả định URI
là vĩnh viễn hoặc là rendition duy nhất.

```ts
type RuntimeMediaSourceRefV3 = {
  mediaId: string;
  streamId: string;
};

type RuntimeMediaCatalogV3 = {
  revision: string;
  assets: Readonly<Record<string, RuntimeMediaAssetV3>>;
};

type RuntimeMediaAssetV3 = {
  mediaId: string;
  original: RuntimeMediaResourceDescriptorV3;
  videoStreams: readonly RuntimeVideoStreamDescriptorV3[];
  audioStreams: readonly RuntimeAudioStreamDescriptorV3[];
};

type RuntimeMediaResourceDescriptorV3 = {
  resourceId: string;
  role: "original" | "preview-proxy" | "audio-proxy" | "thumbnail";
  uri?: string;
  mimeType?: string;
  integrity?: string;
  byteSize?: number;
};
```

Proxy/rendition selection thuộc `MediaResourceProvider`, không thuộc video/audio
timeline semantics. Preview có thể chọn preview proxy; export chọn original; cả hai
vẫn dùng cùng `sourceRef` và media-time mapping.

Signed URL refresh không được làm thay đổi runtime semantic hash. Resource identity
và integrity được hash; URL có expiry chỉ là locator do provider cấp tại execution.

### 6.2 Static video timeline plan

```ts
type RuntimeVideoTimelinePlanV3 = {
  instances: readonly RuntimeVideoInstanceV3[];
};

type RuntimeVideoInstanceV3 = {
  instanceId: string;
  layerId: string;
  sourceRef: RuntimeMediaSourceRefV3;
  timelineStartUs: number;
  timelineDurationUs: number;
  sourceStartUs: number;
  sourceEndUs?: number;
  playbackRate: number;
  loop: boolean;
  framePolicy: "floor" | "round" | "ceil";
};
```

`instanceId` là ownership key của decoder/element. Hai instance có cùng sourceRef
vẫn có backend handles riêng nếu media time khác nhau.

### 6.3 Static audio timeline plan

Audio được normalize sang integer sample ở compile time.

```ts
type RuntimeAudioTimelinePlanV3 = {
  sampleRate: 48000;
  tracks: readonly RuntimeAudioTrackPlanV3[];
};

type RuntimeAudioTrackPlanV3 = {
  trackId: string;
  gainLinear: number;
  pan: number;
  muted: boolean;
  clips: readonly RuntimeAudioClipV3[];
};

type RuntimeAudioClipV3 = {
  clipId: string;
  trackId: string;
  sourceRef: RuntimeMediaSourceRefV3;

  timelineStartSample: number;
  timelineDurationSamples: number;
  sourceStartSample: number;
  sourceEndSample?: number;

  playbackRate: number;
  muted: boolean;
  gainLinear: number;
  pan: number;
  fadeIn?: RuntimeAudioFadeV3;
  fadeOut?: RuntimeAudioFadeV3;

  origin?: {
    kind: "video" | "standalone-audio";
    authoringId: string;
  };
};
```

`tracks[]` là canonical semantic shape để giữ track gain/pan/mute và làm preview
debug dễ đọc. `resolveAudioWindow()` được phép xây một interval index phẳng nội
bộ, nhưng index đó là implementation detail; không được biến thành một audio
semantics khác hoặc làm mất track-level controls.

`origin` chỉ dùng cho trace/diagnostics/editor projection. Audio resolver và Audio
Engine không branch theo `origin.kind`.

### 6.4 Dynamic video render plan

```ts
type VideoRenderPlanV3 = {
  timelineTimeUs: number;
  requests: readonly VideoFrameRequestV3[];
};

type VideoFrameRequestV3 = {
  instanceId: string;
  sourceRef: RuntimeMediaSourceRefV3;
  mediaTimeUs: number;
  framePolicy: "floor" | "round" | "ceil";
  visible: boolean;
};
```

`resolveVideoAt()` là pure function. Nó không seek element và không biết backend.

### 6.5 Dynamic audio mix plan

```ts
type AudioMixPlanV3 = {
  sampleRate: 48000;
  startSample: number;
  endSample: number;
  inputs: readonly AudioMixInputV3[];
};

type AudioMixInputV3 = {
  clipId: string;
  sourceRef: RuntimeMediaSourceRefV3;
  sourceSampleRate: number;
  channels: number;
  pan: number;
  segments: readonly AudioMixSegmentV3[];
};

type AudioMixSegmentV3 = {
  compositionStartSample: number;
  compositionEndSample: number;
  sourceStartSample: number;
  sourceEndSample: number;
  gainEnvelope: RuntimeAudioGainEnvelopeV3;
};
```

`resolveAudioWindow()` chỉ trả semantics cần cho requested sample range. Nó không
phân bổ PCM, không chọn codec và không schedule AudioNode.

## 7. Compiler V3

### 7.1 Public entry point trong giai đoạn migration

```ts
compileProtocolV2ToRuntimeV3(
  project: MotionProtocolV2,
  resources?: CompileResourceCatalogV3,
): RuntimeProjectV3;
```

Compiler phải pure. `CompileResourceCatalogV3` là immutable snapshot đã được app
resolve trước; compiler không gọi database, R2, fetch hoặc media probe.

Sau cutover:

- đổi `compileProtocolV2()` để trả RuntimeProjectV3;
- xóa entry point tạm;
- xóa RuntimeProjectV2 consumers;
- không giữ adapter V2-to-V3 trong production.

### 7.2 Compiler pipeline

```text
validate MotionProtocolV2
        │
        ▼
build normalized asset index
        │
        ├── merge immutable resource snapshot
        ├── build logical stream ids
        └── validate required derivatives
        │
        ▼
compile visual nodes using certified V2 semantics
        │
        ├── lower VideoLayer visual -> VideoInstanceV3
        ├── lower VideoLayer audio intent -> RuntimeAudioClipV3
        └── lower independent audio tracks -> RuntimeAudioClipV3
        │
        ▼
validate RuntimeProjectV3 invariants
        │
        ▼
canonical runtime hash
```

### 7.3 Video embedded-audio lowering

Một authoring VideoLayer tạo hai independent runtime entries:

```text
VideoLayer
├── RuntimeVideoInstanceV3
└── RuntimeAudioClipV3
```

Các giá trị timing/trim phải được derive từ cùng normalized layer context để không
có drift do hai nhánh tự tính riêng.

Compiler rules:

- audio timeline start/duration theo effective video layer timing;
- audio source start theo video `trimStart`;
- disabled audio vẫn có thể được giữ dưới dạng muted clip cho stable diagnostics,
  hoặc được omit theo một policy duy nhất; không để consumers tự chọn;
- layer gain dB được chuyển thành finite `gainLinear` một lần;
- fade duration đổi sang integer samples và validate không vượt clip duration;
- embedded audio sourceRef trỏ vào audio stream của media asset, không trỏ vào
  video visual instance;
- missing required derivative tạo typed compile/resource diagnostic, không âm thầm
  fetch original video như audio.

### 7.4 Determinism

- Seconds-to-samples dùng một rounding policy duy nhất và có golden tests.
- Microseconds-to-frame/media mapping dùng một policy duy nhất.
- Stable sort không dựa vào object insertion tình cờ.
- Resource locator expiry không tham gia semantic hash.
- Media catalog revision/integrity tham gia resource hash khi có ảnh hưởng output.
- Preview và export gọi cùng resolver functions.

## 8. PlaybackEngineNext core

`PlaybackEngineNext` là package mới trong thời gian triển khai:

```text
packages/playback-engine-next/
  src/
    core/
      playback-engine.ts
      transport-state-machine.ts
      operation-token.ts
      readiness-coordinator.ts
      buffer-policy.ts
      scheduler.ts
    clock/
      clock-controller.ts
      clock-source.ts
      audio-clock-source.ts
      monotonic-clock-source.ts
      manual-clock-source.ts
    audio/
      audio-engine.ts
      audio-backend.ts
      decode-coordinator.ts
      pcm-window.ts
      audio-buffer-policy.ts
      worklet-protocol.ts
      streaming-worklet-backend.ts
      buffer-source-backend.ts
    video/
      video-engine.ts
      video-backend.ts
      video-instance-pool.ts
      video-buffer-policy.ts
      html-video-backend.ts
      video-frame-resource.ts
    resources/
      media-resource-provider.ts
      rendition-policy.ts
      resource-lease.ts
    diagnostics/
      metrics.ts
      bounded-history.ts
      snapshot.ts
    index.ts
```

Current implementation follows this tree as the single source of truth; the
former flat `src/*.ts` compatibility files have been removed. Public exports
come only from `src/index.ts` and the canonical domain folders.

Sau cutover, package này thay thế `packages/playback-engine`; không giữ hậu tố
`next` trong public workspace API.

### 8.1 Transport state machine

```text
unloaded
  └── load ─────────────► paused

paused
  ├── play ─────────────► preparing
  ├── seek/preview ─────► seeking
  └── unload ───────────► unloaded

preparing
  ├── minimum audio ready ─► playing
  ├── newer seek ──────────► seeking
  ├── pause ───────────────► paused
  └── fatal resource error ► paused/error diagnostic

playing
  ├── pause ───────────────► paused
  ├── seek ────────────────► seeking
  ├── timeline end ────────► paused or loop-preparing
  └── video starvation ────► playing; repeat/drop visual frame

seeking
  ├── newer seek ──────────► seeking; previous work stale
  ├── ready + resume flag ─► preparing
  └── ready ───────────────► paused

any state
  └── dispose ─────────────► disposed
```

State transition phải synchronous ở core; async preparation chỉ trả event kèm
operation token.

### 8.2 Operation token

```ts
type PlaybackOperationToken = {
  documentGeneration: number;
  transportGeneration: number;
  seekGeneration: number;
};
```

Mọi async completion mang token. Core cung cấp một helper duy nhất:

```ts
isCurrentOperation(token): boolean;
```

Token cũ phải bị discard và resource kèm theo phải được release/close. Không chỉ
`return` rồi bỏ quên VideoFrame, ArrayBuffer, object URL hoặc lease.

### 8.3 Clock controller

```ts
interface PlaybackClockSource {
  readonly kind: "audio" | "monotonic" | "manual";
  nowSeconds(): number;
  readonly running: boolean;
}
```

ClockController giữ:

```ts
type ClockAnchor = {
  sourceTimeSeconds: number;
  timelineTimeSeconds: number;
  playbackRate: number;
  generation: number;
};
```

Timeline time:

```text
anchor.timeline
+ (source.now - anchor.sourceTime) × playbackRate
```

Clock policy:

- audible audio và output running: audio clock;
- không có audible input: monotonic clock;
- pause/scrub/frame-step: manual clock;
- clock source switch phải re-anchor không làm timeline jump;
- tab visibility/resume và AudioContext interruption phải re-anchor;
- renderer RAF đọc clock; renderer không advance clock.

AudioWorklet sample counter là authority cao nhất của streaming backend. Nếu
sample counter không thể đọc low-jitter, dùng `AudioContext.currentTime` hoặc
`getOutputTimestamp()` qua `AudioClockSource` mà không đổi PlaybackEngine core.

### 8.4 Readiness policy

Không hard-code luôn chờ 500 ms và không chờ video vô hạn.

Default đề xuất:

```ts
type AudioPrebufferPolicy = {
  minimumSeconds: 0.1;
  targetSeconds: 0.3;
  maximumSeconds: 0.75;
};
```

- `preparing -> playing` khi mọi audible input bắt buộc đã có minimum window hoặc
  đã trả typed terminal error theo policy.
- Video chỉ cần best-effort first frame với timeout nhỏ; hết timeout vẫn bắt đầu
  audio và dùng poster/last frame/transparent frame theo visual policy.
- Underrun làm tăng target trong giới hạn.
- Memory pressure làm giảm lookahead, release idle leases và chọn proxy thấp hơn.
- Không pause audio chỉ vì video thiếu frame.

### 8.5 Scheduler

- Audio scheduling theo sample windows, không theo visual frame count.
- Visual evaluation theo current clock time và composition FPS.
- Media preload dùng query window, không compile/evaluate toàn future frame.
- Main-thread long task không được làm audio output thread dừng nếu PCM target đã
  được chuẩn bị.

## 9. Audio Engine mới

### 9.1 Components

```text
AudioTimelinePlanV3
        │
resolveAudioWindow()
        │
        ▼
AudioMixPlanV3
        │
        ├── DecodeCoordinator
        │     ├── MediaResourceProvider
        │     ├── chunk/index lookup
        │     └── AudioDecodeWorker(s)
        │
        ▼
bounded timestamped PCM windows
        │
        ▼
Streaming AudioWorklet Mixer
        │
        ├── sample-accurate gain/fades
        ├── pan/channel mapping
        ├── overlap mix
        ├── rendered sample counter
        └── underrun telemetry
        │
        ▼
audio device
```

### 9.2 Audio decode backend

```ts
interface AudioDecodeBackend {
  configure(stream: ResolvedAudioStream, token: PlaybackOperationToken): Promise<void>;
  decode(
    request: AudioDecodeRequest,
    token: PlaybackOperationToken,
  ): Promise<readonly PcmChunk[]>;
  reset(token: PlaybackOperationToken): void;
  dispose(): void;
}
```

Target implementation dùng worker và WebCodecs `AudioDecoder` khi supported. Không
để AudioDecoder tự hiểu container; resource manifest/index phải cung cấp decoder
config và encoded chunks. Backend fallback có thể dùng server-prepared decodable
segments hoặc BufferSource path trong giới hạn asset size.

### 9.3 PCM window

```ts
type PcmChunk = {
  sourceRef: RuntimeMediaSourceRefV3;
  generation: number;
  startSample: number;
  sampleRate: number;
  channels: number;
  frames: number;
  data: Float32Array;
};
```

Invariants:

- timestamp monotonic trong từng source/generation;
- reject overlap hoặc normalize theo một rule được test;
- byte budget, seconds budget và chunk count đều bounded;
- old generation bị discard trước khi vào mixer;
- release transferred buffers sau consumption;
- không lưu toàn timeline PCM;
- cache encoded chunks tách khỏi PCM working set.

### 9.4 Worklet protocol

```ts
type AudioWorkletCommand =
  | {
      type: "reset";
      generation: number;
      timelineStartSample: number;
    }
  | {
      type: "configure-input";
      generation: number;
      inputId: string;
      channels: number;
      pan: number;
    }
  | {
      type: "push-pcm";
      generation: number;
      inputId: string;
      timelineStartSample: number;
      channels: number;
      frames: number;
      data: Float32Array;
      envelope: readonly AudioEnvelopeSegment[];
    }
  | { type: "remove-input"; generation: number; inputId: string }
  | { type: "pause"; generation: number }
  | { type: "start"; generation: number };
```

Processor phải:

- reset cursor về `timelineStartSample`, không mặc định 0;
- mix stereo/multichannel theo documented mapping;
- áp dụng envelope theo sample;
- clamp/soft-limit output theo một policy được chốt, không clip tình cờ;
- đếm rendered samples và underruns;
- gửi metrics ở tần suất thấp, không postMessage mỗi render quantum;
- không cấp phát array lớn trong `process()`;
- không sort toàn bộ chunk list trong hot path.

Transferable ArrayBuffer là baseline. SharedArrayBuffer chỉ bật sau khi đánh giá
COOP/COEP với OAuth, asset origins và embeds; transport contract không được phụ
thuộc bắt buộc vào SAB.

### 9.5 BufferSource compatibility backend

Backend này phục vụ:

- parity trong giai đoạn bring-up;
- browser không hỗ trợ target path;
- project nhỏ nằm dưới explicit full-decode budget.

Nó phải dùng cùng `AudioMixPlanV3` và `ClockController`, không được tạo một timing
model thứ hai. Full-decode fallback phải có size/duration guard và diagnostic khi
không phù hợp.

## 10. Video Engine mới

### 10.1 Backend-neutral contract

```ts
interface VideoBackend {
  readonly kind: "html-video" | "webcodecs" | string;
  acquire(instance: RuntimeVideoInstanceV3): Promise<VideoHandle>;
  prepare(handle: VideoHandle, request: VideoPrepareRequest): Promise<VideoReadyState>;
  synchronize(handle: VideoHandle, request: VideoFrameRequestV3): void;
  getFrameResource(handle: VideoHandle): VideoFrameResource | null;
  release(handle: VideoHandle): void;
  dispose(): void;
}
```

`VideoFrameResource` là renderer-facing opaque resource. Nó có thể wrap
HTMLVideoElement, VideoFrame hoặc backend-specific external image, nhưng Runtime
và Playback core không branch theo concrete type.

### 10.2 HTMLVideo backend là baseline

HTML backend sở hữu:

- element creation/pool/release;
- permanent `muted = true`;
- cross-origin và preload policy;
- instance-keyed current/pending target;
- play promise lifecycle;
- `seeked`, error, loadeddata và rVFC subscriptions;
- drift thresholds;
- exact paused seek policy;
- decoded revision;
- visibility/memory pressure;
- active/lookahead/idle eviction.

Playing behavior:

- element được phép advance bằng native media clock;
- engine không set `currentTime` mỗi RAF;
- hard correction chỉ khi drift vượt threshold;
- missing frame không làm audio pause;
- rVFC chỉ đánh dấu decoded frame/revision ready, không trở thành composition clock.

Paused seek behavior:

- target mới luôn replace pending target;
- completion cũ không publish visible resource;
- khi seek hiện tại hoàn tất, backend lập tức apply latest pending target nếu còn;
- final scrub target phải repaint ngay cả khi pointer-up xảy ra trong pending seek.

### 10.3 WebCodecs backend sau này

WebCodecs backend implement cùng contract và được thêm khi có ít nhất một trigger:

- exact frame stepping không đạt bằng HTML video;
- reverse playback hoặc speed ramp;
- nhiều concurrent video instances vượt native-element budget;
- bulk thumbnail/frame extraction;
- latency/seek benchmark không đạt;
- browser-side export hoặc custom effects cần direct VideoFrame control.

RFC WebCodecs riêng phải chốt demux/index, keyframe seek, backpressure, frame queue
byte budget, close lifecycle và fallback. Không dùng sự tồn tại của current queue
skeleton làm lý do bật backend.

## 11. Proxy media và resource provider

Proxy support được đặt ở resource/rendition boundary để không đổi Runtime lần nữa.

```ts
interface MediaResourceProvider {
  resolveVideo(
    sourceRef: RuntimeMediaSourceRefV3,
    policy: VideoRenditionPolicy,
    token: PlaybackOperationToken,
  ): Promise<ResolvedVideoResource>;

  resolveAudio(
    sourceRef: RuntimeMediaSourceRefV3,
    policy: AudioRenditionPolicy,
    token: PlaybackOperationToken,
  ): Promise<ResolvedAudioStream>;
}
```

Preview policy có thể chọn:

- resolution gần stage viewport;
- codec browser hỗ trợ;
- lower bitrate dưới memory/network pressure;
- original khi không có proxy.

Export policy chọn original hoặc mezzanine đủ chất lượng. Timeline plan không đổi
khi rendition đổi vì tất cả renditions phải giữ cùng normalized media timeline;
pipeline ingest phải ghi timestamp mapping nếu proxy thay đổi edit list/time base.

## 12. Asset ingest và audio derivative pipeline

### 12.1 Metadata cần persist

Tối thiểu:

```text
source probe
├── duration/time base
├── video streams
│   ├── codec/config
│   ├── dimensions/fps
│   └── keyframe/index metadata khi cần
├── audio streams
│   ├── codec/config
│   ├── sample rate/channels
│   └── duration samples
├── poster derivative
├── preview video proxy (optional)
└── seekable audio derivative
    ├── manifest/index key
    ├── codec configuration
    ├── chunk/object keys hoặc byte ranges
    ├── timestamps/sample ranges
    └── integrity/version
```

### 12.2 Lifecycle

```text
upload original
  -> asset status: processing
  -> media probe
  -> poster/audio derivative jobs
  -> verify objects + metadata transaction
  -> asset status: ready | partially-ready | failed
```

Visual video có thể ready trước audio derivative, nhưng UI phải biểu diễn rõ
`audio preparing/unavailable`; không fabricate audio và không dùng original
container như undocumented fallback.

### 12.3 Authorization và signed URLs

- Database lưu private object keys, không lưu signed URL lâu dài.
- Resource provider presign ở execution boundary.
- Manifest/chunk requests phải cùng workspace authorization.
- Refresh URL không invalidate document generation nếu resource identity không đổi.
- Integrity/version đổi phải invalidate resource generation và decoded caches.

## 13. Editor integration

Editor composition root tạo đúng một PlaybackControllerNext cho mỗi editor session.

```text
Editor command/document
        │
        ▼
compile RuntimeProjectV3
        │
        ▼
PlaybackControllerNext.load(runtime)
        │
        ├── realtime frame sink -> Stage painter
        ├── throttled transport snapshot -> Zustand/React UI
        ├── diagnostics snapshot -> debug panel
        └── resource registrations -> MediaResourceProvider
```

Không lưu trong React state:

- RuntimeFrameV3 realtime objects;
- HTMLVideoElement/VideoFrame;
- AudioBuffer/PCM chunks;
- AudioContext/WorkletNode;
- decoder/worker handles;
- GPU resources;
- per-RAF current time.

UI transport snapshot có thể chứa scalar/bounded data:

```ts
type PlaybackUiSnapshot = {
  mode: "paused" | "preparing" | "playing" | "seeking";
  time: number;
  duration: number;
  clockKind: "audio" | "monotonic" | "manual";
  generation: number;
  audioBufferedAheadMs: number;
  videoReadiness: "ready" | "waiting" | "missing";
};
```

## 14. Preview/export parity

Runtime V3 chỉ thành công nếu preview và export dùng cùng semantic resolvers.

### Preview

- `resolveVideoAt()` -> backend frame resource -> WebGPU/WebGL2.
- `resolveAudioWindow()` -> realtime Audio Engine.

### Export

- visual evaluator/paint command hiện tại được reuse qua RuntimeVisualProjectV3;
- `resolveVideoAt()` cung cấp source media time cho Remotion/offline decoder;
- `resolveAudioWindow()` cung cấp cùng source ranges/envelopes cho offline mixer;
- export không đọc authoring JSON trực tiếp và không tự tính trim/fade riêng.

Golden parity phải so:

- active inputs tại sample boundaries;
- source start/end samples;
- bounded source segmentation;
- gain/fade values;
- pan/channel mapping;
- embedded video audio và detached audio;
- video media time tại frame boundaries.

### 14.1 Preview fixture A — hai audio source độc lập cùng mix

ID đề xuất: `audio.mix.two-inputs-v3`.

Đây là project không có visual layer, dùng để kiểm tra rằng hai nguồn độc lập đi
qua cùng một `AudioTimelinePlanV3` và trở thành hai input của một mix window:

```text
MotionProtocolV2
├── audio track: music
│   └── music-01: t=0..12s, trim=0..12s, gain=-6 dB
└── audio track: voice
    └── voice-01: t=2..8s, trim=0..6s, gain=-1 dB,
                 fade-in=0.2s equal-power,
                 fade-out=0.3s equal-power
```

Expected compiler output:

```text
RuntimeProjectV3
├── VideoTimelinePlanV3: empty
└── AudioTimelinePlanV3
    ├── Track music -> AudioClip music-01
    └── Track voice -> AudioClip voice-01
```

Expected resolver behavior:

```text
resolveAudioWindow(1.0s, 1.25s)
  -> [music-01]

resolveAudioWindow(3.0s, 3.25s)
  -> [music-01, voice-01]
  -> music source 3.0..3.25s
  -> voice source 1.0..1.25s

resolveAudioWindow(8.0s, 8.25s)
  -> [music-01]
```

Preview implementation:

- thêm case `/docs/preview?case=audio.mix.two-inputs-v3`;
- dùng project-level transport, không dùng single-clip audition element;
- ở thời điểm 3s hiển thị hai active inputs, source range, gain/fade/pan và clock;
- mute `voice` chỉ loại `voice-01`, không re-anchor hoặc làm gián đoạn `music-01`;
- pause/seek/resume dùng cùng một engine, AudioContext và generation;
- WebGL2/WebGPU switch không làm thay đổi AudioMixPlanV3.

### 14.2 Preview fixture B — video có embedded audio + background music

ID đề xuất: `audio.mix.video-plus-music-v3`.

Authoring có một VideoLayer chứa audio intent và một audio track độc lập:

```text
MotionProtocolV2
├── VideoLayer video-01
│   ├── visual: t=0..10s, trim=0..10s
│   └── audio: enabled=true, gain=-3 dB,
│              fade-in=0.1s linear, fade-out=0.2s equal-power
└── audio track: music
    └── music-01: t=0..10s, trim=0..10s, gain=-12 dB
```

Video asset phải có audio derivative metadata hợp lệ. Original video URI chỉ dùng
cho visual backend; Audio Engine dùng `sourceRef` của audio stream/derivative.

Expected compiler output:

```text
RuntimeProjectV3
├── MediaCatalog
│   └── video-source: video stream + audio stream/derivative
├── VideoTimelinePlanV3
│   └── video-01
└── AudioTimelinePlanV3
    ├── Track video-audio -> AudioClip video-01-audio
    └── Track music       -> AudioClip music-01
```

Expected resolver behavior at 4s:

```text
resolveVideoAt(4.0s)
  -> video request video-01, mediaTime=4.0s

resolveAudioWindow(4.0s, 4.25s)
  -> [video-01-audio, music-01]
  -> video audio source 4.0..4.25s, gain=-3 dB + fade state
  -> music source 4.0..4.25s, gain=-12 dB
```

Preview implementation:

- thêm case `/docs/preview?case=audio.mix.video-plus-music-v3`;
- video hiển thị bằng muted HTML video/WebCodecs backend, nhưng native video audio
  luôn tắt;
- chỉ Audio Engine tạo audible output cho cả `video-01-audio` và `music-01`;
- tắt `video-01.payload.audio.enabled` loại đúng `video-01-audio`, music vẫn chạy;
- seek tới 7s reset video instance và cả hai audio inputs bằng một operation token;
- thiếu derivative báo diagnostic rõ ràng, không fetch original video như audio;
- preview và Remotion export phải tạo cùng active input IDs/source ranges.

### 14.3 Preview fixture implementation checklist

- [ ] Thêm `V2_AUDIO_MIX_FIXTURES` (hoặc collection tương đương) với hai project
  fixture ở trên; Protocol input vẫn là V2.
- [ ] Thêm test-only deterministic `music`, `voice` và `video-with-audio` assets
  có metadata/derivative hợp lệ.
- [ ] Đăng ký hai case ổn định trong `apps/web/lib/docs/preview-lab.ts` và group
  `Audio / mix`.
- [ ] Nâng `apps/web/components/docs/PreviewLab.tsx` để chạy project-level mix;
  không chỉ lấy `firstClip` như single-clip audition hiện tại.
- [ ] Chuyển fixture transport sang `compileProtocolV2ToRuntimeV3()` khi Phase 2
  hoàn tất.
- [ ] Thêm browser assertions: active input count, muted native video, generation,
  seek latest-wins, one engine/AudioContext và no stale audio.
- [ ] Thêm offline golden assertions cho hai sample windows và preview/export parity.
- [ ] Giữ các atomic capability fixtures hiện tại; hai fixture này bổ sung
  integration coverage, không thay thế chúng.

### 14.4 Asset inventory hiện tại và asset cần chuẩn bị

Đã kiểm tra asset trong repo bằng `ffprobe`. Hiện trạng:

| Asset | Thông số thực tế | Dùng cho |
| --- | --- | --- |
| [`assets/music/Music-MBB-Island-Tropical_128k.mp3`](../../assets/music/Music-MBB-Island-Tropical_128k.mp3) | MP3, 124.551837s, stereo, 44.1 kHz, khoảng 2.9 MB | Background music; đồng thời kiểm tra resample lên runtime 48 kHz |
| [`apps/web/public/docs/example-video.mp4`](../../apps/web/public/docs/example-video.mp4) | H.264 Main 1920×1080/30 fps, 60.5s; AAC-LC stereo 48 kHz, 60.48s; khoảng 154 MB | Visual video baseline và nguồn để extract derivative |
| [`apps/web/app/api/docs/audio/route.ts`](../../apps/web/app/api/docs/audio/route.ts) | Serve toàn bộ MP3 trên qua `/api/docs/audio` | Existing docs audio fixture path |

Kết luận: **cần chuẩn bị thêm, nhưng chỉ cần hai asset bắt buộc** cho hai preview
scenario; không cần thêm nhiều bản nhạc hoặc PCM toàn timeline.

#### Asset bắt buộc 1 — audio source thứ hai

Fixture `audio.mix.two-inputs-v3` cần một source độc lập với music. Đề xuất:

```text
assets/audio/preview-voice-8s.wav
```

Yêu cầu tối thiểu:

- duration khoảng 8 giây;
- mono hoặc stereo đều được, ưu tiên mono để kiểm tra channel mapping;
- PCM WAV 48 kHz cho test deterministic và decode đơn giản;
- có fade đầu/cuối tự nhiên hoặc signal rõ để nghe được overlap;
- fixture/test-only, có provenance/license rõ ràng.

Nếu chưa có voice recording, dùng một tone/chime tổng hợp deterministic là đủ cho
integration test; không cần dùng giọng người thật. Runtime vẫn phải kiểm tra gain,
fade, pan và overlap, không kiểm tra nội dung nghệ thuật của audio.

#### Asset bắt buộc 2 — audio derivative của video

`example-video.mp4` đã có AAC audio nhưng original video URI không được dùng như
audio fallback. Cần tạo object riêng:

```text
apps/web/public/docs/fixtures/audio/example-video-audio.m4a
```

Và thêm metadata vào `V2VideoAsset.audio`:

```ts
audio: {
  uri: "/docs/fixtures/audio/example-video-audio.m4a",
  mimeType: "audio/mp4",
  duration: 60.48,
  sampleRate: 48000,
  channels: 2,
}
```

Extraction baseline cho fixture local:

```text
ffmpeg -i apps/web/public/docs/example-video.mp4 \
  -map 0:a:0 -vn -c:a copy \
  apps/web/public/docs/fixtures/audio/example-video-audio.m4a
```

Đây chỉ là fixture derivative để chứng minh contract. Production vẫn cần Phase 6
probe/transcode/storage lifecycle và private signed resource.

#### Video fixture nên dùng trong docs preview

`example-video.mp4` 154 MB quá lớn để làm fixture lặp lại trong `/docs/preview` và
Playwright. Có thể giữ nó làm media baseline, nhưng nên tạo thêm bản ngắn:

```text
apps/web/public/docs/fixtures/media/video-with-audio-10s.mp4
```

Đề xuất 8–10 giây, 1280×720 hoặc 640×360, H.264 + AAC 48 kHz. Derivative audio của
bản ngắn đặt cạnh file video. Bản ngắn giúp preview load nhanh, test seek và
generation ổn định; không làm thay đổi semantic fixture.

#### Asset không cần chuẩn bị ngay

- Không cần thêm 10 audio tracks.
- Không cần commit 5 phút PCM Float32.
- Không cần tạo WebCodecs video chunks cho Phase 0–5.
- Không cần thêm nhiều bản nhạc chỉ để chứng minh overlap; một music + một voice
  là đủ.
- Long-media/underrun fixture có thể generate trong test/CI hoặc thêm sau Phase 6;
  không nên làm tăng repo size trước khi streaming contract được implement.

#### Acceptance khi asset đã sẵn sàng

- [ ] Music source load được ở 44.1 kHz và runtime normalize thành 48 kHz.
- [ ] Voice source là sourceRef khác music và xuất hiện như input thứ hai trong
  window 2–8 giây.
- [ ] Video visual dùng video URI; embedded audio dùng derivative URI.
- [ ] Original video không bao giờ bị `fetch`/`decodeAudioData` trong audio path.
- [ ] Preview có hai case mix project-level, không chỉ single-clip audition.
- [ ] Asset fixture URLs có thể thay bằng private signed URLs mà không đổi
  `AudioTimelinePlanV3`/`AudioMixPlanV3` semantics.

## 15. Kế hoạch triển khai theo phase

Các phase là dependency order, không phải cam kết lịch. Mỗi phase phải merge được
với tests xanh và không làm current editor path hỏng.

### Phase 0 — Architecture lock và baseline

Mục tiêu: biến tài liệu này thành contract reviewable trước khi code mới lan rộng.

Tasks:

- [x] Chốt ADR: Protocol V2 giữ nguyên, Runtime V3 là breaking internal boundary.
- [x] Chốt ownership table và prohibited dependencies.
- [x] Ghi baseline current tests, browser behavior, performance và memory.
- [ ] Thêm real-media fixtures: silent video, video+audio derivative, standalone
  audio, long audio, duplicate video asset instances, corrupt/unsupported media.
- [ ] Bổ sung browser reproduction cho non-zero audio play/seek và pending video
  seek để current limitations có bằng chứng.
- [ ] Liệt kê V2 types/exports/files sẽ reuse, port, replace hoặc delete.

Exit gate:

- ADR được review;
- fixtures có license/provenance rõ;
- baseline report được commit;
- không còn câu hỏi về component ownership.

### Phase 1 — RuntimeProjectV3 types và validators

Mục tiêu: định nghĩa IR mới mà chưa thay production playback.

Tasks:

- [x] Tạo `packages/motion-runtime/src/v3/`.
- [x] Tạo RuntimeProjectV3, media catalog, video/audio timeline plan types.
- [x] Re-export/reuse visual V2 primitives dưới explicit V3 visual boundary.
- [x] Viết validators cho source refs, sample ranges, instance ids và stream ids.
- [x] Tạo canonical hash rules bỏ signed URL expiry khỏi semantic identity.
- [x] Tạo pure `resolveVideoAt()` và `resolveAudioWindow()`.
- [x] Port audio mapping algorithms đã đúng từ V2, không copy backend code.

Exit gate:

- unit tests cho every boundary/rounding case;
- no DOM/WebAudio/WebCodecs imports trong runtime v3;
- validators reject dangling stream refs và invalid ranges;
- deterministic hashes pass repeated/shuffled-input tests.

### Phase 2 — Compiler lowering V2 -> Runtime V3

Mục tiêu: một Protocol V2 document compile thành complete RuntimeProjectV3.

Tasks:

- [x] Tạo `compileProtocolV2ToRuntimeV3()`.
- [x] Build media catalog và stable stream IDs.
- [x] Lower video visual/timeline instance.
- [x] Lower embedded video audio thành RuntimeAudioClipV3.
- [x] Lower independent audio clips vào cùng IR.
- [x] Normalize seconds -> samples/microseconds một lần.
- [x] Thêm typed resource diagnostics cho missing derivatives/proxies.
- [x] Port visual compile output sang RuntimeVisualProjectV3 mà không đổi semantics.

Exit gate:

- compiler fixtures V2 và V3 visual parity;
- embedded/detached/standalone audio cùng resolver shape;
- no network/storage dependency trong compiler;
- preview/export test fixtures có thể consume RuntimeProjectV3.

### Phase 3 — Offline/adapter parity trước realtime engine

Mục tiêu: chứng minh Runtime V3 semantic đúng trước khi debug clock/decoder.

Tasks:

- [x] Tạo reference offline audio evaluator cho AudioMixPlanV3.
- [x] Nối resolver tests vào V3 offline reference evaluator.
- [x] So golden samples/envelopes giữa current certified fixtures và V3.
- [x] So video media-time selection tại frame boundaries.
- [x] Chốt intentional differences và update golden data, không silently bless.

Exit gate:

- audio semantic parity pass;
- visual frame parity pass;
- mọi khác biệt có ADR/test giải thích.

### Phase 4 — PlaybackEngineNext pure core

Mục tiêu: transport/state/clock/generation test được mà không có browser APIs.

Tasks:

- [x] Tạo package `@motionvideo/playback-engine-next`.
- [x] Implement state machine.
- [x] Implement operation tokens và resource-disposal guard.
- [x] Implement ClockController và fake clocks.
- [x] Implement scheduler, readiness coordinator và adaptive buffer policy.
- [x] Implement frame/audio plan dispatch interfaces.
- [x] Implement bounded metrics/snapshots.
- [x] Establish canonical `core/`, `clock/`, `audio/`, `video/`, `resources/`, and
  `diagnostics/` package boundaries with compatibility shims during migration.

Exit gate:

- deterministic fake-clock tests;
- rapid play/pause/seek/load sequences pass model tests;
- stale completions không publish hoặc leak;
- clock source switch không tạo timeline discontinuity;
- no React/DOM imports trong core.

### Phase 5 — HTMLVideo backend và renderer resource bridge

Mục tiêu: visual playback/seek dùng engine mới nhưng vẫn tận dụng Chrome decode.

Tasks:

- [x] Implement instance-keyed HTML video pool.
- [x] Implement latest pending seek replay.
- [x] Implement active/lookahead/idle preload policy.
- [x] Implement rVFC decoded revision và fallback events.
- [x] Implement drift correction theo ClockController.
- [x] Tạo opaque VideoFrameResource bridge dùng chung cho WebGPU/WebGL2.
- [x] Bảo toàn shared texture upload policy và stale generation guard.
- [x] Test cùng asset ở hai concurrent instances với media time khác nhau.

Exit gate:

- paused final seek exact/latest-wins;
- no repeated hard seek trong tolerance;
- duplicate asset instances render độc lập;
- backend dispose giải phóng listeners/rVFC/elements;
- WebGL2/WebGPU resource contract parity.

### Phase 6 — Asset probe và audio derivative production path

Mục tiêu: mọi audio input có source metadata/bytes mà Audio Engine mới dùng được.

Tasks:

- [ ] Thiết kế DB migration cho probe/stream/derivative metadata.
- [x] Implement media probe job và status lifecycle.
- [x] Generate/verify poster và seekable audio derivative qua generator/verifier
  boundary (backend ffmpeg/object-store wiring remains deployment-specific).
- [x] Normalize/persist codec config, sample rate, channels, duration samples,
  version,
  manifest/index và integrity.
- [ ] Implement authorized manifest/chunk endpoints hoặc presigned object access.
- [x] Implement MediaResourceProvider và signed URL refresh.
- [x] Hydrate immutable compile resource snapshot.
- [ ] UI states cho processing/partial/failure.

Exit gate:

- uploaded real video có embedded audio preview source hợp lệ;
- original video container không bị fetch như audio fallback;
- unauthorized workspace không đọc được derivative;
- retry/idempotency không tạo orphaned DB/object state.

### Phase 7 — Streaming Audio Engine và AudioWorklet

Mục tiêu: audio master clock và bounded PCM trở thành production hot path.

Tasks:

- [ ] Implement AudioDecodeBackend worker.
- [x] Implement encoded chunk/index reader boundary.
- [x] Implement generation-aware bounded PCM windows.
- [x] Implement Worklet protocol boundary và transfer-based backend.
- [x] Implement sample-accurate gain/fade/pan/overlap mixer primitive.
- [x] Expose rendered sample counter/underrun telemetry contract qua backend.
- [ ] Implement adaptive prebuffer/underrun policy.
- [x] Implement BufferSource compatibility backend với explicit limits.
- [ ] Test transfer path trước; đánh giá SAB/COOP/COEP riêng.

Exit gate:

- play từ time 0 và non-zero time đúng;
- seek/pause/resume không phát stale PCM;
- 5–30 phút media không decode toàn file;
- PCM/encoded working sets nằm trong budget;
- audio output tiếp tục khi video frame trễ;
- sample/envelope parity với offline evaluator.

### Phase 8 — Editor integration và shadow comparison

Mục tiêu: editor dùng engine mới qua feature flag trong thời gian ngắn.

Tasks:

- [x] Tạo PlaybackControllerNext và stable provider boundary.
- [x] Cung cấp direct `VideoPlan` sink boundary; app Stage wiring vẫn là cutover
  task.
- [x] Nối throttled transport store/UI snapshot boundary.
- [x] Nối scrub coordinator và resume-after-scrub policy.
- [ ] Nâng debug panel: clock kind, buffer ahead, underruns, seek generations,
  backend/rendition, resource bytes.
- [x] Tạo semantic shadow-compare boundary cho Runtime V3 probes trong dev/test;
  V2 adapter wiring và full editor shadow run vẫn là bước cutover tiếp theo.
- [x] Thêm feature flag chỉ phục vụ migration.

Exit gate:

- full editor E2E matrix pass trên engine mới;
- no broad React rerender theo RAF;
- no old engine resource chạy song song;
- diagnostic đủ xác định clock/audio/video/backend state.

### Phase 9 — Certification, cutover và xóa legacy

Mục tiêu: chỉ còn một architecture.

Tasks:

- [x] Thêm architecture certification check cho canonical tree, flat-file removal
  và danh sách legacy consumers.
- [ ] Chạy unit, typecheck, renderer parity, Remotion parity và Playwright matrix.
- [ ] Chạy 30–60 phút audio/video soak với long real media.
- [ ] Profile CPU, heap, AudioWorklet underrun và GPU resource counts.
- [ ] Bật engine mới mặc định.
- [ ] Xóa feature flag sau một stabilization window ngắn trong dev.
- [ ] Xóa `packages/playback-engine` implementation cũ.
- [ ] Rename `playback-engine-next` thành canonical playback package/API.
- [ ] Xóa Runtime V2 audio project/mix contracts và compatibility adapters.
- [ ] Đổi `compileProtocolV2()` sang RuntimeProjectV3 và xóa temporary entry point.
- [ ] Cập nhật architecture guide, playback docs và capability claims.

Certification hiện xác nhận canonical tree và không còn direct consumer của
`@motionvideo/playback-engine` trong app source. Một compatibility bridge V2
vẫn nằm trong `playback-engine-next` để giữ editor behavior; cần loại bridge
đó sau khi Stage/transport chuyển hoàn toàn sang RuntimeProjectV3.

Exit gate:

- repo search không còn production import của legacy playback/audio types;
- architecture validation scripts khóa dependency mới;
- test/soak artifacts được lưu;
- docs không mô tả experimental contract là implemented.

### Phase 10 — Optional backends, không đổi Runtime

Sau cutover, các dự án độc lập có thể thêm:

- WebCodecs video backend;
- server/browser preview video proxies;
- low-memory/mobile audio backend;
- remote decode backend;
- offline native backend;
- thumbnail extraction backend.

Điều kiện: chỉ implement existing backend/resource interfaces. Nếu một backend yêu
cầu đổi timeline semantics, đó là dấu hiệu contract Runtime thiếu và cần RFC, không
được branch semantics âm thầm trong backend.

## 16. Test matrix bắt buộc

### 16.1 Compiler/runtime unit tests

| Nhóm | Cases |
| --- | --- |
| Time normalization | fractional seconds, exact frame edge, long duration, rounding |
| Video lowering | trim, duplicate asset instances, inactive timing, frame policies |
| Embedded audio | enabled/muted, gain, fade, trim, missing derivative |
| Independent audio | trim, playbackRate, overlap, track gain/pan/mute |
| Audio resolver | window boundaries, source range, stable order |
| Media catalog | dangling stream, duplicate id, rendition metadata, hash rules |
| Determinism | repeated compile, shuffled source arrays, canonical hash |

### 16.2 Playback core model tests

- play/pause/seek/load/dispose ở mọi state;
- play request bị pause/seek mới làm stale trong khi async prepare;
- seek A/B/C completion đảo thứ tự;
- switch audio -> monotonic -> audio clock không jump;
- timeline loop reset generation và buffer;
- end-of-timeline exact behavior;
- video not-ready không block audio clock;
- audio terminal error policy không deadlock preparing;
- stale resource luôn dispose.

### 16.3 Audio tests

- play ở 0 s, 20 s và gần end;
- seek forward/backward liên tục;
- pause/resume không repeat hoặc skip ngoài policy;
- mono, stereo, channel mapping;
- equal-power/linear fade golden samples;
- pan -1/0/1;
- overlapping clips/tracks;
- playbackRate 0.5x/1x/2x;
- clip boundary click-free theo envelope policy;
- underrun recovery/adaptive target;
- decoder completion cũ sau seek;
- bounded memory với 5–30 phút media;
- Worklet processor tests và real Chromium audio graph tests.

### 16.4 Video tests

- same asset, two instances, two media times;
- active clip boundary switch;
- paused seek while previous seek pending;
- rapid scrub final target;
- background/foreground tab;
- play promise reject;
- readyState/error recovery;
- rVFC cleanup;
- drift below/above threshold;
- renderer upload only on decoded revision/resource change;
- memory pressure/preload downgrade.

### 16.5 Preview/export parity

- per-frame video media time;
- embedded video audio vs detached equivalent;
- audio mix inputs/segments/envelopes;
- muted behavior;
- trim/playbackRate/fades;
- signed URL/rendition change không đổi semantic output;
- WebGL2/WebGPU visual parity.

### 16.6 Browser E2E/soak

- Chromium WebGL2 bắt buộc;
- WebGPU trên hardware/CI hỗ trợ;
- target Safari nếu product support yêu cầu;
- 1,000 scrub moves;
- 100 play/pause/seek cycles;
- 30–60 phút continuous audio/video;
- real video dài, không chỉ fixture 3 giây loop;
- heap snapshot before/after GC;
- AudioWorklet underrun/late schedule counters;
- active resource/worker/listener counts không tăng tuyến tính.

## 17. Performance và memory budgets

Initial budgets cần được đo lại theo target device; các số dưới đây là release
defaults, không phải protocol invariants.

| Metric | Target ban đầu |
| --- | ---: |
| Audio minimum prebuffer | 100 ms |
| Audio normal target | 300 ms |
| Audio adaptive maximum | 750 ms |
| Main-thread audio scheduling work | không theo render quantum |
| Audio underrun ổn định | 0 trong normal fixture |
| Audio PCM working set | bounded theo active inputs/device policy |
| Full-decode fallback | explicit <= size/duration limit |
| Continuous video hard seek | 0 khi drift trong tolerance |
| Scrub executed seek | <= 1/RAF + final flush |
| Stale frame/audio publication | 0 |
| Long task do engine command | không có task > 50 ms |
| Resource/listener/worker growth | không tăng tuyến tính qua soak |
| UI transport publish | throttled; transition/final seek immediate |

Diagnostics phải expose actual budgets và over-budget active bytes; không chỉ giữ
count của cache entries.

## 18. Migration map từ code hiện tại

| Current area | Action |
| --- | --- |
| `motion-protocol/src/v2` | Giữ; chỉ sửa nếu phát hiện semantic authoring thực sự thiếu |
| `motion-compiler/src/compiler` | Reuse validation/visual lowering; thêm V3 lowering rồi cut over |
| `motion-runtime/src/v2/evaluate.ts` | Reuse visual algorithms/types qua V3 boundary |
| `motion-runtime/src/v2/audio-mix.ts` | Port verified math sang V3 resolver; thay contract |
| `motion-runtime/src/v2/types.ts` audio fields | Replace bằng catalog/sourceRef + sample-based timeline |
| `playback-engine/src/playback-clock.ts` | Replace bằng ClockController/ClockSource |
| `playback-engine/src/playback-engine-v2.ts` | Replace bằng state-machine core |
| `playback-engine/src/web-audio-adapter-v2.ts` | Không port nguyên khối; split resource/decode/output/backend |
| `playback-engine/src/audio-worklet-mixer.ts` | Rewrite processor/protocol |
| `rolling-pcm-buffer.ts` | Reuse concepts/tests; adapt thành production PCM window |
| `audio-streaming.ts` | Reuse generation/range concepts; integrate decode coordinator |
| `video-media-session.ts` | Port lifecycle tests; rewrite instance/pending seek ownership |
| `media-frame-provider.ts` | Absorb vào HTMLVideo backend/resource bridge |
| `video-codecs-provider.ts` | Không nối hot path; giữ/xóa sau audit, RFC mới khi làm backend |
| editor playback controller | Replace bằng ControllerNext, giữ narrow React boundary |
| preview resource registry | Reuse lease/byte-budget ideas; align resource identity V3 |
| Remotion audio plan | Migrate sang AudioMixPlanV3 resolver |
| current docs claiming streaming implementation | Update status theo actual hot path |

## 19. Dependency rules và validation scripts

Thêm architecture checks để khóa các rule:

- Protocol không import compiler/runtime/playback/browser packages.
- Compiler chỉ import Protocol và pure shared utilities.
- Runtime V3 không import DOM/WebAudio/WebCodecs/React/storage clients.
- Playback core không import React hoặc authoring schema parsing.
- Audio/video backends có thể import platform APIs nhưng không mutate Runtime.
- Preview renderer không import PlaybackEngine concrete implementation.
- Editor UI chỉ dùng controller interfaces/snapshots.
- Export không import browser realtime backends.
- Không consumer nào ngoài compiler parse MotionProtocolV2 trong render core.

Scripts đề xuất:

```text
scripts/validate-v3-runtime-boundary.mjs
scripts/validate-playback-next-boundary.mjs
scripts/validate-media-backend-boundary.mjs
scripts/validate-no-legacy-playback-imports.mjs
```

## 20. Observability

Bounded diagnostics snapshot cần có:

```ts
type PlaybackDiagnosticsV3 = {
  state: PlaybackState;
  token: PlaybackOperationToken;
  clock: {
    kind: "audio" | "monotonic" | "manual";
    timelineTime: number;
    sourceTime: number;
    driftMs?: number;
  };
  audio: {
    backend: string;
    bufferedAheadMs: number;
    pcmBytes: number;
    encodedBytes: number;
    activeInputs: number;
    underruns: number;
    decodeLatencyMs: number;
  };
  video: {
    backend: string;
    activeInstances: number;
    waitingInstances: number;
    hardCorrections: number;
    suppressedOrReplacedSeeks: number;
    decodedFrameCallbacks: number;
  };
  resources: {
    activeLeases: number;
    idleLeases: number;
    cpuBytes: number;
    gpuBytesHint: number;
    overBudgetBytes: number;
  };
};
```

Không log per frame/quantum. Dùng bounded ring histories và pull snapshot từ debug
panel/test harness.

## 21. Rủi ro và cách giảm thiểu

### Runtime V3 lan sang quá nhiều consumer

Giảm thiểu: migrate semantic resolvers/offline parity trước realtime engine; reuse
visual V2 types; dùng compile entry point tạm có thời hạn.

### Audio derivative infra làm chậm engine

Giảm thiểu: phát triển song song sau khi media contract đã khóa; BufferSource
compatibility backend dùng fixtures/small assets cho bring-up, nhưng cutover audio
streaming không được tuyên bố complete nếu real upload path chưa có derivative.

### AudioWorklet khó debug/test

Giảm thiểu: pure mixer/reference implementation, processor protocol tests, offline
golden samples, fake worklet harness và real Chromium tests. Không chỉ test rằng
`postMessage` đã được gọi.

### Cross-origin isolation ảnh hưởng app integrations

Giảm thiểu: transferable buffers là baseline; SAB là optional optimization sau
security/integration audit.

### HTML video không đạt exact-frame behavior

Giảm thiểu: định nghĩa capability/diagnostic rõ; HTML backend là interactive
preview baseline, export vẫn exact theo offline backend. WebCodecs được thêm qua
backend interface khi metrics/features chứng minh cần thiết.

### Hai engines tồn tại quá lâu

Giảm thiểu: mỗi compatibility entry point/feature flag có deletion phase và repo
validation; không thêm feature mới chỉ vào legacy engine sau Phase 4.

## 22. Pull request sequence đề xuất

1. ADR + fixtures + baseline/reproduction tests.
2. RuntimeProjectV3/media catalog/audio-video timeline types.
3. V3 resolvers + deterministic/golden tests.
4. Compiler V2 -> Runtime V3 lowering.
5. Remotion/offline semantic parity adapter.
6. PlaybackEngineNext pure state/clock/token core.
7. HTMLVideo instance backend + renderer bridge.
8. Asset DB/probe/derivative resource contract.
9. MediaResourceProvider + authorized derivative access.
10. Audio decode worker + PCM windows.
11. AudioWorklet mixer + audio clock.
12. ControllerNext/editor feature flag + debug diagnostics.
13. E2E/soak/performance certification.
14. Default switch, legacy deletion, canonical renames and architecture locks.

Mỗi PR phải ghi:

- invariant được thêm/bảo vệ;
- ownership/dependency change;
- tests/gates;
- memory/resource cleanup;
- migration/deletion impact;
- docs status thay đổi.

## 23. Definition of Done

Rewrite chỉ hoàn tất khi đồng thời đạt tất cả điều kiện:

- MotionProtocolV2 JSON hiện tại vẫn compile/render được hoặc có explicit fixture
  migration cho bug thật; không thay schema chỉ để chiều backend.
- RuntimeProjectV3 là semantic source duy nhất cho preview và export.
- Embedded video audio và independent audio cùng dùng RuntimeAudioClipV3.
- Audio timeline dùng integer samples và logical sourceRef.
- Realtime audible playback dùng audio-backed master clock; silent playback dùng
  explicit monotonic fallback.
- Play/seek từ non-zero time hoạt động trên Worklet path.
- Audio dài không cần decode toàn file vào PCM.
- Video backend keyed theo instance; duplicate asset instances hoạt động.
- Latest seek wins xuyên video/audio/resource/GPU completion.
- HTMLVideo backend là default và không leak element/listener/rVFC.
- BufferSource fallback có explicit limits và diagnostics.
- WebCodecs/proxy backend có thể thêm qua interface hiện tại mà không sửa Runtime
  audio/video timeline semantics.
- React không sở hữu realtime clock/resources.
- Browser E2E, long-media soak, preview/export parity và architecture validation
  đều pass.
- Legacy playback engine, Runtime V2 audio contracts, temporary adapters và feature
  flags đã bị xóa.
- Architecture docs phản ánh đúng production hot path, không gọi future contract là
  implemented.

## 24. Các quyết định phải giữ cố định trong quá trình triển khai

1. Protocol V2 là authoring boundary; Runtime V3 là internal execution boundary.
2. Tách embedded audio ở compiler/runtime, không bắt authoring duy trì linked clips.
3. Runtime định nghĩa semantics; engine/backends định nghĩa execution.
4. Audio clock là master khi audible; monotonic/manual là explicit clock modes.
5. Video starvation không pause audio.
6. Native HTML video decode/buffering là default video backend.
7. PCM là bounded working set, không phải asset representation.
8. Logical stream identity độc lập locator/rendition, cho phép proxy/signed URL
   refresh mà không đổi timeline semantics.
9. Decoder/resource ownership theo instance và operation token.
10. Preview/export dùng cùng V3 resolvers.
11. WebCodecs là optional backend, không phải nền móng của Runtime.
12. Migration kết thúc bằng xóa legacy, không duy trì hai semantics.
