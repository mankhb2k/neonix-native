# Kế hoạch PixiJS Web Preview và Render E2E

> **Mục tiêu:** AI tạo motion project từ brief, kết quả xuất hiện ngay trên timeline và PixiJS stage, người dùng có thể chọn/sửa từng phần tử, sau đó xuất MP4 bằng cùng compiler/runtime semantics.
>
> **Quyết định engine:** PixiJS là preview renderer tương tác cho Web. `MotionProject` là source of truth. Render worker + FFmpeg là pipeline xuất video. Remotion không nằm trong core path và chỉ được giữ tạm như fallback trong thời gian cutover.

## 1. Kết quả sản phẩm cần đạt

Một người dùng phải hoàn thành được luồng sau:

1. Nhập ý tưởng, kịch bản, tỷ lệ khung hình và brand.
2. AI lập creative plan và sinh typed motion commands.
3. Command executor tạo hoặc sửa `MotionProject` hợp lệ.
4. Project được compile thành Runtime IR.
5. Timeline hiển thị scene, layer, clip và thời lượng vừa tạo.
6. PixiJS preview đúng frame đang chọn trên timeline.
7. Người dùng click vào text, shape, image hoặc group để chọn và sửa.
8. Play, pause, seek và scrub không làm thay đổi animation semantics.
9. Export tạo MP4 có hình ảnh, timing và audio khớp preview trong tolerance đã định nghĩa.
10. Mọi lỗi AI, asset, compile hoặc render đều có diagnostic rõ ràng; không silently bỏ qua capability.

Luồng hoàn chỉnh:

```text
Brief / script / brand
          │
          ▼
AI CreativePlan + SceneDesignPlan
          │
          ▼
Typed Motion Commands
          │ validate + execute atomic
          ▼
MotionProject + editor timeline envelope
          │
          ├────────────── save / undo / user edit
          │
          ▼
Motion Compiler
          │
          ▼
Normalized Runtime IR
          │
          ▼
Shared Evaluator + RenderPlan/PaintCommands
          │
          ├── PixiJS adapter ──► Web preview + hit-test overlay
          │
          └── Worker adapter ──► raster frames ──► FFmpeg ──► MP4
```

## 2. Nguyên tắc không được phá vỡ

### 2.1 AI không sinh executable animation code

Trong tài liệu này, “AI tạo code motion” có nghĩa là AI sinh dữ liệu và command thuộc vocabulary đóng của MotiClip:

```json
{
  "type": "setKeyframes",
  "sceneId": "scene.hero",
  "nodeId": "title",
  "property": "transform.opacity",
  "keys": [
    { "t": 0, "value": 0 },
    { "t": 0.4, "value": 1, "easing": "ease-out" }
  ]
}
```

AI không được sinh:

- CSS animation hoặc transition làm source of truth;
- React/TSX composition tùy ý;
- JavaScript expression chạy trong project;
- PixiJS shader/plugin tùy ý;
- URL hoặc asset ID chưa được asset registry chấp nhận;
- property, node, effect hoặc recipe ngoài capability manifest.

### 2.2 Một clock và một evaluator

- Frame canonical là số nguyên.
- `time = frameIndex / fps`.
- Preview, scrub, contact sheet và export đều evaluate bằng cùng timestamp.
- PixiJS không tự chạy tween.
- React không tự tính animation value.
- Timeline không giữ một bản animation semantics riêng.

### 2.3 Renderer không đọc Authoring IR trực tiếp

Renderer chỉ nhận dữ liệu đã được compiler/runtime chuẩn hóa:

```text
MotionProject
  → Normalized Runtime IR
  → Evaluated Scene
  → RenderPlan / PaintCommands
  → renderer adapter
```

Preset, component instance, binding, repeater, layout recipe và AI intent phải được resolve trước renderer.

### 2.4 Stable identity xuyên suốt hệ thống

Mỗi object cần giữ stable ID qua:

```text
AI command
→ MotionNode.id
→ timeline layer/clip reference
→ RenderSnapshotItem.key
→ Pixi DisplayObject
→ selection
→ inspector
→ scoped AI regeneration
```

AI sửa nội dung không được tự ý đổi ID của node còn cùng vai trò.

## 3. Baseline code hiện tại

### Đã có và nên giữ

