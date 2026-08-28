# Runtime V3 Canonical Cutover Plan

## 1. Mục tiêu

Giữ `MotionProtocolV2` làm authoring contract ổn định và chuyển toàn bộ pipeline phía sau sang một đường V3 duy nhất:

```text
MotionProtocolV2
        │
        ▼
Canonical Compiler
        │
        ▼
RuntimeProjectV3
├── visual
├── mediaCatalog
├── videoTimeline
└── audioTimeline
        │
        ├── resolveVideoAt(timeUs)
        └── resolveAudioWindow(sampleRange)
                 │
                 ▼
         PlaybackEngineNext
         ├── Clock / Transport
         ├── Readiness
         ├── Resource lifecycle
         └── Diagnostics
              │
       ┌──────┴──────┐
       ▼             ▼
 VideoBackend    AudioBackend
       │             │
       └──────┬──────┘
              ▼
       PreviewRenderer

Export sử dụng cùng `RuntimeProjectV3` và resolver semantics thông qua offline backend.
```

Kết quả cuối cùng phải bảo đảm:

- `MotionProtocolV2` chỉ mô tả authoring intent, không biết backend hoặc resource lifecycle.
- Compiler chỉ tạo `RuntimeProjectV3`; không có V2-to-V3 adapter trong production path.
- Runtime là pure, deterministic và backend-neutral.
- Preview và export dùng cùng video/audio resolver semantics.
- HTMLVideo, WebCodecs, StreamingWorklet, BufferSource và offline rendering chỉ là adapter có thể thay thế.
- Không còn duplicate timing, trim, gain, pan hoặc fade logic giữa các backend.

## 2. Nguyên tắc khóa kiến trúc

### 2.1 Giữ nguyên MotionProtocolV2

Protocol tiếp tục sở hữu:

- composition và layer graph;
- video timing, trim, frame policy và embedded audio intent;
- audio track/clip timing, trim, playback rate, gain, pan, mute và fade;
- stable asset identity.

Protocol không sở hữu:

- stream IDs sinh từ probe;
- codec configuration;
- signed URL hoặc expiry;
- PCM chunks và buffer policy;
- HTMLVideo, WebAudio, WebCodecs hoặc renderer resources;
- audio loop. Muốn lặp, authoring tạo thêm clip instance rõ ràng.

### 2.2 Một semantic owner cho mỗi trách nhiệm

| Trách nhiệm | Owner duy nhất |
|---|---|
| Authoring intent | `MotionProtocolV2` |
| Protocol lowering | `motion-compiler` |
| Stream/probe metadata | `motion-storage` và immutable catalog snapshot |
| Video/audio timeline semantics | `motion-runtime` |
| Clock, transport, seek generation, readiness | `playback-engine-next` |
| Decode và device/browser I/O | Video/Audio backend |
| GPU painting | `preview-renderer` |
| Offline output | Offline backend/export adapter |

## 3. Phạm vi ngoài kế hoạch

- Không thay `MotionProtocolV2` bằng MotionProtocolV3.
- Không viết lại các visual semantics đã được chứng nhận nếu có thể tách và reuse sạch.
- Không lấy WebCodecs video làm release gate cho cutover.
- Không thêm audio loop trở lại Runtime V3.
- Không xóa legacy trước khi editor, docs preview và export đều chạy V3.

---

## Bước 1 — Khóa audio correctness

### Mục tiêu

Làm cho audio timeline/resolver/mixer V3 đúng về sample và có một semantic reference trước khi nối realtime backend.

### Công việc

- [x] Xác nhận `loop` đã bị loại khỏi protocol schema, fixtures, capability ledger, compiler, Runtime V3 types và resolver.
- [x] Chuẩn hóa mapping từ composition sample rate 48 kHz sang source sample rate:

  ```text
  sourceDeltaSamples =
    compositionDeltaSamples
    × playbackRate
    × sourceSampleRate / 48000
  ```

- [x] Quy định rõ `durationSamples`, `sourceStartSample` và `sourceEndSample` luôn thuộc sample-rate domain nào.
- [x] Sửa fade để dùng clip-global progress hoặc absolute composition sample; không reset fade ở đầu mỗi resolved window.
- [x] Tạo một deterministic mixer dùng chung cho realtime và offline paths.
- [x] Bảo đảm mixer thống nhất gain, pan, mute, fade, overlap, playback rate và clipping policy.
- [x] Missing audio derivative phải tạo typed diagnostic/readiness state; không dùng original video URI và giả role `audio-proxy`.
- [x] `resolveAudioWindow()` không được silently bỏ source ref lỗi trong production validation path.

### Kiểm thử bắt buộc

