# Core Engine Implementation Tasks

> Nguồn: `core-engine-roadmap.md` + inventory codebase 2026-08-10
> Legend: ✅ có sẵn / 🟡 partial / ❌ chưa có

## Thực trạng nhanh (từ inventory)

| Hạng mục roadmap                             | Thực tế                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `MotionProject.timeline` canonical           | ✅ (sceneOrder, audioTracks, captionTracks)         |
| Compiler → `NormalizedMotionProjectV2`       | ✅ (variables/components/layout resolved)           |
| Prepared indexes export (`nodeById`...)      | ❌ (chỉ local Map trong compile)                    |
| Compile cache / patch protocol               | ❌                                                  |
| Structured diagnostics (path/sourceRef)      | ❌ (throw string)                                   |
| `evaluateCompositionFrame` composition-level | ✅                                                  |
| Transitions evaluated thật                   | ✅ (fade/crossfade/slide/wipe/zoom)                 |
| `EvaluatedFrame` gộp layers+projection       | 🟡 (layers ở `CompositionFramePlan` riêng)          |
| Paint command buffer                         | ✅                                                  |
| Projection union (2D/2.5D/3D seam)           | ❌                                                  |
| Pixi retained painter                        | 🟡 (cache theo key nhưng Graphics redraw mỗi frame) |
| Pixi video texture                           | ❌ (static texture)                                 |
| Pixi mask/offscreen                          | ❌                                                  |
| Remotion audio wiring                        | 🟡 (AudioRenderPlan có, `<Audio>` chưa nối)         |
| AudioContext playback engine                 | ❌ (RAF-based `playback-driver` trong editor-core)  |
| Parity harness                               | ✅ (`scripts/parity-pixi-remotion.ts`)              |
| Benchmark CLI                                | ❌                                                  |
| Capability ledger                            | ✅ (in-code `capability-ledger.ts`)                 |

---

## PHASE 0 — Baseline, inventory, freeze behavior

### Task 0.1: Capability ledger artifact

- [ ] Script `scripts/dump-capability-ledger.ts`: đọc `capability-ledger.ts` → xuất `docs/capability-ledger.md` + JSON với trạng thái `declared/partial/preview-only/export-only/production` theo chiều schema→compiler→runtime→paint→Pixi→Remotion→export.
- [ ] Ghi rõ gap đã biết: video texture preview, Pixi mask/offscreen, Remotion audio, prepared indexes.
- Gate: mỗi gap có fixture fail/skip + issue ID, không hidden fallback.

### Task 0.2: Benchmark harness

- [ ] `scripts/benchmark-engine.mts`: CLI chạy fixture matrix → JSON report (p50/p95): evaluate+command-gen, Pixi sync+submit, warm seek, memory sau N load/dispose.
- [ ] Fixtures: 100/500/2000 drawables, text-rich, image-heavy, video+voiceover+BGM, nested groups/masks, overlapping scenes, 10-phút timeline, rapid seek/scrub/undo.
- [ ] Commit baseline `benchmarks/baseline.json`; CI fail nếu regression >10%.
- Gate: `pnpm bench` chạy local, report deterministic (seeded).

### Task 0.3: Deterministic rules

- [ ] `motion-runtime/src/determinism.ts`: frame rounding, time quantization, float epsilon, sort tie-break, locale, seed — 1 chỗ duy nhất quantize time→frame + tests.

### Task 0.4: Architecture dependency tests

- [ ] Cấm `motion-schema`/`motion-compiler`/`motion-runtime` import `pixi-renderer`/`remotion-renderer`/apps (eslint rule hoặc architecture test) + CI.

### Task 0.5: Test taxonomy

- [ ] Gắn nhãn: `unit`, `contract`, `structural-parity`, `pixel-parity`, `av-sync`, `performance` (vitest projects) + CI matrix.

---

## PHASE 1 — Canonical authoring schema & timeline

### Task 1.1: ADR canonical timeline

- [ ] Quyết định: (A) xóa persisted `lanes/clips`, derive từ project; hay (B) giữ như draft gắn revision. Viết `docs/adr-timeline-canonical.md`.
- Hiện tại `editor-core/TimelineDocument { project, lanes, clips }` là model song song.

### Task 1.2: Pure projection + transaction

- [ ] Hợp nhất `migrateLanesAndClips` + `sceneOrderToTimelineClips` → 1 API `projectToTimelineDocument(project)`.
- [ ] Mỗi `TimelineCommand` → project patch + re-derive projection; không sửa clips/lanes trực tiếp.
- [ ] Test: move/trim/reorder/split/transition commit đúng 1 history entry + revision tăng.

