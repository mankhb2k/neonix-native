# Workflow MotionVideo Desktop

> Cập nhật: 2026-08-01
>
> Trọng tâm hiện tại: desktop app chạy Electron + React/Vite. Web editor không nằm trong roadmap gần hạn.

## 1. Mục tiêu và quyết định kiến trúc

MotionVideo được phát triển desktop-first với các quyết định sau:

- Electron là desktop shell và quản lý vòng đời ứng dụng.
- React + Vite là giao diện editor mặc định.
- `editor-core`, schema, compiler và runtime chứa logic thuần, không phụ thuộc React, Electron hoặc PixiJS.
- PixiJS sẽ là preview renderer tăng tốc GPU trong tương lai.
- WebGL là backend production đầu tiên của PixiJS; WebGPU được triển khai sau capability check, benchmark và fallback.
- Tác vụ native nặng chạy trong utility process/worker riêng, không chạy đồng bộ trong renderer hoặc Electron main.
- C++ được đóng gói thành Node-API addon `.node` và được load bên trong native worker.
- FFmpeg tiếp tục chạy ở process riêng cho đến khi profiling chứng minh cần tích hợp libav trực tiếp.
- IPC/MessagePort chỉ truyền command, job descriptor, progress và result; không truyền raw frame liên tục.
- `apps/web/components/desktop/**` là visual reference được bảo vệ và **không bao giờ được xóa hoặc sửa hàng loạt nếu chưa có quyết định trực tiếp của owner**.

Mục tiêu không phải là “loại bỏ IPC bằng mọi giá”. Mục tiêu là giữ IPC mỏng, batch dữ liệu, tránh copy dữ liệu lớn và cô lập crash của native code khỏi UI.

## 2. Kiến trúc hiện tại

```text
apps/desktop
├── src/main                 Electron lifecycle, window, file, IPC, export jobs
├── src/preload              typed contextBridge API
├── src/shared               IPC contracts, schemas, project envelope, presets
├── renderer/src/app         React application state và project lifecycle
├── renderer/src/editor      timeline, inspector, stage, playback, assets
└── scripts                  smoke, performance, baseline và lifecycle QA

packages
├── editor-core              timeline document, commands, history, selection, properties
├── motion-schema            canonical authoring schema và parser
├── motion-compiler          authoring project → normalized runtime IR
└── motion-runtime           evaluator dùng cho preview/export
```

Ranh giới dependency bắt buộc:

```text
React/Electron/Pixi adapters
            ↓
        editor-core
            ↓
schema → compiler → normalized runtime IR → evaluator
```

Các package logic không được import từ `apps/desktop/renderer`, Electron hoặc `apps/web`.

## 3. Luồng project canonical

```text
Brief / script / brand
        ↓
Template retrieval + motion grammar
        ↓
AI Planner điền Project Variables / public props / text Nodes
        ↓
parseMotionProject
        ↓
Editor command sửa Node, Clip, Variable và Timeline
        ↓
validateDesktopDocumentJson
        ↓
Atomic save canonical .mt + backup + recovery journal
```

`parseMotionProject` là cổng canonical duy nhất cho MotionProject. Desktop envelope và timeline cũng phải được parse strict trước khi open, save, recover hoặc export.

Không tự đoán cấu trúc input và không silently migrate dữ liệu hỏng. Migration hợp lệ phải có version, fixture và test riêng.

## 4. Luồng command, history và persistence

Mọi mutation editor phải đi theo một đường duy nhất:

```text
UI intent
   ↓
typed command
   ↓
editor-core validate + execute atomic
   ↓
new immutable document + domain events
   ↓
history transaction/coalesce
   ↓
React session publish document revision
   ├── preview renderer update
   └── journal dirty metadata / debounced autosave
```

Quy tắc:

- UI không sửa trực tiếp project hoặc timeline arrays.
- Command không được trả `applied` nếu target không hợp lệ hoặc không có thay đổi thực tế.
- Multi-target command phải áp dụng atomic cho toàn bộ target hoặc reject toàn bộ.
- Scrubbing tạo một history entry cho mỗi gesture, không tạo entry cho từng pointer move.
- Journal metadata được ghi theo history commit; full document snapshot chỉ được gửi theo debounce/autosave.
- Save thành công mới được clear journal.
- Discard phải clear journal của cả locator cũ theo `projectId` và locator mới theo `path`.
- Recovery snapshot phải được validate canonical trước khi đưa vào editor.