- [x] Source 44.1 kHz và 48 kHz cho cùng timeline position.
- [x] Non-zero trim kết hợp playback rate.
- [x] Resolve nhiều window liên tiếp qua fade-in/fade-out boundary.
- [x] Hai clip overlap với track gain, clip gain, pan và mute.
- [x] Video embedded audio cộng background music.
- [x] Missing derivative và stale generation.
- [x] Offline mixer và realtime mixer cho cùng golden PCM samples.

### Exit criteria

- Không còn `loop` trong V3 audio contract.
- Golden tests chứng minh sample mapping và envelope không phụ thuộc window size.
- Offline evaluator trở thành reference implementation đáng tin cậy.

---

## Bước 2 — Hợp nhất compiler thành canonical V3 compiler

### Mục tiêu

`compileProtocol()` trực tiếp tạo `RuntimeProjectV3`, không đi qua `RuntimeProjectV2` cho audio hoặc video.

### Public API mục tiêu

```ts
type CompileContextV3 = {
  mediaCatalogSnapshot: RuntimeMediaCatalogSnapshotV3;
};

function compileProtocol(
  protocol: MotionProtocolV2,
  context: CompileContextV3,
): RuntimeProjectV3;
```

### Công việc

- [x] Tách compiler thành các pass rõ ràng:

  ```text
  parseProtocol()
  ├── compileVisual()
  ├── compileMediaCatalogReferences()
  ├── compileVideoTimeline()
  ├── compileAudioTimeline()
  └── validateRuntimeProjectV3()
  ```

- [x] Reuse visual lowering đã chứng nhận qua internal visual core, không qua public `RuntimeProjectV2` adapter.
- [x] Lower embedded video audio trực tiếp thành một audio track/clip V3 độc lập với native video playback.
- [x] Lower standalone audio và embedded audio bằng cùng audio compiler path.
- [x] Compiler chỉ liên kết protocol asset IDs với catalog streams; không tự đoán stream IDs, duration, sample rate hoặc proxy URI.
- [x] Compile diagnostics phải có code, authoring path và media/source identity.
- [x] Validate RuntimeProjectV3 trước khi trả kết quả.
- [ ] Đổi app/testing imports dần sang `compileProtocol()` canonical.
- [x] Đánh dấu adapter cũ deprecated trong migration window; không thêm consumer mới.

### Kiểm thử bắt buộc

- [ ] Golden RuntimeProjectV3 cho video trim.
- [ ] Hai instance dùng chung một video asset nhưng có source window khác nhau.
- [x] Embedded video audio và background music tạo hai independent audio inputs.
- [x] Compiler determinism và stable runtime hash.
- [x] Catalog thiếu video stream/audio derivative trả typed diagnostic đúng path.

### Exit criteria

- Production compiler entrypoint trả `RuntimeProjectV3`.
- Audio/video V3 không phụ thuộc `RuntimeProjectV2` types.
- Chỉ còn một implementation cho protocol lowering.

---

## Bước 3 — Làm sạch Runtime V3

### Mục tiêu

Runtime V3 là semantic source of truth duy nhất và không chứa duplicate V2 implementation.

### Công việc

- [ ] Tách visual algorithms đã chứng nhận thành một internal `visual-core` hoặc V3 visual module duy nhất.
- [ ] Không giữ hai bản gần giống nhau tại `src/v2` và `src/v3/visual`.
- [ ] Đổi public names sang V3 hoặc tên trung lập: `evaluateVisualFrame`, `RuntimeVisualProject`, `RuntimeFrameV3`.
- [ ] Không export `RuntimeProjectV2`, `RuntimeFrameV2`, `evaluateRuntimeProjectV2` từ runtime root.
- [ ] Hoàn thiện `validateRuntimeProjectV3()` cho:
  - finite/safe numeric ranges;
  - duplicate media/stream/instance/track/clip IDs;
  - source range bounds;
  - gain, pan, fades và playback rate;
  - resource role và stream-kind consistency;
  - video/audio references;
  - visual validation.
- [ ] Cho visual evaluation hoạt động độc lập với audio readiness khi phù hợp, để audio lỗi không tự động chặn một frame visual hợp lệ.
- [ ] Giữ runtime không import DOM, React, storage client, WebAudio hoặc WebCodecs.

### Kiểm thử bắt buộc

- [ ] Runtime validation matrix cho malformed projects.
- [ ] Deterministic video frame selection ở frame boundaries.
- [ ] Audio window boundaries và stable input order.
- [ ] Visual golden parity với semantics đã chứng nhận.
- [ ] Serialization/restore không làm thay đổi runtime identity.

### Exit criteria

- Một visual implementation duy nhất.
- Runtime root chỉ public V3/backend-neutral API.
- Resolver là nơi duy nhất sở hữu media timing semantics.

---

## Bước 4 — Hoàn thiện PlaybackEngineNext

### Mục tiêu