### Task 1.3: Renderer guard

- [ ] Runtime/compiler reject editor-only clips/lanes không có revision/fingerprint gắn project.

### Task 1.4: Stable IDs & migration

- [ ] Validation clip/lane/scene/node references resolve được; migration tests v1→v2 (fixture round-trip); unknown-field policy + test.

### Gate Phase 1

- Cùng project/revision → cùng composition plan ở web, desktop, preview test, export test.

---

## PHASE 2 — Prepared Runtime IR & incremental compiler

### Task 2.1: PreparedRuntimeProject

- [ ] Compiler emit `prepared`: `nodeById`, `sceneById`, topo order, track index, asset URI map, capability fingerprint, static geometry, text-layout input, compositing scopes, dependency graph.
- [ ] Type trong `motion-schema` (serialized) hoặc runtime (in-memory) — chọn theo roadmap §3.

### Task 2.2: Structured diagnostics

- [ ] Compiler trả `{ ok, project?, diagnostics: [{path, sourceRef?, code, message, severity}] }` thay vì throw string.
- [ ] Migrate call sites (editor store, AI apply, scripts).

### Task 2.3: Compile cache

- [ ] Key = projectRevision + compilerVersion + componentDeps hash + test invalidation.

### Task 2.4: RuntimePatch protocol

- [ ] `RuntimePatch = PaintPatch | TrackValuesPatch | StructuralPatch(subtree)`.
- [ ] Invalidation: scene range / frame range / node subtree / asset / media plan.
- [ ] Revision/sequence: painter drop stale patch.

### Task 2.5: Wire patch vào painter

- [ ] `PixiFramePainter.applyPatch(patch)`: visual patch không clear toàn bộ display cache + test.

### Gate Phase 2

- RAF không build Map/sort topo; visual patch giữ cache; structural patch chỉ rebuild scope; 2D fixture parity baseline.

---

## PHASE 3 — Composition evaluator duy nhất

### Task 3.1: Gộp layers vào frame contract

- [ ] `EvaluatedCompositionFrame` mới (roadmap §4): `{ compositionFrame, compositionTime, fps, viewport, layers[], interaction, paint, audio, media[], projection, diagnostics, contractVersion }`.
- [ ] Migrate `CompositionFramePlan.layers` vào trong frame.

### Task 3.2: Stable keys

- [ ] Stable layer key + drawable key xuyên playback/edit patch (kể cả scene lặp/overlap) + test.

### Task 3.3: Interaction snapshot cùng evaluate

- [ ] `interaction` biết composition layer, clip ID, scene ID, source node ID; hit-test dùng cùng transform với paint (mở rộng `hit-test-snapshot` parity cho transition cases).

### Task 3.4: Camera view override seam

- [ ] `evaluateCompositionFrame(prepared, frame, { stageView: "camera" | "flat" })`; flat là override, không sửa project; test identity khi chưa có camera.

### Task 3.5: Transition frame fixtures

- [ ] Golden JSON digests before/start/middle/end/after cho cut/fade/crossfade/slide/wipe/zoom.

### Gate Phase 3

- Pixi/Remotion chỉ consume `EvaluatedCompositionFrame`, không tự ghép `compositionLayers` metadata.

---

## PHASE 4 — Paint display list & compositing semantics

### Task 4.1: Compositing semantics đầy đủ

- [ ] Spec test nesting `beginLayer/endLayer`, `beginGroup/endGroup`.
- [ ] Mask/matte trong paint commands: source, mode (alpha/luma), coordinate space, lifetime.
- [ ] Offscreen isolation, effect order, blend mode, adjustment layer.
- [ ] Tách static resource/geometry descriptor vs per-frame property update.

### Task 4.2: Item fingerprint

- [ ] Mỗi paint item có fingerprint → painter skip property không đổi (nền cho Phase 8).

### Task 4.3: Explicit unsupported

- [ ] Production không silent ignore `unsupported` command: emit diagnostic + test.

### Task 4.4: Contract versioning + validator

- [ ] `paintContractVersion` + `validatePaintBuffer(buffer)` dùng trong parity harness.

### Task 4.5: Geometry union seam

- [ ] `EvaluatedGeometry = affine-2d | projected-quad | mesh`; chỉ productionize `affine-2d`.
- [ ] Flatten boundary cho group có mask/effect (seam 3D).

### Gate Phase 4

- Mọi paint command có positive + negative test; mask/isolate/effect-order có structural fingerprint.

---

## PHASE 5 — Pixi retained painter correctness

### Task 5.1: Container hierarchy đúng nesting

- [ ] Audit `PixiFramePainter.paintCommands`: map group/layer nesting → Pixi Container tree.