- `MotionProject` v2 và strict parser.
- Motion compiler và deterministic evaluator.
- Timeline document, commands, history, selection và playback clock.
- `StageRendererPort` ở desktop chứng minh seam imperative phù hợp cho GPU renderer.
- `RenderSnapshot` và stable-key adapter skeleton.
- Render worker dùng `@napi-rs/canvas`, worker threads và FFmpeg.
- Export API Web đã gọi render-worker CLI.
- AI planner đã có gateway, orchestrator, typed command executor, critic và repair seam.

### Chưa hoàn thiện

- `packages/pixi-renderer` chưa có dependency `pixi.js` và chưa tạo Pixi display objects thật.
- Web stage vẫn dùng `@remotion/player`.
- Web interaction overlay hiện chưa theo frame đang phát trong mọi trường hợp.
- Web preview chỉ đi qua subset nhỏ của `RenderSnapshot`.
- `RenderSnapshot` chưa biểu đạt đầy đủ path, video, gradient, stroke, masks, effects và blend.
- Worker renderer đang diễn giải nhiều rendering detail trực tiếp, chưa consume một command buffer hoàn toàn chung với preview.
- Preview/export pixel parity chưa phải release gate tự động đáng tin cậy.
- AI live generation và asset ingestion cần được kiểm thử E2E với MP4 thật.

## 4. Kiến trúc đích

### 4.1 Package ownership

| Package/App | Trách nhiệm |
|---|---|
| `packages/motion-schema` | Canonical authoring contract, limits và capability registry |
| `packages/ai-planner` | Brief → plans → typed commands → bounded repair |
| `packages/editor-core` | Timeline, commands, selection, history và document mutations |
| `packages/motion-compiler` | Authoring IR → normalized Runtime IR |
| `packages/motion-runtime` | Clock, evaluator, transforms, hit-test và RenderPlan/PaintCommands |
| `packages/pixi-renderer` | Runtime render data → Pixi display tree; không chứa domain semantics |
| `apps/web` | Editor shell, Pixi mount, DOM interaction overlay, API và persistence |
| `apps/render-worker` | Headless raster adapter, frame scheduling, FFmpeg và audio mix |

Dependency direction:

```text
apps/web ───────────────┐
packages/pixi-renderer ─┼──► motion-runtime ─► motion-compiler ─► motion-schema
apps/render-worker ─────┘

ai-planner ─► typed commands ─► editor-core / motion-schema
```

Không package logic nào được import ngược từ `apps/web`.

### 4.2 RenderFrame contract

Không mở rộng `RenderSnapshot` thành object tùy ý. Cần khóa một trong hai lựa chọn:

1. Mở rộng `RenderSnapshot` thành display list đầy đủ; hoặc
2. Giữ `RenderSnapshot` cho interaction và thêm `PaintCommandBuffer` cho raster.

Khuyến nghị dùng hai contract có liên kết stable key:

```ts
type EvaluatedFrame = {
  frame: number;
  time: number;
  sceneId: string;
  interaction: RenderSnapshot;
  paint: PaintCommandBuffer;
  diagnostics: RenderDiagnostic[];
};
```

`PaintCommandBuffer` tối thiểu cần hỗ trợ:

- save/restore transform;
- group begin/end;
- text run;
- rectangle, ellipse, polygon và path;
- solid/gradient fill;
- stroke, dash và trim-path;
- image/SVG/video frame;
- opacity và blend mode;
- clip/matte/mask;
- isolated offscreen pass;
- ordered effects;
- camera projection;
- motion-blur sample composition.

Pixi và worker có thể dùng API raster khác nhau, nhưng không được tự quyết định lại evaluation order.

## 5. PixiJS Web Stage

### 5.1 `PixiStageRenderer` contract

Renderer Web nên có imperative API:

```ts
type PixiStageRenderer = {
  mount(host: HTMLElement): Promise<void>;
  setProject(runtime: NormalizedMotionProjectV2): void;
  paintFrame(frameIndex: number): RenderSnapshot;
  setViewport(viewport: StageViewport): void;
  setQuality(tier: "interactive" | "high"): void;
  dispose(): void;
};
```

React chỉ sở hữu mount/unmount và document revision. Tick playback không chạy qua React state reconciliation.