PlaybackEngineNext trở thành transport/resource orchestrator production-ready, không tự tính lại timeline semantics.

### Công việc core

- [ ] Production default dùng monotonic clock cho video-only; fake clock chỉ dùng trong test.
- [ ] Dùng audio rendered-sample clock khi streaming audio backend active.
- [ ] Nối `TransportStateMachine` vào engine thay vì mutate state rời rạc.
- [ ] Implement load/readiness barrier thật cho resource resolve, decode và minimum buffer.
- [ ] Nối operation epoch/token vào mọi async completion.
- [ ] Implement scheduler, pause, seek, flush và dispose lifecycle nhất quán.
- [ ] Nối adaptive buffer policy và cập nhật underrun/error metrics thật.
- [ ] Engine chỉ gọi `resolveVideoAt()` và `resolveAudioWindow()`; không copy timing math.

### Công việc VideoBackend

- [ ] HTMLVideo pool theo `instanceId`, không theo `assetId`.
- [ ] Resolve source qua MediaResourceProvider.
- [ ] Không set `currentTime` ở mọi tick; chỉ seek khi operation đổi hoặc drift vượt tolerance.
- [ ] Pause/release instance không còn active/lookahead.
- [ ] Publish renderable frame resource và revision cho PreviewRenderer.
- [ ] Giữ contract đủ trung lập để thêm WebCodecs/video proxy backend sau này.

### Công việc AudioBackend

- [ ] Implement DecodeCoordinator và concrete decode backend.
- [ ] Implement bounded, generation-aware PCM window store.
- [ ] Implement StreamingWorklet protocol/processor.
- [ ] Implement BufferSource fallback với giới hạn rõ ràng.
- [ ] Cả hai backend dùng chung deterministic mixer semantics.
- [ ] Expose rendered sample counter và underrun telemetry.

### Exit criteria

- Play/pause/seek tiến thời gian thật mà không cần caller advance fake clock.
- Rapid seeks không phát frame hoặc audio từ generation cũ.
- HTMLVideo và audio backend có lifecycle/resource bounds được test.
- Thay backend không yêu cầu sửa RuntimeProjectV3 hoặc resolver.

---

## Bước 5 — Migrate Preview và editor

### Mục tiêu

Editor và docs preview trở thành consumer thật của compiler/runtime/playback V3.

### Kiến trúc controller mục tiêu

```ts
createPlaybackControllerNext({
  compiler,
  engine,
  videoBackend,
  audioBackend,
  renderer,
  resourceProvider,
});
```

### Công việc

- [ ] Nối `PlaybackControllerNext` vào editor provider bằng migration feature flag.
- [ ] Load document qua canonical `compileProtocol()`.
- [ ] Stage nhận V3 visual frame/paint buffer trực tiếp.
- [ ] PreviewRenderer nhận video resources theo `instanceId` và revision.
- [ ] Migrate scrub coordinator, resume-after-scrub và hidden-layer policy.
- [ ] UI snapshot được throttle/coalesce; không render React theo audio tick.
- [ ] Nâng debug panel với clock kind, readiness, buffer ahead, underruns, operation generation và active instances/inputs.
- [ ] Migrate docs cases sang V3 thực:
  - `audio.mix.two-tracks`;
  - `audio.mix.video-plus-music`;
  - video multi-instance;
  - non-zero video/audio trim.
- [ ] Native video element luôn muted; embedded audio chỉ đi qua AudioBackend.
- [ ] Thêm shadow comparison trong dev/test nhưng chỉ một audible playback path.

### Browser tests bắt buộc

- [ ] Video frame xuất hiện sau load và non-zero seek.
- [ ] Hai video instances cùng asset hiển thị source times khác nhau.
- [ ] Audio mix hai tracks nghe được và active input count đúng.
- [ ] Video embedded audio cộng music, không double-audio.
- [ ] Seek liên tục không phát stale frame/audio.
- [ ] Pause/resume giữ A/V drift trong tolerance.
- [ ] Resource counts trở về baseline sau document switch/dispose.

### Exit criteria

- Editor và `/docs/preview` mặc định chạy PlaybackEngineNext.
- Không còn `compileProtocolV2()` hoặc `createPlaybackEngineV2()` trong app preview/editor hot path.
- Hai audio mix cases chứng minh pipeline V3, không chỉ UI fixture.

---

## Bước 6 — Migrate export sang RuntimeProjectV3

### Mục tiêu

Preview và export dùng cùng compiled project và resolver semantics; chỉ backend execution khác nhau.

### Công việc