## 5. Luồng compile và export hiện tại

```text
Authoring Project
  1. validate structure + references
  2. resolve exact Component dependencies
  3. apply Project bindings
  4. map public props → Component variables → internal bindings
  5. expand repeater và component namespace
  6. resolve schedule, playback rate và variable references
  7. expand preset thành literal property tracks
        ↓
Normalized Runtime IR
        ↓
frame plan
        ↓
parallel raster workers
        ↓
FFmpeg child process
        ↓
MP4
```

Runtime IR không chứa preset, Component, variable reference, binding hoặc repeater. Tính năng hình ảnh mới phải được bổ sung ở schema/compiler/runtime evaluator trước, không được nhét authoring logic riêng vào Pixi renderer hoặc native exporter.

Export hiện hỗ trợ Preview, FHD và UHD/4K. UHD test ngắn đã tạo MP4 3840×2160, nhưng release gate vẫn cần soak dài, memory ceiling, cancel/restart và hardware encoder fallback.

## 6. Preview hiện tại và đích PixiJS

Hiện tại production preview dùng DOM renderer; Canvas2D chỉ là backend thử nghiệm. Repo chưa có PixiJS runtime thật.

Đích tương lai:

```text
TimelineDocument + RuntimeEvaluator
               ↓
        versioned RenderSnapshot
          ├── PixiPreviewAdapter
          │     ├── WebGL production
          │     └── WebGPU experimental/fallback
          └── ExportRenderAdapter
                ├── current raster worker
                └── future native engine
```

`RenderSnapshot` là seam bắt buộc để preview và export không tự diễn giải project theo hai cách khác nhau. Nó tối thiểu chứa:

- frame/time và composition size;
- ordered render items;
- evaluated transform, opacity và visibility;
- resolved text/style/media source;
- masks, effects và blend information đã normalize;
- stable IDs và revision để renderer cập nhật incremental.

React chỉ quản lý lifecycle của renderer và document revision. Ticker/playback frame phải gọi imperative `paintFrame()`; không `setState` React theo mỗi frame.

## 7. Kiến trúc đích Electron + Pixi + native engine

```text
Sandboxed Electron Renderer
┌──────────────────────────────────────────────────┐
│ React UI                                         │
│   ↓ typed intents                                │
│ editor-core / command history                    │
│   ↓ RenderSnapshot                               │
│ PixiJS preview: WebGL default, WebGPU optional   │
└──────────────────────┬───────────────────────────┘
                       │ typed IPC / MessagePort
                       ▼
Electron Main — control plane
window · dialog · capability token · job broker · app lifecycle
                       │ transfer MessagePort once
                       ▼
Utility Process — compute plane
Node job wrapper
   ├── native-engine.node → C++ thread pool
   ├── FFmpeg/ffprobe child process
   └── progress · cancellation · result · crash report
```

### React renderer

Chịu trách nhiệm:

- UI shell, timeline chrome, inspector và selection;
- dispatch typed command;
- hiển thị progress/result;
- không có filesystem hoặc Node integration;
- không load `.node` trực tiếp.

### Pixi preview renderer

Chịu trách nhiệm:

- scene graph và display-object cache;
- texture lifecycle và asset upload;
- incremental update theo stable ID/revision;
- render frame, overlays và stage interactions;
- backend capability detection và WebGL fallback;
- không sở hữu canonical project state hoặc history.

### Electron main

Chịu trách nhiệm:

- window, menu, dialog và OS integration;
- capability-scoped filesystem access;
- project session và job registry;
- spawn/restart utility process;
- broker MessagePort;
- không raster frame, encode video hoặc chạy C++ compute dài trên main thread.

### Native utility process

Chịu trách nhiệm:

- load `.node` addon trong process được cô lập;
- validate version của native job contract;
- quản lý C++ worker pool, backpressure và cancellation;
- phát progress có sequence;
- cleanup resource khi job hoàn tất/crash/cancel;
- không chứa UI state.

### FFmpeg

FFmpeg tiếp tục là executable riêng trong giai đoạn đầu. Native engine truyền file/path/pipe descriptor phù hợp, không truyền raw frame qua Electron IPC.

Chỉ cân nhắc link libav vào `.node` khi profiling chứng minh ít nhất một trong các nhu cầu sau:

- cần zero-copy decode/composite/encode;
- process pipeline hiện tại bị giới hạn bởi transfer/serialization;
- cần API codec mà CLI không đáp ứng;
- lợi ích đo được lớn hơn chi phí packaging, licensing và crash risk.

## 8. Native job protocol

Native contract phải versioned và độc lập với UI:

```ts
type NativeJobRequest = {
  contractVersion: 1;
  jobId: string;
  kind: "probe" | "waveform" | "thumbnail" | "render" | "encode";
  input: CapabilityToken | RenderPlanPath;
  output: CapabilityToken;
  options: Record<string, unknown>;
};

type NativeJobEvent =
  | { jobId: string; seq: number; type: "started" }
  | { jobId: string; seq: number; type: "progress"; phase: string; ratio: number }
  | { jobId: string; seq: number; type: "completed"; result: unknown }
  | { jobId: string; seq: number; type: "failed"; code: string; message: string }
  | { jobId: string; seq: number; type: "cancelled" };
```

Quy tắc truyền dữ liệu:

- truyền path/capability token cho file lớn;
- dùng transferable `ArrayBuffer` hoặc shared memory có giới hạn khi thật sự cần;
- không base64 raw video frame;
- batch command, không gọi N-API cho từng pixel hoặc primitive nhỏ;
- progress có backpressure và tần suất giới hạn;
- cancellation phải idempotent;
- native crash không được làm mất project hoặc giết renderer.

## 9. Trạng thái refactor hiện tại

### Đã hoàn thành

