# Lộ trình review Performance và Memory

Tài liệu này dùng để tự review code như một senior engineer, tập trung vào
editor playback, stage preview, timeline, GPU texture, video/audio resource và
ranh giới giữa React với các hệ thống realtime.

Mục tiêu không phải là thêm `useMemo` ở mọi nơi. Mục tiêu là chứng minh:

- mỗi loại state có đúng owner;
- frame realtime không đi qua React khi không cần thiết;
- GPU/media resource được reuse và giải phóng có kiểm soát;
- sidebar, inspector và timeline tree không render theo từng frame;
- play/pause/seek có hành vi đúng và có test bảo vệ;
- mọi kết luận performance đều dựa trên số đo, không dựa trên cảm giác.

---

## 1. Nguyên tắc review cấp senior

### 1.1 Review theo data flow, không theo file order

Luôn trace một sự kiện từ input đến side effect cuối cùng:

```text
Click Play
  → Transport action
  → PlaybackController.play()
  → PlaybackEngine RAF
  → RuntimeFrameV2
  → Frame sink
  → PreviewStage.paintFrame()
  → PreviewRenderer.paint()
  → Video/audio synchronization
```

Với paused seek:

```text
Seek slider
  → Controller.seek(time)
  → Video.currentTime
  → requestVideoFrameCallback/timeupdate
  → frameVersion++
  → Một lần repaint target frame
```

Với cleanup:

```text
Document đổi hoặc component unmount
  → unregister frame/time sink
  → cancel RAF/rVFC/timer
  → pause media
  → release resource lease
  → dispose renderer/GPU
  → dispose audio adapter/cache
```

### 1.2 Phân biệt bốn loại state

| Loại state | Ví dụ | Nơi nên đặt | Không nên đặt |
|---|---|---|---|
| Authoring state | document, selection, hidden layers, undo | EditorStore | playback snapshot |
| Transport UI state | play/pause, throttled playhead, duration | TransportStore | RuntimeFrameV2 |
| Realtime imperative state | frame, video element, AudioBuffer, GPU handle | Controller/ref/renderer | React Context/Zustand |
| Resource lifecycle state | ref-count, cache entry, loading promise | Registry/cache owner | component local ad-hoc map |

Nếu một frame 30/60 fps làm thay đổi Context value, cần dừng lại và kiểm tra
boundary trước khi tối ưu bằng memoization.

### 1.3 Mọi tối ưu phải có hypothesis và measurement

Trước khi sửa, ghi rõ:

```text
Hypothesis: Sidebar render lại theo mỗi playback tick.
Measurement: React render counter + profiler trong 5 giây playback.
Budget: Sidebar playback-induced renders = 0.
Result: trước 150 renders, sau 0 renders.
```

Nếu không thể đo, đánh dấu đó là giả thuyết, không gọi là nguyên nhân đã xác
nhận.

---

## 2. Thứ tự review đề xuất

Review theo thứ tự dưới đây để đi từ nguyên nhân realtime đến biểu hiện UI.

### Phase A — Xác định ownership và architecture

Đọc trước:

- `docs/plans/editor-playback-react-boundary-refactor-plan.md`
- `apps/web/components/editor/EditorProviders.tsx`
- `apps/web/hooks/editor/use-editor-store.ts`
- `apps/web/hooks/editor/use-transport-store.ts`
- `apps/web/hooks/editor/use-playback-controller.ts`

Câu hỏi:

- Editor instance có store/controller riêng hay dùng singleton?
- Document revision có phải dependency duy nhất để compile lại không?
- Playback frame có đi qua React Context không?
- Context value có bị tạo lại khi playhead đổi không?
- Action callback có stable identity không?
- Component nào được phép đọc transport realtime?

Output cần có:

- sơ đồ ownership;
- danh sách Context và từng field mà Context expose;
- danh sách component subscribe vào mỗi store/context;
- các boundary được xem là hot path.

### Phase B — Review playback engine

Thư mục:

- `packages/playback-engine/src/`
- `apps/web/lib/editor/playback/playback-controller.ts`

Các file ưu tiên:

- `playback-engine-v2.ts`
- `web-audio-adapter-v2.ts`
- `dom-media-controller-v2.ts`
- `frame-buffer.ts`
- `playback-controller.ts`
- `transport-store.ts`

Kiểm tra:

- composition clock có duy nhất và rõ ràng không;
- `play`, `pause`, `seek`, `toggle` có idempotent không;
- race giữa `audio.resume()`, `pause()`, `seek()` và `dispose()`;
- mỗi engine tick có đúng một frame evaluation không;
- frame sink có bị gọi duplicate không;
- `currentTime` có throttle khi playing và publish exact khi pause/seek/end không;
- generation/token có invalidate async operation cũ không;
- RAF, timeout, event listener có cleanup đầy đủ không;
- hidden layer filter có thể tạo frame invalid không;
- media sync có seek video liên tục trong lúc playback không.

### Phase C — Review stage và React boundary

Thư mục:

- `apps/web/components/docs/PreviewStage.tsx`
- `apps/web/components/editor/stage/`
- `apps/web/components/editor/timeline/`
- `apps/web/components/editor/sidebar/`
- `apps/web/components/editor/inspector/`

Kiểm tra `PreviewStage`:

- renderer được tạo bao nhiêu lần trong lifecycle;
- frame sink đăng ký sau resource/renderer readiness chưa;
- frame sink có gọi trực tiếp `paintFrame` không;
- React effect có vô tình repaint theo mọi dependency không;
- paused seek có repaint khi decoded frame sẵn sàng không;
- `requestVideoFrameCallback` có cancel đúng không;
- `isPlaying` có dừng rVFC wake-up loop không;
- `preserveDrawingBuffer` có chỉ bật cho test/capture không;
- canvas, video, renderer và resources có bị detached sau unmount không.

Kiểm tra timeline/UI:

- clip/lane tree có nhận `currentTime` realtime không;
- playhead có cập nhật qua imperative DOM sink không;
- follow-scroll có bị chạy theo từng pixel/frame không;
- sidebar/inspector có subscribe nhầm transport state không;
- `React.memo` có bị phá bởi object/array/function prop mới mỗi render không;
- selector có trả về object mới dù dữ liệu không đổi không.

### Phase D — Review renderer và GPU memory

Thư mục:

- `packages/preview-renderer/src/renderer.ts`
- `packages/preview-renderer/src/webgl2/`
- `packages/preview-renderer/src/webgpu/`
- `packages/preview-renderer/src/shared/`

Kiểm tra:

- video texture chỉ upload khi `frameVersion` đổi;
- texture được update in-place khi kích thước không đổi;
- texture cũ bị delete khi kích thước/asset đổi;
- effect framebuffer/temporary texture có reuse và bounded không;
- resize có dispose target cũ không;
- `dispose()` destroy toàn bộ texture, buffer, framebuffer, pipeline, atlas;
- WebGL2 và WebGPU có cùng upload/version semantics không;
- `textureUploads`, `videoTextureUploads`, `drawCalls`, `frameTimeMs` có chính xác không;
- có bật `preserveDrawingBuffer` ngoài capture/test không.

Các counter nên theo dõi:

```text
textureUploads
videoTextureUploads
drawCalls
frameTimeMs
paintIntervalMs
estimatedDroppedFrames
```

### Phase E — Review media/resource lifecycle

Thư mục:

- `apps/web/lib/editor/playback/preview-resource-registry.ts`
- `apps/web/lib/editor/playback/video-frame-version.ts`
- `packages/playback-engine/src/web-audio-adapter-v2.ts`

Kiểm tra:

- cùng asset revision có dedupe loading promise không;
- registry có ref-count chính xác không;
- release cuối cùng có chuyển entry thành idle không;
- LRU eviction có giữ active entry không;
- cache có `maxEntries`/`maxCachedBuffers` rõ ràng không;
- concurrent load có tạo duplicate video/image/font không;
- video element có bị giữ sau release không;
- rVFC callback có bị giữ sau dispose không;
- AudioBuffer cache có bounded và có eviction không;
- active audio source có giảm về baseline sau pause/dispose không.