- [ ] Render manifest mang `RuntimeProjectV3` hoặc canonical serialized V3 artifact.
- [ ] Remotion/offline renderer dùng `evaluateVisualFrame()` và `resolveVideoAt()`.
- [ ] Offline audio backend dùng `resolveAudioWindow()` cùng deterministic mixer.
- [ ] Export không đọc authoring JSON để tự tính lại trim, fade, pan hoặc playback rate.
- [ ] Resource policy cho export chọn original/proxy rõ ràng mà không thay runtime semantics.
- [ ] Signed URL refresh nằm ngoài semantic identity/runtime hash.
- [ ] Thiết lập preview/export golden parity cho frame selection và PCM output.

### Kiểm thử bắt buộc

- [ ] Video trim và multi-instance parity.
- [ ] Audio trim/playback-rate/fade/pan/overlap parity.
- [ ] Embedded video audio cộng music parity.
- [ ] 44.1 kHz source parity.
- [ ] Missing derivative thất bại có typed diagnostic thay vì silent fallback.
- [ ] Deterministic repeated export.

### Exit criteria

- Remotion/export không còn nhận `RuntimeProjectV2`.
- Preview và export gọi cùng Runtime V3 resolver functions.
- Không có audio timing/mix implementation riêng trong export package.

---

## Bước 7 — Certification, cutover và xóa legacy

### Mục tiêu

Đưa V3 thành đường duy nhất sau khi đã có bằng chứng correctness, parity và resource stability.

### Certification gates

- [ ] Protocol, compiler, runtime, playback, preview và export typecheck pass.
- [ ] Unit/integration/browser tests pass.
- [ ] Preview/export golden parity pass.
- [ ] Real-media tests pass với standalone audio, silent video và video có audio derivative.
- [ ] 30–60 phút soak test không tăng vô hạn heap, PCM, HTMLVideo instances hoặc GPU resources.
- [ ] Rapid seek/document switch không phát stale operations.
- [ ] Audio underrun và A/V drift nằm trong budgets đã chốt.
- [ ] Architecture certification xác định đúng mọi legacy consumer, kể cả compatibility re-export.

### Cutover

- [ ] Bật PlaybackEngineNext mặc định.
- [ ] Giữ feature flag rollback trong một stabilization window ngắn ở môi trường dev.
- [ ] Theo dõi diagnostics/metrics trước khi xóa fallback.
- [ ] Xóa feature flag khi không còn consumer legacy.

### Xóa legacy

- [ ] Xóa package PlaybackEngineV2 cũ.
- [ ] Xóa compatibility barrel/re-export.
- [ ] Xóa compiler V2 runtime-output path và V2-to-V3 adapter.
- [ ] Xóa RuntimeProjectV2/audio mix contracts và duplicated `src/v2` implementation.
- [ ] Chuẩn hóa imports chỉ từ canonical package roots.
- [ ] Xóa validators/scripts/docs chỉ còn nói về runtime/playback V2.
- [ ] Cập nhật architecture guide để phản ánh production hot path thực tế.

### Exit criteria

- Repository chỉ có một production pipeline từ MotionProtocolV2 đến RuntimeProjectV3.
- Không còn app/export imports của RuntimeProjectV2 hoặc PlaybackEngineV2.
- WebCodecs, proxy media và backend mới có thể được thêm qua adapter contracts mà không rewrite Runtime.

---

## 4. Definition of Done tổng thể

Kế hoạch hoàn thành khi tất cả điều sau cùng đúng:

- `MotionProtocolV2` là authoring source of truth duy nhất.
- `compileProtocol()` tạo `RuntimeProjectV3` trực tiếp.
- `RuntimeProjectV3` chứa visual, immutable media catalog references, video timeline và audio timeline.
- Runtime V3 là pure và deterministic.
- PlaybackEngineNext là transport/resource orchestrator duy nhất.
- Preview editor và docs preview chạy V3 mặc định.
- Export dùng cùng Runtime V3 semantics.
- Audio 44.1/48 kHz, trim, playback rate, fade, pan, overlap và embedded video audio có golden parity.
- Video multi-instance, seek và resource lifecycle được browser/soak test.
- Legacy V2 runtime/playback/compiler output đã được xóa.
- HTMLVideo, WebCodecs, streaming audio, proxy media và offline rendering chỉ là replaceable backends.

## 5. Thứ tự commit khuyến nghị

Mỗi bước nên được chia thành commit nhỏ có thể review độc lập:

1. `fix(runtime-audio): lock sample domains and window-global envelopes`
2. `refactor(compiler): make RuntimeProjectV3 the canonical output`
3. `refactor(runtime): consolidate certified visual semantics under V3`
4. `feat(playback-next): wire production clocks readiness and media backends`
5. `feat(preview): migrate editor and docs preview to Runtime V3`
6. `feat(export): consume Runtime V3 through offline backends`
7. `refactor(cutover): remove V2 runtime and playback compatibility paths`

Không gộp việc xóa legacy vào các commit triển khai ban đầu; chỉ xóa sau khi certification gates đã pass.
