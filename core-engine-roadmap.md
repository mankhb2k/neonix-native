# Core Engine Roadmap - Schema, Runtime, Playback, Preview, Render

> Trang thai: Draft de trien khai
>
> Pham vi uu tien: logic loi va tinh dung dan cua engine. UI/UX web va desktop chi duoc xem la adapter mong cho den khi cac contract loi on dinh.

## 1. Muc tieu

Xay dung mot video engine co mot duong du lieu duy nhat:

```text
MotionProject (Authoring IR)
  -> parse + validate
  -> incremental compile
  -> Prepared Runtime IR
  -> evaluate composition frame
  -> EvaluatedCompositionFrame
       |- interaction snapshot
       |- paint display list
       |- audio/media state
       |- diagnostics
       `- projection/depth metadata
  -> Pixi preview painter
  -> Remotion/export painter
```

Ket qua can dat:

- Timeline, preview, audio va export cung doc mot nguon thoi gian va mot composition model.
- Pixi va Remotion chi paint, khong tu tinh easing, timing, camera hay layout.
- Playback khong compile project trong luc dang chay.
- Edit nho khong lam clear toan bo display cache.
- Preview va export co semantic, structural va pixel parity.
- Camera 2D/2.5D hien tai giu fast path; contract co seam de them perspective 3D sau nay ma khong viet lai schema/runtime/painter.
- Web va desktop khong so huu logic engine rieng.

## 2. Cac quyet dinh kien truc khoa som

### 2.1 Mot source of truth cho composition

Khong duy tri hai timeline co the cho ket qua khac nhau:

- `MotionProject.timeline` la authoring source of truth duoc persist.
- Editor clips/lanes la projection/index cua project, hoac la transaction draft co quy tac commit ro rang.
- Runtime chi nhan timeline da compile.
- Preview khong duoc bo qua clips/lanes neu editor dang dung chung de compose.
- Export khong duoc bake theo mot policy khac preview.

### 2.2 Tach bon contract

1. `MotionProject`: du lieu authoring de edit, AI patch va persist.
2. `PreparedRuntimeProject`: du lieu literal, indexed, renderer-ready va cacheable.
3. `EvaluatedCompositionFrame`: ket qua duy nhat cua mot composition frame.
4. `RenderManifest`: compiler version, asset manifest, font manifest, capability fingerprint va deterministic settings cho export.

### 2.3 Runtime so huu semantics

Runtime so huu:

- timeline resolution;
- scene overlap va transition;
- keyframe/easing/extrapolation;
- parent transform va constraints;
- camera/projection/depth ordering;
- masks, mattes va compositing plan;
- media local time, trim, loop va playback rate;
- hit-test geometry;
- diagnostics.

Painter khong duoc tu dien giai cac semantics tren.

### 2.4 Hai cap nhat khac nhau

- `structural update`: node/clip/asset/timing/hierarchy thay doi; can recompile mot phan hoac toan bo.
- `visual patch`: gia tri paint-only nhu fill, opacity, transform literal; patch vao prepared runtime va invalidate dung frame/cache lien quan.

Khong dung mot `setDocument()` nang cho moi pointer move.

### 2.5 UI la adapter

Trong cac phase loi:

- Web va desktop chi mount engine, gui command va hien diagnostics.
- Khong refactor visual design, panel layout, timeline chrome hay interaction styling.
- Khong them logic runtime vao React hooks/components.
- Moi API can hoat dong khong can DOM de test duoc bang Node/Vitest.

## 3. Package boundary dich

| Package | Trach nhiem | Khong duoc lam |
| --- | --- | --- |
| `motion-schema` | Authoring schema, Runtime IR schema, migrations, limits, capability declarations | Evaluate frame, load media, phu thuoc Pixi/Remotion |
| `motion-compiler` | Parse authoring, resolve variables/components/layout, tao prepared indexes va fingerprints | Paint, clock, browser API |
| `motion-runtime` | Composition resolver, evaluator, projection, paint/audio/media plans, hit-test | React, Pixi, Remotion, asset network fetch |
| `playback-engine` (de xuat moi) | Transport clock, seek/play/pause/loop, audio scheduler, frame scheduler, quality mode, metrics | Authoring edits, Pixi object, React state |
| `pixi-renderer` | Retained preview painter, texture/media adapters, offscreen compositing | Compile project, resolve timeline/easing/camera |
| `remotion-renderer` | Export painter va audio adapter tu cung frame contract | Schema rieng, preview/editor state |
| `editor-core` | Command/transaction/history va projection timeline cho editor | Playback clock, renderer-specific behavior |
| `render-contracts` | Job, manifest, progress, artifact va webhook schemas | Motion semantics |

Neu chua muon tao `playback-engine`, co the dat logic tam trong `editor-core/playback`, nhung public API va dependency direction phai cho phep tach package ma khong doi consumer.

## 4. Contract frame dich

`EvaluatedFrame` scene-local hien tai can duoc nang thanh composition-level contract:

```ts
type EvaluatedCompositionFrame = {
  compositionFrame: number;
  compositionTime: number;
  fps: number;
  viewport: { width: number; height: number };
  layers: EvaluatedLayer[];
  interaction: CompositionInteractionSnapshot;
  paint: PaintDisplayList;
  audio: EvaluatedAudioState;
  media: EvaluatedMediaState[];
  projection: ProjectionSnapshot;
  diagnostics: RenderDiagnostic[];
};
```

Yeu cau:

- Transition co the chua hai hoac nhieu `EvaluatedLayer` trong cung frame.
- Moi drawable co key on dinh xuyen suot playback va edit patch.
- Interaction snapshot va paint list duoc tao tu cung mot lan evaluate.
- Audio/media time duoc resolve cung composition time.
- Frame contract khong chua Pixi object, React element, DOM node, callback hay browser resource.
- Contract co `schemaVersion`/`contractVersion` neu duoc serialize qua worker.

## 5. Seam 3D can dat ngay, nhung chua bat 3D

### 5.1 Muc tieu san pham 3D

Huong den plane-based motion graphics 3D giong ClipKit, khong huong den game engine hoac Blender thu nho:

- camera perspective;
- layer co `z`, `rotationX`, `rotationY`, `rotationZ`;
- perspective scale va foreshortening;
- depth sorting;
- group flattening khi mask/effect can offscreen;
- hit-test tren projected plane;
- preview/export parity.

Chua cam ket mesh 3D tuy y, lighting PBR, shadow map, skeletal 3D hoac physics 3D.

### 5.2 Projection union

Khong de painter suy luan camera. Frame contract can co union:

```ts
type ProjectionSnapshot =
  | {
      kind: "orthographic-2d";
      view: Mat3;
    }
  | {
      kind: "layered-2.5d";
      view: Mat3;
      depthPolicy: "painter-order" | "depth-sort";
    }
  | {
      kind: "perspective-3d";
      view: Mat4;
      projection: Mat4;
      viewProjection: Mat4;
      near: number;
      far: number;
      focalLengthPx: number;
    };