### Phase F — Review RuntimeFrame contract

Thư mục:

- `packages/motion-runtime/src/v2/evaluate.ts`
- `packages/motion-runtime/src/v2/validate.ts`
- `packages/motion-runtime/src/paint/validate-paint-command-buffer.ts`
- `packages/motion-compiler/src/compile-v2/`

Kiểm tra các invariant:

- mỗi `draw*` có `setTransform` tương ứng;
- không có orphan `setTransform`;
- group/layer begin/end cân bằng;
- `beginFrame` và `endFrame` đúng vị trí;
- hidden-layer filtering không làm hỏng command stream;
- text chưa có glyph layout không phát transform/draw dở dang;
- video `mediaTime` hợp lệ và không seek liên tục ngoài chủ ý;
- frame cuối timeline vẫn có policy rõ ràng.

Boundary validation nên fail-closed ở renderer, nhưng upstream phải tạo frame
hợp lệ. Không dùng `try/catch` để nuốt lỗi validation rồi tiếp tục paint frame
hỏng.

---

## 3. Cách tổ chức folder và trách nhiệm code

### 3.1 Packages

```text
packages/
  motion-runtime/       # Runtime IR, frame evaluation, validation
  motion-compiler/      # Protocol → RuntimeProjectV2
  playback-engine/      # Clock, audio, DOM media synchronization
  preview-renderer/      # WebGL2/WebGPU paint và GPU resource
  editor-core/           # Authoring commands, timeline geometry
  motion-protocol/       # Document schema và protocol contract
```

Quy tắc:

- `motion-runtime` không biết React hoặc DOM.
- `playback-engine` không biết React component.
- `preview-renderer` không giữ authoring store.
- `editor-core` không tạo GPU/media resource.
- schema/protocol không chứa runtime handle.

### 3.2 Web app

```text
apps/web/
  components/editor/     # UI và composition root
  components/docs/        # Standalone preview/capture adapter
  hooks/editor/           # Narrow React hooks/context boundary
  lib/editor/state/       # Authoring store
  lib/editor/playback/    # Controller, transport, registry, media bridge
```

Một module mới nên trả lời được ba câu hỏi trong phần đầu file:

1. Nó sở hữu state nào?
2. Nó chạy theo document revision hay theo realtime frame?
3. Nó cleanup resource bằng API nào?

Nếu một file vừa render UI, vừa điều khiển audio, vừa giữ GPU resource, đó là
dấu hiệu cần tách boundary.

### 3.3 Quy tắc `useMemo`, `useCallback`, `React.memo`

Dùng `useMemo` cho:

- Context value có nhiều action ổn định;
- derived projection nặng theo document revision;
- object cần referential stability để tránh child render.

Dùng `useCallback` cho:

- action truyền xuống component memoized;
- subscribe/unsubscribe function;
- callback được dùng trong effect lifecycle.

Không dùng `useMemo` để:

- che giấu selector quá rộng;
- giữ `HTMLVideoElement`, `AudioBuffer`, GPU handle;
- cache vô thời hạn một object lớn;
- tránh sửa dependency sai của effect;
- làm code phức tạp hơn nhưng không có measurement.

---

## 4. Test matrix cần có

### 4.1 Unit test — engine/controller

- play từ time 0;
- pause ngay sau play;
- seek khi paused;
- seek khi playing;
- pause chính xác current time;
- final time khi tới timeline end;
- play/pause/seek lặp lại 30–100 lần;
- async audio resume bị pause/dispose hủy đúng;
- frame sink nhận đúng một event cho mỗi frame;
- đăng ký/unregister sink không duplicate;
- hidden parent/child filtering;
- controller load document mới khi đang playing;
- controller dispose idempotent.

### 4.2 Unit test — runtime/renderer

- frame shape hợp lệ qua validator;
- orphan transform bị reject;
- unprepared text không phát orphan transform;
- begin/end group/layer cân bằng;
- unchanged `frameVersion` không upload lại texture;
- changed `frameVersion` upload đúng một lần;
- WebGL2/WebGPU có cùng upload policy;
- texture resize dispose texture cũ;
- renderer dispose giải phóng resource;
- resource registry ref-count, dedupe, LRU và dispose;
- AudioBuffer cache eviction.