- Vite là desktop renderer mặc định cho dev và packaged app.
- Electron main/preload/renderer được tách rõ.
- Renderer giữ `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Typed IPC result/schema và capability-scoped filesystem đã có.
- New/open/save/save-as, atomic save, `.bak` và recent projects đã có.
- Timeline command/history, selection, move, trim, split, clipboard, marquee và virtualization đã có.
- Playback clock nằm ngoài React frame state; stage paint imperative.
- Inspector registry đã có number, boolean, string, color, enum và vector seam.
- Export CLI, bundled FFmpeg và native canvas smoke đã pass.
- UHD/4K preset và short encode 3840×2160 đã pass.
- Legacy web desktop tree được freeze và có automated protection gate.

### Lỗi logic cần đóng trước native/Pixi migration

1. Save As của project chưa lưu phải migrate/clear journal theo cả `projectId` và `path`.
2. Discard khi quay Home phải clear recovery journal.
3. Journal IPC phải báo kết quả sau khi queue write thực sự hoàn tất; không fire-and-forget lỗi.
4. Không gửi full `documentJson` qua bridge cho từng pointer edit.
5. Audio `speed` không được accepted rồi silently ignored.
6. Multi-target keyframe phải xử lý toàn bộ target atomic.
7. Style/text/media/effect command phải reject invalid target/value thay vì applied no-op.
8. Lifecycle E2E phải dùng envelope và project service thật; close-unsaved test phải thực sự đi qua Save/Discard/Cancel.
9. Recovery snapshot và journal metadata phải dùng atomic write/rename và canonical validation.

Không được đánh dấu logic cutover hoàn tất khi các mục này chưa có regression test.

## 10. Roadmap thực thi

### Phase F0 — Đóng lỗi logic hiện tại

Mục tiêu: có baseline đúng trước khi thay renderer/native pipeline.

- Fix journal key migration, discard và async receipt.
- Debounce journal history metadata và autosave snapshot.
- Fix property commands atomic/validation/multi-target.
- Viết lại lifecycle E2E bằng app/service thật.
- Cập nhật logic parity matrix dựa trên behavior assertion, không chỉ kiểm tra symbol tồn tại.

Gate hoàn thành:

- test new → edit → autosave → Save As → reopen;
- test discard không còn recovery offer;
- test corrupted snapshot bị reject;
- test multi-target keyframe/effect/audio;
- close-unsaved Save/Discard/Cancel đều chạy trong Electron.

### Phase F1 — Khóa RenderSnapshot contract

- Định nghĩa versioned `RenderSnapshot` trong package logic, không đặt trong renderer.
- Adapter từ Runtime IR/evaluator sang RenderSnapshot.
- Golden snapshot cho text, image, video, shape, transform, mask, effect và overlap lane.
- DOM renderer hiện tại chuyển sang dùng contract này trước.

Gate hoàn thành:

- preview DOM và export evaluator dùng cùng evaluated values;
- không còn authoring interpretation nằm riêng trong stage adapter;
- golden deterministic theo frame/time.

### Phase F2 — PixiJS WebGL production adapter

- Thêm package/module `pixi-preview` sau stage port hiện tại.
- Map stable node ID → Pixi display object.
- Incremental patch transform/style/texture thay vì rebuild scene graph.
- Texture cache, eviction, missing asset và device-loss handling.
- Feature flag backend: `dom | pixi-webgl`.

Benchmark bắt buộc:

- 100, 500 và 2.000 display objects;
- scrub timeline, seek ngẫu nhiên và playback 30/60 fps;
- image/video/text/effect workloads;
- CPU time, GPU memory, dropped frame và time-to-first-frame.

Gate hoàn thành:

- không render storm React;
- visual golden trong tolerance;
- WebGL fallback ổn định;
- DOM rollback còn hoạt động trong giai đoạn soak.

### Phase F3 — WebGPU capability path

- Khởi tạo async với WebGPU preference.
- Capability/adapter/device detection.
- Tự fallback WebGL khi init/device/filter không tương thích.
- Test device lost và renderer recreation.
- Không bật mặc định trước khi benchmark trên GPU Intel/NVIDIA/AMD thực tế.

Gate hoàn thành:

- cùng RenderSnapshot và cùng visual contract với WebGL;
- không có feature chỉ chạy WebGPU mà export không hiểu;
- telemetry nội bộ ghi backend/fallback/device-loss.

### Phase F4 — Native worker skeleton

- Tạo utility process chạy Node job wrapper.
- Main broker MessagePort một lần cho renderer ↔ worker.
- Tạo Node-API addon tối thiểu: version, health, async benchmark, cancel.
- Addon dùng `napi_async_work`, C++ pool hoặc ThreadSafeFunction; không block JS loop.
- Native binary nằm ngoài asar hoặc trong `extraResources` có manifest/hash.
- CI build/smoke theo Electron version, OS và architecture.

Gate hoàn thành:

- worker crash/restart không làm chết UI;
- cancel idempotent;
- invalid contract/version bị reject;
- `.node` load được trong packaged utility process;
- không cần tắt renderer sandbox.

### Phase F5 — Chuyển hotspot đã profile sang C++

Thứ tự ưu tiên chỉ sau profiling:

1. media probe và metadata extraction;
2. waveform generation;
3. thumbnail/contact sheet;
4. pixel/color transforms;
5. decode/composite primitives thực sự CPU-bound;
6. frame raster native nếu benchmark chứng minh cần thiết.

Không port business rule, command/history hoặc canonical schema sang C++.

Gate cho mỗi hotspot:

- benchmark trước/sau;
- JS fallback hoặc worker fallback rõ ràng;
- deterministic fixture/golden;
- memory leak/ASAN hoặc platform-equivalent checks;
- cancel và crash cleanup.

### Phase F6 — Export production 4K

- Giữ FFmpeg child process trong native/export worker.
- Detect NVENC, QSV, AMF, VideoToolbox và software fallback.
- Tách metric render-frame, transfer, encode và mux.
- Bounded frame queue; producer không được làm tràn RAM.
- Ưu tiên file/pipe/mmap phù hợp thay vì Electron IPC raw frame.
- Power save blocker chỉ tồn tại trong job export.

Gate hoàn thành:

- 4K 5–10 phút với text/image/video/effect;
- output dimensions/fps/audio duration đúng;
- cancel giữa job không để process/temp files;
- worker crash có error rõ và app vẫn dùng được;
- memory ceiling được định nghĩa theo preset;
- hardware encoder lỗi thì fallback software.

### Phase F7 — Cutover và hardening

- Pixi WebGL trở thành preview mặc định sau soak.
- WebGPU vẫn capability-driven cho đến khi đủ dữ liệu production.
- Native worker trở thành đường mặc định cho hotspot đã đạt gate.
- Xóa alias/tên gây hiểu nhầm, nhưng không xóa web reference tree.
- Code signing/notarization và native binary integrity.
- Release rollback theo installer/version, không dựa vào legacy web runtime.

## 11. Workflow phát triển một tính năng mới

Mỗi tính năng phải đi theo thứ tự:

1. Khóa use case bằng fixture/golden.
2. Cập nhật canonical schema và reference validator nếu cần.
3. Thêm typed command/policy trong `editor-core`.
4. Cập nhật compiler sang Runtime IR literal.
5. Cập nhật evaluator/RenderSnapshot dùng chung.
6. Cập nhật Pixi preview adapter.
7. Cập nhật export/native adapter nếu feature xuất hiện trong output.
8. Mở UI/AI capability cuối cùng.
9. Chạy correctness, performance, packaging và recovery gates.

Không thêm field riêng cho từng preset như `speedFromVariable`; dùng contract tổng quát như `ResolvableValue`. Không tạo collection spatial thứ hai ngoài Scene Node graph.

## 12. Automated gates

Chạy tối thiểu trước mỗi merge liên quan desktop:

```bash
pnpm --filter @motionvideo/desktop lint
pnpm --filter @motionvideo/desktop typecheck
pnpm --filter @motionvideo/desktop test
pnpm --filter @motionvideo/editor-core test
pnpm --filter @motionvideo/desktop test:perf
pnpm --filter @motionvideo/desktop test:web-ban
pnpm --filter @motionvideo/desktop test:export-cli
pnpm --filter @motionvideo/desktop test:e2e:lifecycle
```

Gate theo phạm vi:

- Timeline/hot path: Electron pointer performance và virtualization budget.
- Preview/Pixi: visual golden, dropped frame, GPU memory và backend fallback.
- Native: packaged addon load, crash/restart/cancel và architecture matrix.
- Export: output probe, A/V duration, 4K soak và temp cleanup.
- Persistence: crash journal, corrupt recovery, Save As migration và close-unsaved.
- UI parity: baseline/geometry scripts; UI parity không thay thế logic tests.

## 13. Definition of done

Một thay đổi editor/motion hoàn tất khi:

- input parse được bằng API canonical;
- ID/reference/cycle/dependency được validate;
- mutation chỉ đi qua typed command;
- command invalid không silently succeed;
- undo/redo, journal và save giữ cùng document revision;
- preview và export có cùng property/timing semantics;
- React không rerender theo mỗi playback frame;
- tác vụ nặng không block renderer hoặc Electron main;
- native crash được cô lập và có đường recovery;
- output sai contract bị từ chối với lỗi rõ ràng;
- fixture, lint, typecheck, unit, performance và smoke phù hợp đều pass;
- tài liệu parity phản ánh behavior thật, không chỉ kiểm tra symbol tồn tại;
- `apps/web/components/desktop/**` vẫn nguyên vẹn trừ khi owner trực tiếp quyết định khác.

## 14. Nguyên tắc không thỏa hiệp

- Không tắt renderer sandbox để load native addon.
- Không chạy FFmpeg/C++ synchronous trên renderer hoặc Electron main thread.
- Không truyền raw 4K frames qua contextBridge/Electron invoke.
- Không để Pixi/native engine trở thành source of truth cho project.
- Không triển khai cùng một motion rule khác nhau trong preview và export.
- Không đánh dấu phase `pass` bằng test chỉ kiểm tra API/symbol tồn tại.
- Không xóa `apps/web/components/desktop/**` cho đến khi owner quyết định.