```

Hai variant dau duoc implement ngay. Variant `perspective-3d` chi duoc khai bao/internal feature flag cho den phase 3D.

### 5.3 Drawable geometry union

Tranh khoa paint contract vao `Matrix2D`:

```ts
type EvaluatedGeometry =
  | { kind: "affine-2d"; matrix: Mat3; bounds: Bounds2D }
  | { kind: "projected-quad"; corners: [Vec2, Vec2, Vec2, Vec2]; depth: number }
  | { kind: "mesh"; vertices: Float32Array; indices: Uint16Array | Uint32Array };
```

`affine-2d` la fast path mac dinh. Pixi tiep tuc dung `Container`, `Graphics`, `Sprite`, `Text` tren path nay. Sau nay `projected-quad` dung Pixi `Mesh`/shader hoac texture plane ma khong thay doi evaluator API.

### 5.4 Exact 2D fast path

- Project khong co 3D channels phai di qua matrix 2D hien tai.
- Khong convert 2D sang Mat4 roi project nguoc neu khong can.
- Identity camera phai cho output bit-stable/epsilon-stable voi output cu.
- 3D capability khong duoc mo cho AI/editor truoc khi compiler, runtime, Pixi, Remotion va parity gate cung xanh.

### 5.5 Camera schema migration seam

Khong bat buoc sua authoring schema 3D ngay. Thu tu an toan:

1. Tao runtime projection abstraction va tests voi 2D/2.5D hien tai.
2. Them internal experimental runtime fixture cho perspective.
3. Khi painter parity san sang, them optional authoring channels `z`, `rotationX`, `rotationY` va camera lens fields.
4. Defaults phai map chinh xac ve behavior 2D cu.
5. Tang format minor version/migration neu schema freeze yeu cau.

### 5.6 Flat stage mode

Hoc seam cua ClipKit:

- Persist camera trong project/runtime.
- Preview playback co camera.
- Editor co the bat `stageView: "camera" | "flat"`.
- `flat` chi la preview option, khong sua project va khong anh huong export.
- Runtime evaluator nhan view override co kieu ro rang; component UI khong xoa camera khoi JSON.

## 6. Performance va quality budgets

Moi budget can co fixture, may baseline va p50/p95. Khong optimize theo cam giac.

| Metric | Target ban dau |
| --- | --- |
| Playback compile | Khong compile trong RAF/play loop |
| Warm seek to first painted frame | p95 <= 50 ms tren baseline project |
| Evaluate + command generation | p95 <= 4 ms tai 1080p/30 fps fixture trung binh |
| Pixi sync + submit | p95 <= 4 ms, khong tinh GPU present |
| Pointer preview latency | p95 <= 16.7 ms |
| Dropped/stale frames | < 1% trong 60 giay playback baseline |
| Audio drift | <= 20 ms sau 10 phut playback lien tuc |
| Pause idle | Khong RAF/render lien tuc neu frame va overlay khong doi |
| Cache stability | Khong recreate static object/filter/texture moi frame |
| Memory | Khong tang co he thong sau 20 lan load/play/dispose |
| Preview/export pixel parity | Theo threshold rieng cho text, image, effect va compositing |

Fixture benchmark toi thieu:

- 100, 500 va 2.000 drawable nodes;
- rich text va font load;
- image-heavy composition;
- video + voiceover + BGM;
- nested groups/masks/effects;
- overlapping scenes va moi transition;
- 2.5D parallax;
- long timeline 10 phut;
- rapid seek/scrub/undo/redo;
- asset load cham, loi va stale response.

## 7. Phase 0 - Baseline, inventory va freeze behavior

### Muc tieu

Ghi lai behavior hien tai truoc khi thay contract.

### Cong viec

- [ ] Lap capability ledger that su theo chieu `schema -> compiler -> runtime -> paint -> Pixi -> Remotion -> export`.
- [ ] Danh dau capability `declared`, `partial`, `preview-only`, `export-only`, `production`.
- [ ] Ghi ro cac gap hien tai: timeline input bi bo qua, transition chi co plan, layer commands bi Pixi bo qua, video texture/audio preview chua hoan chinh.
- [ ] Tao benchmark CLI co JSON report va commit baseline thresholds.
- [ ] Tao fixture nho nhat cho tung primitive va composition feature.
- [ ] Phan loai tests: unit, contract, structural parity, pixel parity, AV sync, performance.
- [ ] Them architecture tests cam dependency nguoc tu runtime/schema sang renderer/app.
- [ ] Chot quy tac deterministic: frame rounding, time quantization, float epsilon, sort tie-break, locale va random seed.

### Gate hoan thanh

- Tat ca capability co owner va trang thai.
- Test hien tai xanh va benchmark co report tai CI/local.
- Moi gap da biet co fixture fail/skip kem issue ID, khong con hidden fallback.

## 8. Phase 1 - Canonical authoring schema va timeline

### Muc tieu

Loai bo kha nang editor, preview va export compose khac nhau.

### Cong viec

- [ ] Chot `MotionProject.timeline` la persisted source of truth.
- [ ] Dinh nghia ro `sceneOrder`, visual clips, overlay clips, audio tracks va caption tracks.
- [ ] Quy dinh clip time mapping: start, duration, trim, playback rate, loop, reverse va local time.
- [ ] Dua web/desktop timeline document logic con duplicate ve `editor-core`.
- [ ] Tao pure projection `project -> editor lanes/clips` va transaction `editor command -> project patch`.
- [ ] Cam renderer nhan editor-only clips/lanes neu khong co revision/fingerprint gan voi project.
- [ ] Them stable IDs va validation cho clip/layer/scene references.
- [ ] Them migration tests cho project cu.
- [ ] Them serialization round-trip va unknown-field policy.

### Gate hoan thanh

- Cung mot project/revision tao cung composition plan o web, desktop, preview test va export test.
- Move/trim/reorder/transition edit chi commit mot canonical project transaction.
- Khong con preview path bo qua timeline editor input.

## 9. Phase 2 - Prepared Runtime IR va incremental compiler

### Muc tieu

Chuyen chi phi structural ra khoi playback loop va tao seam cho patch nho.

### Cong viec

- [ ] Tach `NormalizedMotionProjectV2` thanh serialized Runtime IR va `PreparedRuntimeProject` in-memory neu can.
- [ ] Precompute `nodeById`, `sceneById`, stable topological order, track index, asset URI map va capability fingerprints.
- [ ] Precompute static geometry, text layout input, compositing scopes va dependency graph.
- [ ] Compiler tra ve diagnostics co path/sourceRef thay vi throw mat ngu canh.
- [ ] Them compile cache key tu project revision + compiler version + component dependencies.
- [ ] Dinh nghia `RuntimePatch` cho paint-only, track-values va structural subtree updates.
- [ ] Dinh nghia invalidation: scene range, frame range, node subtree, asset va media plan.
- [ ] Bao dam undo/redo patch co sequence/revision de stale result khong duoc paint.
- [ ] Dat projection abstraction cua muc 5 vao Runtime IR, nhung chi enable 2D/2.5D.

### Gate hoan thanh

- RAF/playback khong build map, sort topology hoac compile component lai.
- Visual patch khong clear toan bo Pixi cache.
- Structural patch chi rebuild dependency scope can thiet, hoac co fallback full compile duoc do luong ro rang.
- 2D fixture giu output parity voi baseline.

## 10. Phase 3 - Composition evaluator duy nhat

### Muc tieu

Thay scene-primary evaluation bang composition-level evaluation.

### Cong viec

- [ ] Trien khai `evaluateCompositionFrame(prepared, frame, options)` tra `EvaluatedCompositionFrame`.
- [ ] Evaluate moi active visual layer, khong chi primary scene.
- [ ] Hop nhat local time mapping cho clip, scene, transition, video va caption.
- [ ] Tao stable layer key va drawable key khi scene lap lai/overlap.
- [ ] Trien khai transition outgoing/incoming thanh paint layers that su.
- [ ] Resolve background, safe area, captions va overlays trong composition evaluator.
- [ ] Dinh nghia depth/render ordering deterministic voi tie-break theo declaration/stable ID.
- [ ] Interaction snapshot biet composition layer, clip ID, scene ID va source node ID.
- [ ] Them camera view override `camera | flat` vao evaluate options.

### Gate hoan thanh

- Cut, fade, crossfade, slide, wipe va zoom co frame fixtures before/start/middle/end/after.
- Hit-test va paint dung cung transform sau transition.
- Pixi va export khong can doc `compositionLayers` metadata de tu ghep frame.

## 11. Phase 4 - Paint display list va compositing semantics

### Muc tieu

Lam paint contract du semantics de moi painter cho cung ket qua.

### Cong viec

- [ ] Chot nesting semantics cho `beginLayer/endLayer` va `beginGroup/endGroup`.
- [ ] Bieu dien mask/matte source, mode, coordinate space va lifetime ro rang.
- [ ] Bieu dien offscreen isolation, effect order, blend mode va adjustment layer.
- [ ] Phan biet static resource/geometry descriptor voi per-frame property update.
- [ ] Them command/item fingerprint de painter bo qua property khong doi.
- [ ] Them explicit unsupported command; production khong silent ignore.
- [ ] Version paint contract va viet validator.
- [ ] Chuan bi geometry union `affine-2d | projected-quad | mesh` nhung chi productionize affine 2D.
- [ ] Xac dinh flatten boundary cho group co mask/effect; day la seam can thiet cho 3D sau nay.

### Gate hoan thanh

- Moi paint command co it nhat mot positive va mot unsupported/negative test.
- Mask, isolate, nested group va effect order co structural fingerprint.
- Painter khong duoc bo qua `beginLayer/endLayer` ma khong emit diagnostic.

## 12. Phase 5 - Pixi retained painter correctness

### Muc tieu

Hoan thien Pixi nhu preview painter chinh truoc khi toi uu worker.

### Cong viec

- [ ] Trien khai container hierarchy dung voi group/layer nesting.
- [ ] Trien khai offscreen render texture cho isolation/mask/effect.
- [ ] Trien khai alpha/luma mask theo capability ledger.
- [ ] Trien khai transition layers tu composition paint list.
- [ ] Hoan thien text: font family/load, weight, align, rich runs, wrapping, line height va letter spacing.
- [ ] Hoan thien shape/path primitives va stroke semantics.
- [ ] Hoan thien image fit/crop/alpha va stale asset guards.
- [ ] Moi unsupported capability tao diagnostic overlay/event, khong paint sai im lang.
- [ ] Bao dam dispose giai phong texture, render texture, filter va media resource.

### Gate hoan thanh

- Tat ca capability production trong ledger co Pixi fixture.
- Pixel snapshots Pixi on dinh tren browser/renderer baseline duoc pin.
- Load/dispose stress test khong leak resource.

## 13. Phase 6 - Playback engine va AudioContext master clock

### Muc tieu

Tach playback orchestration khoi React va dong bo audio/video chinh xac nhu huong ClipKit.

### Public API toi thieu

```ts
interface PlaybackEngine {
  load(source: PreparedRuntimeProject): Promise<void>;
  applyPatch(patch: RuntimePatch): void;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setRate(rate: number): void;
  setLoop(loop: boolean): void;
  setQuality(mode: "interactive" | "playback" | "final"): void;
  renderFrameAt(time: number): Promise<EvaluatedCompositionFrame>;
  getMetrics(): PlaybackMetrics;
  dispose(): void;
}
```

### Cong viec

- [ ] Dung `AudioContext.currentTime` lam precision substrate khi audio context san sang.
- [ ] Co monotonic fallback clock khi project khong co audio hoac context bi suspended.
- [ ] Re-anchor dung khi play, seek, rate change, visibility change va audio context resume.
- [ ] Frame scheduler quantize theo project FPS nhung presenter theo display RAF.
- [ ] Khong emit React/store update moi RAF; event time co throttle rieng, renderer doc clock truc tiep.
- [ ] Them sequence ID/revision de frame cu sau seek/patch bi loai.
- [ ] Co interactive mode cho scrub/drag va final-refine frame sau khi dung.
- [ ] Them starvation, dropped frame, stale frame, evaluate time, paint time va buffer metrics.
- [ ] Dinh nghia policy loop/end/replay va frame boundary bang tests.

### Gate hoan thanh

- Clock drift va seek tests dat budget.
- Playback engine chay duoc trong test khong React.
- Web va desktop dung chung engine API, chi khac host adapters.

## 14. Phase 7 - Audio va video media pipeline

### Muc tieu

Preview media dung cung timing plan voi export.

### Cong viec audio

- [ ] Mo rong `AudioRenderPlan` de co asset duration, clip duration, trim end, rate, loop window va channel policy.
- [ ] Noi suy volume envelope, khong step/hold neu schema yeu cau fade lien tuc.
- [ ] Implement Web Audio scheduler voi look-ahead, gain nodes va preview gains/mute/solo.
- [ ] Decode/cache audio theo asset identity va lifecycle.
- [ ] Reschedule an toan sau seek, patch, rate change va device interruption.
- [ ] Export adapter doc cung AudioRenderPlan.

### Cong viec video

- [ ] Tao `MediaFrameProvider` interface doc lap Pixi.
- [ ] Resolve video local time tu composition evaluator.
- [ ] Ho tro seek, trim, rate, loop, poster va frame-not-ready policy.
- [ ] Chon HTMLVideoElement/rVFC lam baseline; WebCodecs la adapter toi uu sau capability detect.
- [ ] Texture update chi khi co video frame moi.
- [ ] Xu ly CORS, decode failure, stale request va dispose.
- [ ] Tach audio cua video theo policy ro rang de tranh double playback.

### Gate hoan thanh

- AV sync fixture 10 phut dat drift budget.
- Rapid seek khong hien frame cu sau revision moi.
- Pixi khong con `Texture.WHITE` fallback im lang cho video production capability.
- Preview va export giong nhau ve trim/rate/loop/fade.

## 15. Phase 8 - Preview performance va incremental invalidation

### Muc tieu

Tan dung retained-mode cua Pixi thay vi rebuild frame mot cach co hoc.

### Cong viec

- [ ] So sanh item fingerprint va chi update transform/style/geometry khi doi.
- [ ] Khong `Graphics.clear()` neu geometry/style fingerprint khong doi.
- [ ] Cache va reuse filters; cap nhat uniforms thay vi tao filter moi frame.
- [ ] Khong set lai TextStyle neu field khong doi.
- [ ] Khong clear painter khi chi doi viewport/background/selection.
- [ ] Dung Pixi ticker khi pause; render on-demand sau paint/asset/frame update.
- [ ] Adaptive render resolution theo `interactive`, `playback`, `final`.
- [ ] Tach composition resolution va CSS display size; khong scale world sai coordinate semantics.
- [ ] Interaction overlay dung imperative snapshot/external store, tranh React tree rerender moi frame.
- [ ] Cache static subtree thanh render texture khi loi ich vuot chi phi invalidation.
- [ ] Them profiler HUD tu metrics, chi bat o dev.

### Gate hoan thanh

- Dat performance budgets tren fixture matrix.
- Pause khong ton CPU/GPU render lien tuc.
- Pointer drag khong compile project va khong recreate static drawables.

## 16. Phase 9 - Worker va frame buffering theo so lieu

### Muc tieu

Chi dua viec sang worker khi benchmark cho thay loi ich lon hon transfer/synchronization cost.

### Thu tu thu nghiem

1. Main-thread prepared runtime + Pixi retained painter.
2. Worker compile/preparation, main-thread evaluate + paint.
3. Worker evaluate, transfer compact frame diff/display list, main-thread Pixi paint.
4. Playback-only OffscreenCanvas worker + frame buffer nhu ClipKit.

### Cong viec

- [ ] Version protocol worker va sequence IDs.
- [ ] Dung transferable typed arrays cho geometry neu can.
- [ ] Do serialize/transfer time rieng voi evaluate time.
- [ ] Buffer look-ahead chi khi playing, khong dung cho pointer drag latency-sensitive.
- [ ] Co buffer invalidation dung thu tu: invalidate -> patch/source -> produce.
- [ ] Co starvation fallback va final refine khi pause.
- [ ] Video decoder/provider co main-thread fallback neu worker khong truy cap duoc media API.
- [ ] Feature detect va fallback main-thread, khong tach behavior semantics.

### Gate hoan thanh

- Chi merge mot worker mode neu p95 frame time/drop rate tot hon baseline tren project nang.
- Interactive edit khong tang input latency qua budget.
- Worker va main-thread mode cho cung frame fingerprints/pixels.

## 17. Phase 10 - Export/render determinism va parity

### Muc tieu

Export la mot consumer khac cua cung Runtime IR/frame contract, khong phai engine thu hai.

### Cong viec

- [ ] Render job compile dung mot compiler version duoc pin.
- [ ] Tao `RenderManifest` voi project hash, runtime hash, asset/font hashes, FPS, dimensions va capability fingerprint.
- [ ] Remotion painter thuc thi day du compositing semantics.
- [ ] Audio export doc cung AudioRenderPlan.
- [ ] Loai bo CSS animation/timing/camera logic doc lap trong Remotion.
- [ ] Tao real pixel parity: Pixi canvas capture so voi export still cung frame.
- [ ] Tach tolerance theo text rasterization, image, gradient, blur, mask va blend.
- [ ] Golden frames cho before/start/middle/end/after va transition overlaps.
- [ ] Verify deterministic render lap lai tren cung environment.
- [ ] Preflight reject capability khong production thay vi render gan dung.

### Gate hoan thanh

- Semantic, structural va visual parity deu co CI gate.
- Export worker khong parse authoring semantics khac compiler chinh.
- Manifest du de reproduce va debug mot render job.

## 18. Phase 11 - Perspective 3D implementation

Phase nay chi bat dau khi Phase 1-10 dat gate lien quan.

### Muc tieu

Them plane-based perspective camera giong huong ClipKit ma giu 2D fast path.

### Cong viec schema/compiler

- [ ] Them optional `z`, `rotationX`, `rotationY`, `rotationZ` va neu can `scaleZ` voi defaults backward-compatible.
- [ ] Them camera pose va lens: position, rotations/target policy, FOV hoac focal length, near/far.
- [ ] Keyframe/property capability cho channels 3D.
- [ ] Migration va schema limits de tranh NaN/extreme projection.
- [ ] Compiler resolve 3D channels thanh literal tracks.

### Cong viec runtime

- [ ] Them `Mat4`, compose local/world matrix va inverse camera pose.
- [ ] Tao perspective projection trong pixel space.
- [ ] Identity/flat pose tra 2D fast path khi co the.
- [ ] Project plane thanh quad, clip near plane va tao depth key.
- [ ] Depth sort theo eye-space Z voi stable tie-break.
- [ ] Group khong flatten duoc giu hierarchy; group mask/effect render offscreen roi project nhu mot plane.
- [ ] Hit-test projected quad; mesh/ray-plane chi them khi can.
- [ ] Bounds/selection overlay biet projected corners.

### Cong viec painter

- [ ] Pixi `affine-2d` tiep tuc dung display objects hien tai.
- [ ] `projected-quad` dung Mesh/texture plane va shader phu hop.
- [ ] Text/vector co policy raster-to-texture khi bi nghieng perspective.
- [ ] Video texture map len projected quad.
- [ ] Remotion/export co cung projection output, khong tu tinh camera.
- [ ] Flat stage view hoat dong doc lap voi persisted camera.

### Gate hoan thanh

- Identity 3D camera khop fixture 2D cu.
- X/Y rotation, camera dolly, depth sort, nested parent va offscreen group co parity.
- AI/editor capability chi mo sau khi full ledger xanh.

## 19. Phase 12 - Reliability, observability va production hardening

### Cong viec

- [ ] Error taxonomy cho parse, compile, evaluate, asset, media, paint va export.
- [ ] Diagnostics co project path, scene/node/clip ID, capability va frame/time.
- [ ] Cancellation/dispose tests cho async compile, asset load, audio decode, video seek va worker frame.
- [ ] Fuzz tests cho schema limits, cycles, invalid references va non-finite values.
- [ ] Long-run playback va memory soak tests.
- [ ] Metrics khong chua noi dung user/asset URL nhay cam.
- [ ] Compatibility matrix browser/GPU va fallback policy.
- [ ] Version/migration policy cho Authoring IR, Runtime IR, Paint contract va Worker protocol.
- [ ] Release checklist va rollback flag cho playback/worker/3D modes.

### Gate hoan thanh

- Failure co diagnostic ro, khong crash im lang hoac paint stale frame.
- Co the tat feature moi bang capability/feature flag ma khong doi document.
- Load/play/seek/patch/dispose lap lai khong leak.

## 20. UI web va desktop de sau core

Chi bat dau redesign UI sau khi cac phase loi lien quan dat gate. Cong viec UI sau nay gom:

- adapter mount cung `PlaybackEngine` va `StageRendererPort`;
- transport controls gui command, khong so huu clock;
- timeline doc canonical project projection;
- diagnostics/performance overlay;
- camera/flat stage toggle;
- inspector capability-driven tu schema registry;
- selection overlay doc `CompositionInteractionSnapshot`.

Web va desktop co the khac visual design, nhung khong duoc khac behavior logic.

## 21. Thu tu PR de xuat

Moi PR nen nho, co fixture va co rollback ro rang.

1. `core-00`: capability inventory, benchmark harness, deterministic rules.
2. `core-01`: canonical timeline model va editor projection/transactions.
3. `core-02`: prepared indexes, stable topology va asset map.
4. `core-03`: runtime patch/revision/invalidation protocol.
5. `core-04`: projection abstraction + exact 2D fast-path tests.
6. `core-05`: `EvaluatedCompositionFrame` va multi-layer composition.
7. `core-06`: transitions duoc evaluate/paint that su.
8. `core-07`: paint contract v2 va compositing validator.
9. `core-08`: Pixi group/layer/mask/offscreen correctness.
10. `core-09`: text/image/path parity va unsupported diagnostics.
11. `core-10`: playback engine + AudioContext transport.
12. `core-11`: audio scheduler + AudioRenderPlan parity.
13. `core-12`: video frame provider + Pixi video texture.
14. `core-13`: retained painter dirty diff + render-on-demand.
15. `core-14`: real Pixi/Remotion pixel parity gates.
16. `core-15`: worker experiments va benchmark decision.
17. `core-16`: render manifest va deterministic export hardening.
18. `core-17`: perspective 3D schema/runtime behind feature flag.
19. `core-18`: Pixi/Remotion projected-quad painter parity.
20. `core-19`: reliability, soak tests va production rollout.

## 22. Quy tac khong duoc pha trong qua trinh trien khai

- Khong dua animation semantics vao Pixi, Remotion, React hoac CSS.
- Khong co playback clock thu hai trong editor store/component.
- Khong compile trong RAF.
- Khong silent-ignore paint command production.
- Khong de preview va export dung cach quantize frame khac nhau.
- Khong mo schema/capability cho AI truoc full pipeline gate.
- Khong them worker chi vi worker nghe co ve nhanh hon; phai co benchmark.
- Khong ep moi 2D project di qua Mat4/perspective path.
- Khong redesign web/desktop trong PR core neu khong can de noi adapter.
- Khong merge performance optimization lam thay doi output ma khong co parity fixture.

## 23. Definition of Done cho core engine

Core logic duoc xem la san sang cho giai doan UI khi:

- [ ] Timeline canonical duy nhat da duoc web, desktop, preview va export dung chung.
- [ ] Compiler co prepared indexes va incremental patch/invalidation.
- [ ] Composition evaluator ho tro active layers va transitions day du.
- [ ] Paint contract the hien day du group, mask, offscreen, effect va blend semantics.
- [ ] Pixi preview ho tro production capability ledger ma khong silent fallback.
- [ ] Playback dung AudioContext master clock va dat AV sync budget.
- [ ] Image/video/audio lifecycle, seek va dispose on dinh.
- [ ] Paused preview render on-demand; playback dat frame budget.
- [ ] Remotion/export doc cung Runtime IR, frame contract va audio plan.
- [ ] Semantic, structural va real pixel parity deu xanh.
- [ ] Worker mode, neu co, la optimization co benchmark va fallback.
- [ ] Projection/geometry contracts da 3D-ready trong khi 2D fast path giu parity.
- [ ] Full 3D van sau feature flag cho den khi capability gate xanh.
- [ ] Reliability, diagnostics, memory soak va deterministic export dat gate.

## 24. Ket luan chien luoc

Truong phai nen theo la:

```text
Runtime-first
  + composition-level frame contract
  + retained Pixi preview
  + AudioContext-driven playback
  + renderer parity
  + optional worker by measurement
  + 2D fast path / 3D projection seam
```

Giu Pixi lam interactive preview engine. Hoc ClipKit o transport clock, audio scheduler, source-vs-patch invalidation, frame revision/buffering va camera nam trong runtime transform pipeline. Khong sao chep nguyen mo hinh full-frame worker vao editor truoc khi profiler chung minh day la bottleneck.
