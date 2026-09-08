# Kế hoạch cô lập Playback

## Mục tiêu

Đưa `@motionvideo/playback-engine` về đúng một vai trò:

> Là transport runtime duy nhất của ứng dụng: sở hữu clock/current time,
> điều khiển play/pause/seek/rate, lập lịch tick, đồng bộ audio/video và phát
> runtime playback plans/snapshots cho host.

Luồng `docs/skia` vẫn giữ nguyên và không đi qua playback:

```text
Protocol V2 → Compiler → Runtime → Skia
```

Đây là luồng debug/render deterministic, không phải editor playback.

## Tiến độ

- [x] Phase 0 — khóa boundary, document ownership và architecture checks.
- [x] Phase 1 — bỏ editor facade khỏi `playback-engine`; web giữ một adapter duy nhất.
- [x] Phase 2 — đưa `durationUs` và end transition vào runtime/playback engine.
- [x] Phase 3 — xóa phép tính runtime duration khỏi web playback adapter; Stage chỉ
  nhận snapshot/frame, còn duration phục vụ timeline authoring vẫn thuộc editor-core.
- [x] Phase 4 — bổ sung fixture-driven tests cho Runtime V3 plans/frame/end transition.
- [x] Phase 5 — bổ sung browser integration cho editor transport, WebAudio và docs/skia video path.

## Boundary mục tiêu

```text
editor-core
  Protocol V2 commands
  timeline model/projection
  selection
  seek geometry và interaction thuần

motion-compiler
  Protocol V2 → RuntimeProjectV3

motion-runtime
  evaluate RuntimeFrameV3
  resolve video/audio plans
  runtime duration và validation

playback-engine
  clock/currentTime
  transport state
  play/pause/seek/rate/tick/end
  audio/video plan scheduling
  backend lifecycle, readiness, buffering, diagnostics

apps/web/lib/editor/playback
  web adapter Protocol V2 → Runtime V3
  nối playback với Skia, HTMLVideoElement, WebAudio và React
  UI transport mirror/scrub orchestration

preview-renderer / skia-renderer
  paint RuntimeFrameV3
```

## Phân loại trách nhiệm hiện tại

### Giữ trong `packages/playback-engine`

- `PlaybackEngine` và transport state machine.
- `TransportClockV3`, monotonic/audio/sample clocks.
- Scheduler cho playback tick.
- Operation token/generation để loại bỏ async operation stale.
- Readiness, buffering và lifecycle backend.
- Video/audio plan sinks.
- HTML video, WebAudio, buffer/worklet backend.
- Resource lease, media resource provider và playback diagnostics.
- End-of-composition handling.

Playback không được biết về:

- `MotionProtocolV2` authoring document.
- timeline lane/clip UI.
- selection, history, undo/redo.
- React, Zustand, Next.js.
- Skia/WebGPU paint implementation.

### Giữ trong `packages/editor-core`

- `EditorCommand` và document reducer.
- Protocol V2 validation tại boundary authoring.
- Timeline projection: lane, clip, duration hiển thị.
- Timeline policies: snap, placement, zoom, ruler.
- Pure seek geometry: client position → timeline seconds.
- Clip move/trim, marquee và stage interaction.

`editor-core` chỉ tạo seek intent hoặc đọc current time được host truyền vào.
Nó không được chạy clock và không được import `playback-engine`.

### Đưa về `packages/motion-runtime`

- Runtime duration canonical trong `RuntimeProjectV3`, thống nhất theo `durationUs`.
- Quy tắc xác định duration từ visual nodes, video instances và audio clips.
- `evaluateRuntimeProjectV3()`.
- `resolveVideoAt()` và `resolveAudioWindow()`.
- Runtime validation và các semantic timing rules.

Playback chỉ gọi các API runtime này; không tự tái hiện logic timing của
runtime.

### Đưa về `apps/web/lib/editor/playback`

- Compile document hiện tại thành `RuntimeProjectV3`.
- Web `PlaybackController` dành cho editor.
- Bind video resources vào `HTMLVideoElement`.
- Gọi `evaluateRuntimeProjectV3()` cho frame mà Skia sẽ paint.
- Bind audio plan vào WebAudio.
- React-facing transport snapshot mirror.
- DOM pointer scrub, edge-scroll và pause/resume UX.
- Chỉ đọc `durationUs`, `timeUs`, `state` và `ended` từ playback snapshot.
- Không tự tính duration, không tự clamp theo runtime graph, không tự phát hiện end.

Đây là web integration layer, không đưa các phần này vào `editor-core`.

### Giữ ngoài playback