### 5.2 Display-object cache

Ánh xạ khuyến nghị:

| Runtime item | Pixi object |
|---|---|
| Group | `Container` |
| Text | `Text` hoặc bitmap/MSDF text adapter sau benchmark |
| Shape | `Graphics` |
| Path | `Graphics`/path geometry adapter |
| Image | `Sprite` |
| SVG | Texture hoặc vector adapter theo import mode |
| Video | `Sprite` với managed video texture |
| Isolated group | `RenderTexture` pass |

Mỗi frame:

1. Evaluate frame một lần.
2. Tìm object bằng stable key.
3. Chỉ tạo object mới khi key chưa tồn tại hoặc payload kind đổi.
4. Cập nhật transform, alpha, visibility, z-order và payload bị dirty.
5. Xóa object không còn trong live set.
6. Render stage.

Không destroy/recreate toàn bộ Pixi Application khi seek hoặc sửa một property.

### 5.3 Viewport và coordinate space

Phân biệt ba coordinate space:

- composition space: tọa độ canonical của project;
- stage viewport space: pan/zoom/fit trong editor;
- DOM client space: pointer và overlay.

Chỉ có một utility chuyển đổi giữa ba hệ tọa độ. Selection overlay và hit-test phải dùng cùng world matrix/bounds từ runtime, không đoán lại bằng DOM layout.

### 5.4 Interaction overlay

Giữ handles trong DOM/React trên canvas Pixi:

```text
DOM selection handles / guides / context UI
───────────────────────────────────────────
Pixi canvas: video pixels
───────────────────────────────────────────
Runtime snapshot: bounds + world matrices
```

Pixi chịu trách nhiệm pixels. Editor-core chịu trách nhiệm selection và command. DOM overlay chịu trách nhiệm affordance.

## 6. Timeline và playback

### 6.1 Single playback driver

Timeline playback driver phát ra frame canonical:

```text
requestAnimationFrame
→ elapsed wall time
→ target frame theo fps
→ clock.setFrame(frame)
→ pixi.paintFrame(frame)
→ overlay.update(snapshot)
```

Wall time chỉ dùng để quyết định frame tiếp theo; evaluator không đọc wall time trực tiếp.

### 6.2 Seek và scrub

- Pointer move trên ruler cập nhật frame có quantization.
- Có thể bỏ frame trung gian khi scrub nhanh, nhưng luôn render frame cuối cùng.
- Compile không chạy lại khi chỉ thay current frame.
- Document revision mới mới invalidate compiled runtime.
- Asset load không được block UI thread; renderer hiển thị diagnostic placeholder có chủ ý.

### 6.3 Timeline sau AI generation

AI output phải được apply bằng một transaction:

```text
AI command batch
→ validate toàn batch
→ execute vào draft
→ compile probe
→ commit project + timeline envelope
→ một history entry
→ select primary generated node/scene
→ seek về frame đầu scene
```

Nếu bất kỳ command hoặc compile probe nào thất bại, rollback toàn batch.

## 7. AI generation E2E

### 7.1 Request

Input tối thiểu:

```ts
type GenerateVideoRequest = {
  prompt: string;
  script?: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationHint?: number;
  brand?: BrandInput;
  suppliedAssets?: AssetInput[];
  seed?: string;
};
```

### 7.2 Generation passes

```text
Brief parser
→ CreativePlan
→ SceneDesignPlan[]
→ asset requests
→ typed command batches
→ command validation/execution
→ compile probe
→ contact-sheet/probe frames
→ visual critic
→ tối đa 2 repair rounds
→ accepted MotionProject
```

Model chỉ nhận capability manifest đã implement. Capability mới chỉ được expose khi có:

- schema;
- command executor;
- compiler/evaluator;
- Pixi adapter;
- worker adapter;
- fixture và parity test.

### 7.3 Apply vào editor

API trả về proposal, không tự ghi đè document đang mở:

```ts
type GenerationProposal = {
  baseRevision: number;
  project: MotionProject;
  timeline: TimelineDocument;
  diagnostics: Diagnostic[];
  provenance: GenerationMetadata;
};
```

Khi Apply:

- kiểm tra `baseRevision`;
- nếu document đã thay đổi, rebase hoặc yêu cầu regenerate scope;
- commit một transaction undoable;
- giữ stable IDs;
- ghi model, prompt, seed, capability và engine version ngoài Runtime IR.

### 7.4 Scoped refinement

Sau 0→1, user có thể yêu cầu:

- sửa selected node;
- sửa selected scene;
- sửa timing một clip;
- đổi art direction nhưng giữ text;
- regenerate video trong khi giữ các property đã lock.

Planner chỉ được nhận scope và patch các target hợp lệ. Không regenerate toàn project cho một chỉnh sửa nhỏ.

## 8. Export E2E

### 8.1 Export request

Web không gửi screenshot hoặc Pixi canvas lên server. Web gửi canonical project/envelope đã validate:

```text
Editor snapshot
→ bake timeline nếu cần
→ parseMotionProject
→ POST /api/export
→ persistent render job
```

### 8.2 Worker pipeline

```text
MotionProject JSON
→ strict parse
→ asset integrity validation
→ compile Runtime IR
→ deterministic frame plan
→ evaluate frame
→ shared PaintCommandBuffer
→ headless raster adapter
→ FFmpeg video encode
→ audio trim/fade/mix
→ MP4 artifact
```

Export phải pin:

- format version;
- compiler/runtime version;
- fps và frame range;
- dimensions và quality tier;
- font versions;
- asset hashes;
- random seed;
- codec/pixel format/color space.

### 8.3 Job lifecycle

```text
queued
→ validating
→ compiling
→ rendering
→ encoding
→ uploading/completed
```

Job phải có:

- progress có sequence;
- cancel;
- timeout;
- structured failure stage;
- cleanup temp artifacts;
- idempotency key để tránh render trùng.

### 8.4 Tối ưu sau khi parity đúng

Thứ tự tối ưu worker:

1. Benchmark project thực, không dùng một text node ngắn.
2. Cache font, image, SVG và decoded video frame theo worker.
3. Crop offscreen surface theo inflated bounds thay vì full-frame.
4. Tránh PNG encode/decode trung gian khi compose scene layers.
5. Pipe raw frames hoặc format phù hợp trực tiếp vào FFmpeg.
6. Dùng work-stealing/dynamic chunks nếu frame cost chênh lệch lớn.
7. Đánh giá hardware encoding sau khi raster không còn là bottleneck.

Không chuyển hotspot sang native/C++ trước khi profiler chỉ ra chi phí thật.

## 9. Preview/export parity

### 9.1 Parity harness

Với mỗi fixture:

1. Compile một lần.
2. Render các frame `before/start/middle/end/after` bằng Pixi.
3. Render đúng các frame đó bằng worker.
4. Lưu actual Pixi PNG, actual worker PNG và diff PNG.
5. So pixel theo tolerance từng primitive.
6. Fail CI nếu vượt tolerance hoặc renderer silently bỏ item.

### 9.2 Các loại parity

- semantic parity: cùng evaluated values và render order;
- geometry parity: bounds, matrices, path và camera;
- visual parity: pixels trong tolerance;
- temporal parity: duration, scene boundary và transition;
- asset parity: crop/fit, alpha và video frame;
- audio parity: trim, start, volume, fade và duration.

### 9.3 Release gate

Không quảng cáo capability là supported nếu thiếu một trong hai renderer. Capability ledger cần tách:

```text
schema | command | compiler | evaluator | pixi | worker | parity | editor
```

Chỉ capability đạt đủ cột bắt buộc mới được đưa vào AI manifest.

## 10. Lộ trình triển khai

### Phase P0 — Khóa contract và baseline

Mục tiêu: không viết Pixi adapter trên một snapshot thiếu semantics.

- Chốt `EvaluatedFrame`, `RenderSnapshot` và `PaintCommandBuffer` ownership.
- Lập capability ledger thực tế cho Web preview và worker.
- Chọn 4 primitive vertical slice: group, text, shape, image.
- Thêm fixtures có animation, hierarchy và opacity.
- Ghi baseline frame của worker.

**Exit:** cùng fixture/frame tạo evaluated data deterministic; unsupported capability fail rõ ràng.

### Phase P1 — Pixi renderer thật