### Task 5.2: Offscreen RenderTexture

- [ ] Isolation/mask/effect → RenderTexture pipeline + dispose tests.

### Task 5.3: Alpha/luma masks

- [ ] Theo capability ledger; fixture từng mode.

### Task 5.4: Transition layers

- [ ] Verify painter consume transition từ composition paint list.

### Task 5.5: Text hoàn chỉnh

- [ ] Font load/wait, weight, align, rich runs, wrapping, line height, letter spacing; fixture + parity Remotion.

### Task 5.6: Image/path/stroke

- [ ] fit/crop/alpha, stale asset guard, stroke semantics.

### Task 5.7: Unsupported → diagnostic overlay

- [ ] Không paint sai im lặng; overlay/event + test.

### Task 5.8: Dispose

- [ ] Texture/RenderTexture/filter/media dispose; load/dispose stress test không leak.

### Gate Phase 5

- Mọi production capability có Pixi fixture; pixel snapshots ổn định trên pinned baseline.

---

## PHASE 6 — Playback engine & AudioContext master clock

### Task 6.1: Tạo `packages/playback-engine`

- [ ] Public API roadmap §13: `load/applyPatch/play/pause/seek/setRate/setLoop/setQuality/renderFrameAt/getMetrics/dispose`.
- [ ] Migrate logic từ `editor-core/src/playback/playback-driver.ts` (RAF + re-anchor có sẵn).
- [ ] Nếu chưa tách package: đặt `editor-core/playback` nhưng API/dependency direction cho phép tách sau.

### Task 6.2: AudioContext clock

- [ ] `AudioContext.currentTime` substrate khi có; monotonic fallback khi không audio/suspended.
- [ ] Re-anchor đúng khi play/seek/rate/visibility/resume.

### Task 6.3: Frame scheduler

- [ ] Quantize theo project FPS, presenter theo RAF; không emit store update mỗi RAF — renderer đọc clock trực tiếp (refactor `playback-clock-store` + `usePlaybackDriver`).

### Task 6.4: Revision/sequence

- [ ] Frame cũ sau seek/patch bị drop (sequence ID).

### Task 6.5: Quality modes

- [ ] `interactive | playback | final`; final-refine frame sau khi dừng.

### Task 6.6: Metrics

- [ ] Starvation, dropped/stale frames, evaluate/paint time, buffer metrics.

### Task 6.7: Web + desktop adopt

- [ ] Cả 2 app dùng chung engine API, chỉ khác host adapter; xóa clock thứ hai trong store.

### Gate Phase 6

- Clock drift/seek tests đạt budget; engine chạy test không React.

---

## PHASE 7 — Audio & video media pipeline

### Task 7.1: AudioRenderPlan mở rộng

- [ ] Thêm asset duration, clip duration, trimEnd, rate, loop window, channel policy.

### Task 7.2: Web Audio scheduler

- [ ] Look-ahead scheduler, gain nodes, mute/solo; decode/cache theo asset identity; reschedule sau seek/patch/rate/interruption.

### Task 7.3: Volume envelope nội suy

- [ ] Fade liên tục, không step/hold.

### Task 7.4: Export audio parity

- [ ] Remotion `<Audio>` wiring đọc cùng AudioRenderPlan.

### Task 7.5: MediaFrameProvider

- [ ] Interface độc lập Pixi; video local time từ composition evaluator (`resolveMediaTiming` có sẵn).
- [ ] HTMLVideoElement + rVFC baseline; WebCodecs sau capability detect.
- [ ] Texture update chỉ khi frame mới; CORS/decode failure/stale/dispose; tách audio của video.

### Gate Phase 7

- AV sync 10 phút ≤20ms drift; rapid seek không hiện frame cũ; không `Texture.WHITE` fallback im lặng.

---

## PHASE 8 — Preview performance & incremental invalidation

### Task 8.1: Dirty diff trong Pixi painter

- [ ] So fingerprint item → chỉ update khi đổi; bỏ `Graphics.clear()` khi fingerprint giữ nguyên; cache filters, update uniforms; không set lại TextStyle khi không đổi.

### Task 8.2: Render on-demand

- [ ] Pause: không ticker render liên tục.

### Task 8.3: Adaptive resolution

- [ ] interactive/playback/final; tách composition resolution vs CSS display size.

### Task 8.4: Overlay imperative

- [ ] Selection/interaction overlay đọc external store, tránh React re-render mỗi frame.

### Task 8.5: Static subtree cache → RenderTexture

- [ ] Chỉ khi benchmark chứng minh lợi ích.

### Task 8.6: Profiler HUD (dev only)