- `docs/preview` và `docs/skia`: giữ direct runtime → renderer.
- `packages/skia-renderer`: paint command replay và Skia resource handling.
- `packages/preview-renderer`: WebGPU/WebGL preview backend.
- `export-renderer`: offline/export rendering.

## Các vấn đề cần xử lý

### 1. Editor facade bị trộn vào playback package

Trước Phase 1, `packages/playback-engine/src/editor/` chứa:

- `playback-controller-v3.ts`;
- `scrub-coordinator.ts`;
- `transport-store.ts`.

Trong khi web app đã có facade tương tự ở
`apps/web/lib/editor/playback/` và hiện đang gọi core engine trực tiếp.

Kế hoạch:

- Di chuyển controller editor về `apps/web/lib/editor/playback`.
- Gộp transport scrub DOM của web vào cùng adapter.
- Xóa export `./editor` khỏi public root của playback-engine sau migration.
- Nếu desktop sau này cần cùng facade, tạo package riêng như
  `@motionvideo/playback-editor-adapter`; không đưa vào `editor-core`.

Sau Phase 1, các file này đã được loại khỏi package core. Implementation editor
duy nhất hiện nằm trong `apps/web/lib/editor/playback`.

### 2. Current time đang có nhiều bản mirror

Canonical source phải là `PlaybackEngine` clock.

Các biến/store khác chỉ được coi là cache:

- `currentTimeRef` trong `EditorProviders`;
- web `transport-store`;
- timeline playhead state;
- frame/time event của Stage.

Kế hoạch:

- Đổi tên/comment các mirror thành `lastPlaybackSnapshot` hoặc
  `transportSnapshot` nếu cần.
- Không cho mirror tự advance bằng RAF.
- Mọi playhead UI update phải bắt nguồn từ engine snapshot.
- Mọi seek UI chỉ gọi `playbackController.seek(time)`.

### 3. Duration và ended chưa thuộc engine đầy đủ

`PlaybackEngineState` đã có `ended`, nhưng engine chưa có end transition hoàn
chỉnh. Web adapter hiện tự tính duration.

Kế hoạch:

- Thêm runtime duration helper trong `motion-runtime`.
- Đưa `durationUs` canonical vào `RuntimeProjectV3` và để playback engine đọc
  trực tiếp từ runtime khi `load`.
- Khi clock chạm duration:
  - publish frame cuối hợp lệ;
  - pause audio/video backend;
  - chuyển state sang `ended`;
  - hủy tick tiếp theo.
- `play()` từ `ended` phải có policy rõ ràng: về đầu hoặc tiếp tục từ cuối.
- Thêm test cho `playing → ended`, seek từ ended và replay.

### 4. Scrub bị chia thành nhiều tầng

Các tầng hiện tại có scrub coordinator riêng cho pointer/DOM và transport.
Đây không phải duplicate hoàn toàn, nhưng tên gọi dễ gây nhầm.

Kế hoạch:

- `editor-core`: chỉ giữ pure seek math và interaction intent.
- Web app: giữ pointer scrub, edge-scroll và batching pointer event.
- Playback: chỉ nhận các lệnh `pause`, `seek`, `play`.
- Đổi tên thành `timeline-pointer-scrub` và `transport-scrub-session` nếu cần.

## Trình tự thực hiện

### Phase 0 — Khóa contract

- Viết test architecture không cho `editor-core` import playback.
- Ghi rõ `PlaybackEngine` là sole authority của current time.
- Liệt kê public API cần giữ lại sau khi bỏ editor facade.
- Không thay đổi docs/skia debug path.

Hoàn thành khi boundary được mô tả trong README và có test kiểm tra dependency.

### Phase 1 — Tách editor facade

- Port các test cần thiết từ `packages/playback-engine/src/editor` sang web
  adapter.
- Chuyển controller editor và DOM scrub về `apps/web/lib/editor/playback`.
- Xóa transport store duplicate trong playback package nếu không còn consumer.
- Chỉ giữ core transport/media exports trong playback package.

Hoàn thành khi web editor chỉ dùng một editor playback adapter.

### Phase 2 — Chuẩn hóa duration/end

- Implement runtime duration helper.
- Đưa duration vào engine lifecycle.
- Implement `ended` transition và replay policy.
- Bổ sung fake-clock tests.

Hoàn thành khi engine tự quyết định trạng thái cuối, không cần web adapter tự
pause bằng logic riêng.

### Phase 3 — Chuẩn hóa web adapter

- Adapter compile Protocol V2 → Runtime V3.
- Adapter chỉ truyền `RuntimeProjectV3`; không tự truyền hoặc tự tính duration.
- Adapter chỉ bind sinks/backend và chuyển snapshot cho UI.
- Stage nhận frame từ playback rồi paint bằng Skia.
- Timeline nhận snapshot và gửi seek intent.