- Thêm `pixi.js` vào `packages/pixi-renderer`.
- Implement Application lifecycle và resize/DPR.
- Implement Container/Text/Graphics/Sprite.
- Stable-key cache, dirty update và removal.
- Asset manager và loading diagnostics.
- Unit tests cho create/update/remove/kind-change/dispose.

**Exit:** package thực sự render pixel bằng Pixi, không chỉ sync object JavaScript.

### Phase P2 — Tích hợp Web stage và timeline

- Tạo `PixiPreview`/`PixiStageHost` trong `apps/web`.
- Nối playback clock với `paintFrame`.
- Nối seek/scrub/play/pause/loop.
- Overlay dùng snapshot của frame hiện tại.
- Thêm feature flag `pixi | remotion-fallback` trong giai đoạn chuyển đổi.
- Không recompile theo playback tick.

**Exit:** AI/demo project play và scrub đúng; không còn overlay cố định frame 0.

### Phase P3 — Click-edit 1→100

- Hit-test từ front-to-back theo render order.
- Selection, multi-selection, locked/hidden policy.
- Move/resize/rotate bằng editor commands.
- Inspector schema-driven.
- Một drag gesture tạo một coalesced history transaction.
- Property lock và user-modified metadata cho scoped AI repair.

**Exit:** user chọn và sửa mọi primitive vertical slice, undo/redo và save/reload không đổi kết quả.

### Phase P4 — AI 0→1 live path

- Nối model gateway thật sau capability manifest.
- Proposal → preview → Apply transaction.
- Asset request/ingestion cho supplied image/SVG.
- Contact sheet dùng worker hoặc Pixi capture theo cùng frames.
- Critic + tối đa hai repairs.
- Lưu provenance và diagnostics.

**Exit:** 10 briefs zero-template tạo project có thể play, select và edit mà không sinh CSS/TSX/JS.

### Phase P5 — Mở rộng visual coverage

Theo thứ tự:

1. Path + stroke + trim.
2. Gradient.
3. SVG.
4. Masks và isolated group.
5. Blend mode.
6. Blur/shadow/glow/color adjust.
7. Video texture.
8. Camera/depth/parallax.
9. Motion blur quality tier.

Mỗi mục đi theo vertical slice đầy đủ, không thêm hàng loạt schema trước renderer.

**Exit:** acceptance compositions đại diện 80% motion graphics phổ thông chạy trên Web.

### Phase P6 — Export production E2E

- Persistent render jobs thay request dài đồng bộ.
- Asset manifest/hash validation.
- Frame progress, cancel và retry policy.
- Audio/video asset fixtures.
- Pixel parity CI.
- Benchmark 1080p và 4K trên project thực.
- Tối ưu PNG/offscreen/streaming theo profiler.

**Exit:** MP4 có thể phát, duration/fps/audio đúng, sampled frames khớp Web preview.

### Phase P7 — Cutover Remotion

- Chạy Pixi làm default sau khi P2/P3 ổn định.
- Giữ Remotion fallback trong một release nội bộ.
- So crash/error/performance telemetry.
- Xóa `RemotionPreview`, `@remotion/player`, `remotion` và package adapter khi không còn caller.
- Remotion chỉ quay lại sau này dưới dạng optional external composition adapter nếu có use case rõ ràng.

**Exit:** Web preview và export production không phụ thuộc Remotion.

## 11. PR sequence khuyến nghị

### PR-1 — Render contracts

- `EvaluatedFrame` và PaintCommand types.
- Four-primitive capability ledger.
- Runtime golden tests.

### PR-2 — Pixi core

- Pixi dependency và lifecycle.
- Stable cache.
- Group/text/shape/image rendering.

### PR-3 — Web stage

- Pixi mount.
- Timeline clock integration.
- Current-frame overlay.

### PR-4 — Direct manipulation

- Hit-test.
- Selection overlay.
- Transform commands và history coalescing.

### PR-5 — AI apply flow

- Live/stub proposal.
- Atomic Apply.
- Timeline materialization và scoped refine.

### PR-6 — Export parity

- Worker consume shared paint semantics.
- Browser/worker sampled-frame diff.
- MP4 E2E fixture.

### PR-7+ — Capability vertical slices

- Path/gradient/SVG.
- Mask/effect/blend.
- Video/audio.
- Layered 2.5D.

## 12. Test strategy

### Unit

