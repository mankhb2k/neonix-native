# SVG cut-out character — schema và implementation plan

> Trạng thái: proposal, chưa phải contract normative. Chỉ chuyển nội dung sang `motion-format-v2.md` và Zod schema khi fixture tương ứng được duyệt.

Các primitive geometry/compositing/modifier dùng chung được thiết kế tại [`atomic-primitives-plan.md`](atomic-primitives-plan.md). Tài liệu này chỉ chuyên biệt hóa workflow nhân vật và Figma import.

Catalog object và fixture coverage dùng chung: [`primitives-object.md`](primitives-object.md).

## Mục tiêu sản phẩm

MotionVideo phải dựng được video limited/cut-out 2D từ thiết kế SVG có sẵn: nhân vật nhiều bộ phận, hội thoại, idle/blink/talk, cử chỉ tay, walk cycle đơn giản, prop attachment, camera shot và audio hoàn chỉnh.

Không đặt mục tiêu frame-by-frame drawing, mesh skinning, weight paint hoặc organic deformation trong giai đoạn này.

## Luồng Figma → MotionVideo

```text
Figma layers/groups
        ↓ export SVG
SVG Importer đọc element tree
        ↓
Rig Mapper trong app
  multi-select paths → create Part
  rename display/semantic name
  chọn part, parent và draw order
  đặt pivot/joint
  gán mouth/eye/hand variants
        ↓ publish
Motion Component (.mvc)
  Node graph + extracted SVG part assets
  cut-out rig metadata + named actions
        ↓ compile
Runtime literal nodes + tracks
```

Designer không bắt buộc tạo group hoặc đặt tên hoàn hảo trong Figma. Tên layer/group chỉ là gợi ý import. Với SVG phẳng, người dùng có thể chọn nhiều path trên canvas/tree, tạo Part mới rồi đặt tên trong app. ID Figma không được dùng trực tiếp làm canonical Node ID vì có thể đổi sau khi duplicate/re-export.

App tạo ID ổn định, còn mapping source được lưu để re-import và reconciliation.

## Quy tắc import

- Chỉ nhận SVG không chứa script, external URL hoặc executable content.
- Giữ `viewBox`, fill/stroke, clipping và transform cần thiết.
- Mỗi group có sẵn hoặc tập path được người dùng gom thành body part sẽ được trích thành asset SVG độc lập khi publish.
- Raw SVG là source authoring; renderer chỉ nhận asset part đã normalize.
- Rename trong app thay `name`/`semantic`, không tự đổi Node ID đã publish.
- Re-import so khớp bằng source element ID + structural fingerprint; conflict phải hỏi người dùng.
- Pivot lưu bằng transform/node metadata, không phụ thuộc CSS `transform-origin` của SVG.

## Tận dụng contract hiện có

- Node graph hiện tại tiếp tục là hierarchy duy nhất.
- Joint dùng Node `type: "bone"`; không tạo skeleton graph thứ hai.
- Part dùng Node `type: "svg"` và `parentId` trỏ vào Bone/Group.
- `Transform.anchorX/Y` là pivot trong bounds của part; Bone kích thước 0 quay quanh local origin.
- Mouth/eye/hand replacement dùng string step track.
- Component public props vẫn là bề mặt chỉnh sửa của Project/Web/AI User.
- Sau compile, rig/action/variant metadata phải biến mất; Runtime IR chỉ còn node và track literal.

## Schema đề xuất

### Import metadata trong Component

```ts
type SvgSourceImport = {
  kind: "svg";
  sourceAssetId: string;
  sourceIntegrity: string;
  parts: Array<{
    sourceElementIds: string[];
    structuralFingerprint: string;
    nodeId: string;
    outputAssetId: string;
    originalName?: string;
  }>;
};
```

Metadata này chỉ phục vụ Designer/re-import, không đi vào Runtime IR.

### Typed payload tối thiểu

```ts
type SvgPartPayload = {
  assetId: string;
};

type BonePayload = {
  length?: number;
  rotationLimits?: { min: number; max: number };
};
```

Node `svg` và `bone` vẫn thuộc Scene Node graph. Reference validator kiểm tra asset, parent, cycle và rotation limits.

### Variant slot

```ts
type CutoutVariantSlot = {
  id: string;
  nodeId: string;
  semanticRole: "mouth" | "eyes" | "hand" | "expression" | string;
  defaultVariantId: string;
  variants: Array<{
    id: string;
    assetId: string;
    semantic?: string;
  }>;
};
```

Ví dụ mouth slot dùng `rest`, `A`, `E`, `O`, `M`, `F`. Compiler map variant thành `payload.assetId` literal; renderer không biết khái niệm viseme.

### Cut-out rig metadata

```ts
type CutoutRig = {
  kind: "cutout";
  rootNodeId: string;
  slots: CutoutVariantSlot[];
};
```

Hierarchy/pivot nằm trên Nodes. `rig` chỉ khai báo root và variant slots, không lặp lại parent graph.

### Named component action

```ts
type MotionAction = {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  clips: MotionClip[];
};
```

Component có `actions[]` như `idle`, `blink`, `talk`, `wave`, `point`, `walk`. Default `clips[]` hiện tại vẫn dành cho animation luôn chạy khi instance xuất hiện.