### 4.3 Component test

- sidebar không render theo playback tick;
- inspector không render theo playback tick;
- timeline clip tree không render theo playhead tick;
- transport label update đúng throttle;
- pause/seek publish exact final time;
- stage mount trễ vẫn paint frame hiện tại;
- backend đổi không để lại renderer/sink/resource cũ;
- Strict Mode mount/unmount không tạo duplicate engine.

### 4.4 Playwright/E2E

Tối thiểu cần các case sau:

1. Play video và xác nhận slider/paint clock tiến lên.
2. Pause và xác nhận slider giữ nguyên sau một khoảng chờ.
3. Seek khi paused tới frame cụ thể.
4. Rapid scrub qua nhiều mốc thời gian.
5. 30 chu kỳ play/pause/seek.
6. Chuyển qua lại nhiều preview document cùng một page.
7. Kiểm tra số lượng `video` element không tăng.
8. Kiểm tra `previewResourceCounts.entries`, `activeVideos`, `activeRvfcs` bounded.
9. Kiểm tra `data-diagnostics` không có lỗi runtime/media.
10. Chạy WebGL2 và WebGPU khi browser hỗ trợ.
11. Editor timeline play/pause không làm stage/sidebar/inspector bị coupling.
12. Hide/show active video layer khi đang playback.
13. Chạy qua clip boundary, gap và timeline end.

Ví dụ assertion telemetry:

```ts
const counts = await canvas.evaluate((node) =>
  JSON.parse(node.getAttribute("data-preview-resource-counts") ?? "null"),
);
expect(counts.activeVideos).toBeLessThanOrEqual(1);
expect(counts.activeRvfcs).toBeLessThanOrEqual(1);
expect(counts.entries).toBeLessThanOrEqual(3);
```

### 4.5 Stress/soak test

Chạy trong cùng một page/context:

- 30–100 play/pause/seek cycles;
- 10–20 document switches/edits;
- mỗi chu kỳ ghi resource counters;
- sau dispose ghi counters lần cuối;
- chụp heap snapshot nếu môi trường cho phép.

Không chỉ kiểm tra giá trị cuối. Cần kiểm tra không có xu hướng tăng đều:

```text
entries:       1, 1, 1, 1, 1
activeVideos:  1, 1, 1, 1, 1
activeRvfcs:   1, 1, 1, 1, 1
```

---

## 5. Công cụ và cách đo

### 5.1 Search static

```powershell
rg -n "requestAnimationFrame|requestVideoFrameCallback|setState|useContext|useMemo|useCallback|createTexture|AudioBuffer|URL.createObjectURL" packages apps/web
```

Các pattern cần xem xét kỹ:

- `setState` trong RAF hoặc video callback;
- `new Map`, `filter`, `sort`, `JSON.stringify` mỗi frame;
- `createTexture`, `texImage2D`, `copyExternalImageToTexture` mỗi frame;
- event listener được thêm trong effect nhưng không remove;
- `URL.createObjectURL` không có `revokeObjectURL`;
- Context value phụ thuộc `currentTime`;
- `useMemo` có dependency là object luôn tạo mới.

### 5.2 Runtime telemetry

Trong development/test nên ghi:

- engine evaluation time;
- stage paint time;
- RAF interval;
- estimated dropped composition frames;
- video drift và decoded dropped frames;
- texture upload count;
- resource registry counts;
- active video/rVFC/audio source counts.

Không log từng frame trong production. Nếu cần log realtime, dùng sampling hoặc
aggregate 1Hz.

### 5.3 Browser tools

- React DevTools Profiler: xác định component render theo playback.
- Chrome Performance: kiểm tra long task, RAF và GPU task.
- Chrome Memory: heap snapshot trước/sau soak test.
- WebGL Inspector/Chrome GPU diagnostics: kiểm tra context/resource.
- Playwright trace/video: xác định timing race và frame blank.

---

## 6. Performance acceptance criteria