- Clock/frame conversion.
- Evaluator random access.
- Pixi stable cache.
- Asset lifecycle.
- Hit-test ordering.
- AI command rollback.
- Timeline materialization.

### Integration

- Project → compile → evaluated frame.
- Evaluated frame → Pixi display objects.
- AI proposal → Apply → timeline → preview.
- Export request → worker → MP4.

### Visual

- Stored worker goldens.
- Pixi screenshot capture.
- Diff artifacts.
- Font/image/SVG/video fixtures.

### E2E acceptance

1. AI tạo kinetic typography 6–10 giây.
2. Timeline xuất hiện ít nhất ba scene.
3. User scrub tới giữa animation.
4. User click title và sửa text.
5. User kéo product image và undo.
6. User yêu cầu AI sửa riêng CTA.
7. Export MP4.
8. Kiểm tra duration, fps, audio và sampled frames.

## 13. Performance budget ban đầu

Các con số cần được benchmark lại trên Chrome/Electron mục tiêu, nhưng release gate ban đầu:

- Không compile lại trong playback tick.
- Preview p95 dưới 16,7 ms với composition mục tiêu 100 visible nodes ở quality `interactive`.
- Seek-to-paint p95 dưới 50 ms khi asset đã cache.
- Pointer-to-overlay p95 dưới 32 ms.
- Document mutation không remount Pixi Application.
- Không tăng texture/cache vô hạn sau nhiều lần regenerate.
- 30 giây 1080p có benchmark riêng cho raster và encode.
- 4K benchmark dùng project thực có text, image, path, mask và effect.

Nếu không đạt 60 fps ở project nặng, quality tier có thể giảm effect sampling trong preview nhưng không được đổi timing hoặc authored semantics.

## 14. Files dự kiến thay đổi

### Pixi

- `packages/pixi-renderer/package.json`
- `packages/pixi-renderer/src/index.ts`
- các module mới: lifecycle, display-cache, asset-manager, paint-executor và tests.

### Runtime/compiler

- `packages/motion-runtime/src/render-snapshot.ts`
- `packages/motion-runtime/src/render-plan.ts`
- `packages/motion-runtime/src/hit-test.ts`
- `packages/motion-compiler/src/index.ts`
- capability registry/ledger liên quan.

### Web

- `apps/web/components/editor/stage/StageViewport.tsx`
- thay `RemotionPreview.tsx` bằng Pixi stage host.
- `InteractionOverlay.tsx` nhận current-frame snapshot.
- playback driver/timeline store.
- AI proposal/apply flow.
- export job UI/API.

### Worker

- `apps/render-worker/src/runtime/draw.ts`
- `apps/render-worker/src/runtime/frame-plan.ts`
- `apps/render-worker/src/runtime/frame-worker.ts`
- `apps/render-worker/src/ffmpeg/index.ts`
- export API/job persistence.

## 15. Những việc chưa làm trong MVP

- Mesh deformation, skinning hoặc weight paint.
- Organic character animation.
- Arbitrary shader do AI sinh.
- Full 3D engine.
- Frame-by-frame drawing.
- After Effects expression compatibility.
- Plugin ecosystem trước khi core parity ổn định.
- Template marketplace hoặc retrieval trước khi zero-template benchmark hoàn tất.

## 16. Definition of Done

Kế hoạch hoàn thành khi:

- Web dùng PixiJS renderer thật làm preview mặc định.
- AI chỉ sinh typed commands và project data hợp lệ.
- AI output xuất hiện đúng trên timeline bằng một transaction undoable.
- User chọn và sửa được từng element trên stage.
- Play, seek và scrub dùng cùng runtime clock.
- Preview và export dùng chung compiler/evaluator/render semantics.
- Capability unsupported không bị silently ignore.
- Export tạo MP4 có audio/timing đúng.
- Sampled Pixi frames và worker frames đạt parity tolerance.
- Benchmark preview/export được chạy trên composition thực tế.
- Remotion được loại khỏi core dependency path.

Ưu tiên thực thi là một vertical slice khép kín:

```text
AI brief
→ text/shape/image motion project
→ timeline
→ Pixi preview
→ click-edit
→ export MP4
```

Chỉ sau khi slice này chạy thật mới mở thêm path, effects, video và 2.5D depth.