Hoàn thành khi không còn component timeline nào tự chạy playback clock.

### Phase 4 — Bổ sung fixture-driven playback tests

Tạo test matrix dùng cùng semantic fixture với docs nhưng không làm docs/skia
phụ thuộc playback:

- animation/timing stagger;
- video frame seek;
- video trim và frame policy;
- multi-video instance;
- linked video audio;
- video + independent music;
- mute, gain, pan, fade;
- playback rate;
- text/shape visual frame qua web adapter.

Test nên kiểm tra:

- current time và generation;
- video plan instance/media time;
- audio plan inputs/segments/gain/pan/mute;
- emitted RuntimeFrameV3;
- pause/seek/resume và end-of-composition.

### Phase 5 — Browser integration

- Một E2E editor test cho play/pause/seek bằng playback thật.
- Một E2E video test kiểm tra drift và media registration.
- Một E2E audio test kiểm tra WebAudio path, không dùng native audition.
- Giữ các E2E docs/skia hiện tại như render/debug tests độc lập.

## Acceptance criteria

- `playback-engine` không import `editor-core`, Protocol V2 hoặc React.
- `editor-core` không import playback và không chứa playback clock.
- Chỉ một implementation của editor playback controller trong web app.
- Chỉ playback engine sở hữu transport current time.
- Runtime/PlaybackEngine là nguồn duy nhất của canonical duration; web chỉ mirror snapshot.
- `ended` là trạng thái có thể đạt được và có test.
- Web Stage dùng playback để nhận frame nhưng Skia để render.
- Docs/skia vẫn chạy direct `Protocol → Compiler → Runtime → Skia`.
- Có fixture-driven tests cho runtime → playback plans.
- Không có timeline UI nào tự sở hữu hoặc tự advance playhead.

## Không nằm trong scope

- Đưa docs/skia qua playback.
- Thay thế Skia bằng playback engine.
- Đưa React/Zustand vào playback package.
- Đưa timeline authoring vào playback package.
- Thiết kế lại Protocol V2.
- Tạo thêm renderer mới.

## Bổ sung bắt buộc: runtime sở hữu duration và ended

Phần này là quyết định cụ thể cho mục Duration/ended ở trên và thay thế mọi
cách triển khai trong đó web adapter tự suy ra duration.

### Contract đích

`RuntimeProjectV3` phải có một duration canonical ở cấp composition/runtime,
khuyến nghị là `durationUs`. Giá trị này phải bao phủ toàn bộ timeline:

- visual node cuối cùng;
- video instance cuối cùng;
- audio clip cuối cùng.

Compiler chịu trách nhiệm tạo giá trị này. `motion-runtime` chịu trách nhiệm
validate và dùng nó khi resolve/evaluate. `playback-engine` không tự tính lại
duration từ nodes hoặc clips.

`PlaybackEngineSnapshot` phải expose `durationUs`. Web transport store chỉ
mirror field này để hiển thị timeline.

### End transition

Khi transport đang `playing` và clock chạm `durationUs`, engine phải:

1. clamp time về boundary hợp lệ và publish frame cuối;
2. pause clock và audio/video backends;
3. chuyển `playing` thành `ended`;
4. hủy tick/scheduler tiếp theo;
5. notify một snapshot cuối có `state: "ended"`.

`play()` từ `ended` sẽ seek về `0` rồi bắt đầu lại. `seek()` vẫn là quyền của
engine và có thể chuyển từ `ended` về `paused` tại vị trí mới.

### Web/Skia boundary

`apps/web/lib/editor/playback` chỉ làm adapter:

```text
Protocol V2 → compiler → RuntimeProjectV3 → PlaybackEngine snapshot/frame → Skia
```

Xóa các phép tính tương đương với `Math.max(visual, nodes, audioClips)` khỏi
web adapter. Stage không quyết định duration hoặc end; Stage chỉ paint
`RuntimeFrameV3` nhận từ playback. Luồng `docs/skia` direct vẫn giữ nguyên vì
đó là debug/render path độc lập.

### Test bắt buộc

- compiler tạo duration đúng khi audio dài hơn visual;
- engine expose duration sau `load`;
- fake clock kiểm tra `playing → ended` đúng một lần;
- frame cuối được publish trước khi ended;
- backend được pause và scheduler bị hủy;
- `play()` từ ended restart từ 0;
- `seek()` từ ended hoạt động;
- web adapter không còn tự tính duration;
- docs/skia tiếp tục chạy không cần import playback.