Đây là budget khởi đầu cho fixture 1080p/30fps, một video có audio:

| Metric | Budget ban đầu |
|---|---:|
| Engine render p95 | ≤ 8 ms |
| Stage paint p95 | ≤ 40 ms |
| Play → first painted frame | ≤ 50 ms sau audio resume |
| A/V drift bình thường | < 100 ms |
| Dropped composition frames | < 1% trong 30 giây |
| Sidebar playback-induced renders | 0 |
| Inspector playback-induced renders | 0 |
| Timeline tree playback-induced renders | 0 |
| Video texture upload | Không vượt decoded/new frame và explicit seek |
| Active video/rVFC/resource sau dispose | Về baseline |
| Resource registry entries | Không tăng đơn điệu qua 30 cycles |
| Audio cache | Không vượt giới hạn cấu hình |

Các budget này cần được ghi cùng browser, OS, GPU và fixture. Không so sánh hai
kết quả nếu môi trường khác nhau mà không ghi chú.

---

## 7. Finding template khi review

Mỗi finding nên ghi theo mẫu:

```text
ID: PERF-001
Severity: P0 / P1 / P2 / P3
Location: file:line hoặc module
Symptom: biểu hiện quan sát được
Evidence: counter, trace, profile hoặc test failure
Root cause: nguyên nhân kỹ thuật
Impact: CPU/GPU/memory/UX nào bị ảnh hưởng
Recommendation: thay đổi cụ thể
Validation: test/metric dùng để xác nhận
Risk: rủi ro regression và rollback
```

Phân loại severity gợi ý:

- P0: crash, memory leak nghiêm trọng, mất audio/video hoặc frame invalid.
- P1: playback giật rõ, resource tăng đơn điệu, UI tree render theo frame.
- P2: chi phí không cần thiết nhưng chưa ảnh hưởng thiết bị mục tiêu.
- P3: readability, naming, cleanup nhỏ, không ảnh hưởng runtime hiện tại.

---

## 8. Checklist review cuối cùng

### Architecture

- [ ] Mỗi state có đúng owner.
- [ ] Không lưu RuntimeFrame/video/audio/GPU handle trong React store.
- [ ] Frame realtime đi qua imperative sink.
- [ ] UI chỉ nhận transport state đã throttle.

### Playback

- [ ] Có một composition clock.
- [ ] Play/pause/seek idempotent và race-safe.
- [ ] Không seek video liên tục trong playback bình thường.
- [ ] Async operation bị invalidate khi pause/dispose.

### Rendering

- [ ] Stage paint không phụ thuộc React rerender mỗi frame.
- [ ] Video upload phụ thuộc decoded frame version.
- [ ] Texture/framebuffer được reuse và dispose đúng.
- [ ] WebGL2/WebGPU có parity về lifecycle.

### Memory

- [ ] Resource loading được dedupe.
- [ ] Cache có giới hạn và eviction.
- [ ] Ref-count/release cân bằng.
- [ ] rVFC/RAF/listener đều cleanup.
- [ ] Video/audio/GPU counts về baseline sau unmount.

### Testing

- [ ] Unit engine/controller pass.
- [ ] Runtime validation pass.
- [ ] Renderer upload/dispose pass.
- [ ] Component render isolation pass.
- [ ] Playwright playback suite pass.
- [ ] Soak test không có monotonic growth.
- [ ] Mọi finding có evidence và validation command.

---

## 9. Lệnh review khuyến nghị cho repository này

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime typecheck
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine typecheck
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/preview-renderer typecheck
pnpm.cmd --filter @motionvideo/preview-renderer test
pnpm.cmd --filter @motionvideo/web typecheck
pnpm.cmd --filter @motionvideo/web test:editor
pnpm.cmd --filter @motionvideo/web exec playwright test --project=chromium --workers=1
```

Khi review performance-sensitive E2E, dùng một worker để tránh chính test suite
làm nhiễu RAF/GPU timing. Luôn ghi rõ test nào pass, test nào skip vì WebGPU,
và test nào fail do fixture/parity contract độc lập với playback.