Project gọi action trên Component Instance bằng clip source mới:

```ts
type ComponentActionSource = {
  kind: "component-action";
  actionId: string;
  params?: Record<string, ResolvableValue>;
};
```

Compiler namespace action clips, áp schedule/playback/params và sinh property tracks literal.

### Lip sync MVP

Lip sync không cần artifact riêng. Action `talk` chứa step keys trên variant slot:

```json
{
  "targetId": "mouth",
  "property": "payload.variantId",
  "keys": [
    { "t": 0.00, "v": "rest", "easing": "step" },
    { "t": 0.10, "v": "M", "easing": "step" },
    { "t": 0.18, "v": "A", "easing": "step" }
  ]
}
```

Compiler validate variant ID rồi đổi property/value thành `payload.assetId`. Auto phoneme alignment là tooling sinh keys, không phải Runtime primitive.

## Validation bắt buộc

- Source asset và mọi output part asset tồn tại, có integrity.
- Source element không được thuộc hai Part cùng lúc; Node ID, slot ID, action ID và variant ID không trùng trong scope.
- Mọi import mapping trỏ tới đúng Node/asset.
- Rig root và mọi slot node tồn tại.
- Default variant thuộc variant list; variant asset tồn tại.
- Action clip chỉ target internal Node/slot hợp lệ.
- Action schedule không cycle; keys không vượt action duration.
- Rotation limits có `min <= max`.
- Component action chỉ target Component Instance và action phải tồn tại trong package đã pin.
- Compiler output không chứa import metadata, rig, slot, action hoặc variant ID.

## Fixture suite cần xây

```text
docs/fixtures/v2/
  imports/
    figma-cutout-source.svg
    figma-cutout-import.json
    figma-cutout-reimport.json
  components/
    cutout-character.mvc.json
  projects/
    cutout-dialogue.mt.json
  expected-runtime/
    cutout-dialogue.runtime.json
  expected-frames/
    cutout-idle-0000.png
    cutout-blink-0120.png
    cutout-talk-0250.png
    cutout-wave-0400.png
```

### Import assertions

- Parse đúng nested groups, path rời và transforms từ Figma SVG.
- Multi-select paths → create Part → rename/reparent/pivot tạo canonical Node graph ổn định.
- Re-import giữ Node ID khi source không đổi.
- Removed/renamed source part tạo conflict rõ ràng.
- Reject script, external URL, duplicate ID và malformed SVG.

### Schema/reference assertions

- Positive rig có torso/head/arms/legs/mouth/eyes.
- Reject parent cycle, missing root, missing slot node/asset, invalid default variant và invalid action target.
- Validate Unicode/display names độc lập với canonical IDs.

### Compiler assertions

- Expand instance và named actions với namespace deterministic.
- Compose idle + blink + talk + gesture theo policy rõ ràng.
- Mouth variant keys compile thành `payload.assetId` step tracks.
- Loop/rate/schedule đúng và không authoring metadata lọt Runtime IR.

### Runtime/visual assertions

- World transform quay tay đúng quanh pivot.
- Parent opacity/scale/flip truyền đúng.
- SVG part, draw order, mask và prop attachment đúng pixel.
- Fixed frames khóa idle, blink, viseme và wave pose.
- Camera shot và scene transition deterministic.

### Audio/Web assertions

- Voiceover cue khớp mouth keys; BGM/SFX mix đúng timeline.
- Preview cùng timestamp khớp exported frame trong tolerance.
- Designer import, rename, set pivot, create action, save/reload và export được.

## Lộ trình triển khai

### Phase A — Runtime foundation

1. Tách evaluator/transform math dùng chung.
2. Implement world matrix, pivot, inherit flags và z-order.
3. Implement asset resolver + SVG part renderer + mask.
4. Thêm visual golden cho hierarchy/pivot trước khi làm Rig Mapper.

### Phase B — Schema/compiler

1. Chốt fixtures JSON dự kiến.
2. Thêm typed SVG/Bone payload, import metadata, rig slots và actions vào schema.
3. Thêm reference validation và negative suite.
4. Compile Component Action/variant thành Runtime IR literal và khóa golden snapshot.

### Phase C — Figma import và Rig Mapper

1. Sanitize/parse SVG tree.
2. UI tree/canvas: multi-select paths, create Part, rename, include/exclude, reparent và z-order.
3. Canvas tool đặt pivot/joint và preview rotation.
4. Variant slot editor và re-import reconciliation.

### Phase D — Character animation

1. Action/pose timeline và dope sheet.
2. Idle, blink, talk, wave và walk templates.
3. Audio waveform/cue editor và mouth-key generation.
4. Camera/scene/audio export parity.

### Phase E — Sau vertical slice

Two-bone IK, hand/foot pin, motion path, action blending và simple constraints chỉ bắt đầu sau khi `cutout-dialogue.mt.json` pass compiler, visual, audio và Web acceptance tests.

## Acceptance gate

Vertical slice hoàn tất khi một project 20–30 giây có hai nhân vật SVG rig, hội thoại, idle/blink/talk, một gesture, prop attachment, nhiều camera shots, voiceover/BGM/SFX và preview khớp MP4 export.