### Gate Phase 8

- Đạt budgets; pause ~0 CPU/GPU; drag không compile/recreate static drawables.

---

## PHASE 9 — Worker & frame buffering (theo số liệu)

### Task 9.1: Benchmark 4 chế độ

- [ ] Roadmap §16 thứ tự thử nghiệm; chỉ merge khi p95 tốt hơn baseline trên project nặng.

### Task 9.2: Protocol versioning + transferable

- [ ] Sequence IDs, typed arrays, đo serialize/transfer riêng.

### Task 9.3: Buffer policy

- [ ] Look-ahead chỉ khi playing; invalidation order đúng; starvation fallback; final refine khi pause.

### Task 9.4: Media fallback

- [ ] Worker không truy cập media API → main-thread provider.

### Gate Phase 9

- Worker/main-thread cùng frame fingerprints/pixels; interactive latency trong budget.

---

## PHASE 10 — Export determinism & parity

### Task 10.1: RenderManifest

- [ ] `render-contracts`: project hash, runtime hash, asset/font hashes, FPS, dimensions, capability fingerprint, compiler version pin.

### Task 10.2: Remotion full compositing

- [ ] Đầy đủ group/mask/offscreen/effect (song song Phase 5).

### Task 10.3: Audio export parity

- [ ] Cùng AudioRenderPlan (Task 7.4).

### Task 10.4: Real pixel parity

- [ ] Pixi canvas capture vs export still cùng frame; tolerance theo text/image/gradient/blur/mask/blend; mở rộng `parity-pixi-remotion.ts`.

### Task 10.5: Golden frames

- [ ] before/start/middle/end/after + transition overlaps; deterministic re-render test.

### Task 10.6: Preflight

- [ ] Reject capability non-production.

### Gate Phase 10

- Semantic/structural/visual parity CI gate; manifest đủ reproduce render job.

---

## PHASE 11 — Perspective 3D (sau khi 1–10 đạt gate)

### Task 11.1: Schema

- [ ] Optional `z`, `rotationX/Y/Z`, camera pose/lens, keyframe capability, limits chống NaN, migration minor version; defaults map về 2D.

### Task 11.2: Runtime

- [ ] Mat4 pipeline, inverse camera pose, pixel-space perspective, project quad + near clip + depth key, depth sort stable tie-break, group offscreen→project-as-plane, hit-test quad, bounds projected corners.

### Task 11.3: Painter

- [ ] `projected-quad` → Pixi Mesh/shader; text/vector raster-to-texture khi nghiêng; video texture lên quad; Remotion cùng output; flat stage view.

### Gate Phase 11

- Identity 3D khớp fixture 2D; AI/editor capability chỉ mở sau full ledger xanh.

---

## PHASE 12 — Reliability & production hardening

### Task 12.1: Error taxonomy + diagnostics

- [ ] parse/compile/evaluate/asset/media/paint/export; diagnostics có path, IDs, capability, frame/time.

### Task 12.2: Cancellation/dispose tests

- [ ] Async compile, asset load, audio decode, video seek, worker frame.

### Task 12.3: Fuzz + soak

- [ ] Schema limits, cycles, invalid refs, non-finite; long-run playback; memory soak 20× load/play/dispose.

### Task 12.4: Versioning & rollout

- [ ] Version/migration policy: Authoring IR, Runtime IR, Paint contract, Worker protocol; feature flags + rollback checklist.

---

## Thứ tự PR (map roadmap §21)

| PR      | Tasks      | Phụ thuộc        |
| ------- | ---------- | ---------------- |
| core-00 | 0.1–0.5    | —                |
| core-01 | 1.1–1.4    | core-00          |
| core-02 | 2.1, 2.2   | core-01          |
| core-03 | 2.3–2.5    | core-02          |
| core-04 | 4.5, 3.4   | core-02          |
| core-05 | 3.1–3.3    | core-03          |
| core-06 | 3.5        | core-05          |
| core-07 | 4.1–4.4    | core-05          |
| core-08 | 5.1–5.4    | core-07          |
| core-09 | 5.5–5.7    | core-08          |
| core-10 | 6.1–6.6    | core-05          |
| core-11 | 7.1–7.4    | core-10          |
| core-12 | 7.5        | core-10          |
| core-13 | 8.1–8.6    | core-08          |
| core-14 | 10.4, 10.5 | core-09, core-11 |
| core-15 | 9.x        | core-13          |
| core-16 | 10.1, 10.6 | core-14          |
| core-17 | 11.1, 11.2 | core-16          |
| core-18 | 11.3       | core-17          |
| core-19 | 12.x       | mọi thứ          |
