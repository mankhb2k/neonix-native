# Motion Format v2 — authoring contract

Đây là contract normative duy nhất cho `.mt` và `.mvc`. Schema thực thi nằm tại `packages/motion-schema/src/v2.ts`; API không có hậu tố version luôn trả canonical format hiện tại. Input không đúng contract bị từ chối và không có migration boundary.

## Artifact và version

```text
Project   { format: motion-project,   formatVersion: 2 }
Component { format: motion-component, formatVersion: 2, componentVersion: semver }
Patch     { format: motion-patch,     formatVersion: 1, baseRevision, operations }
```

`formatVersion` điều khiển migration schema. `componentVersion` điều khiển compatibility của public contract. Package đã publish là bất biến.

## Authoring IR và Runtime IR

```text
.mt / .mvc Authoring IR
  nodes + component nodes + variables + bindings
  preset/tracks + variable references + repeat directives
                         │ compile
                         ▼
Normalized Runtime IR
  literal nodes + literal tracks + literal key values
  không preset, variable reference, binding, repeat hoặc component package
```

Renderer chỉ đọc Normalized Runtime IR.

## Scene graph

Mọi spatial entity thuộc đúng một Scene. Component Instance là Node:

```json
{
  "id": "inst.hero",
  "type": "component",
  "parentId": null,
  "zIndex": 2,
  "transform": {},
  "payload": {
    "componentId": "comp.hero",
    "componentVersion": "1.0.0",
    "props": {}
  }
}
```

Không có top-level `instances[]`. Parenting, masking, draw order và clip targeting dùng cùng Node graph. Node ID chỉ unique trong Scene; mọi project-level target phải chứa `sceneId`.

## Public API và binding

```text
Component default variable
        ↓ overridden by instance prop mapped through Public API
Resolved component variable
        ↓ internal bindings
Internal nodes / clips / tracks
```

Project binding có độ ưu tiên cao hơn literal instance prop:

```text
Component default < Instance payload.props < Project binding
```

Khi một prop đang bound, UI sửa source Project Variable. Muốn sửa local phải detach binding trước. Một variable điều khiển nhiều target bằng nhiều binding record.

Web/AI User chỉ được sửa Project Variable và Component Node `payload.props`. Internal semantic, node, bone, clip và track chỉ dành cho Designer/AI Author.

## Resolvable value

Authoring value là literal hoặc variable reference:

```json
{
  "ref": { "kind": "variable", "id": "var.speed" },
  "map": { "scale": 1, "offset": 0 }
}
```

MVP chỉ hỗ trợ reference, numeric scale và offset. Compiler phải type-check rồi resolve trước Runtime IR; không có expression engine tổng quát.

## List và repeater

Variable list khai báo `itemSchema`. Group template có `repeat` với source, alias, stable key và layout. Binding con có source `context`, ví dụ `item.title`. Compiler clone subtree, binding và clip bằng ID deterministic; giới hạn số item là policy của compiler. Renderer không biết Repeater.

## Clip timing

- Scene duration, schedule, clip duration và key `t` đều tính bằng giây.
- Schedule là scene-relative; key `t` là clip-relative từ 0.
- `absolute.at`, `after.clipId` và `with.clipId` thay trigger/start/delay mơ hồ.
- Playback dùng `iterations`, `direction` và `rate`.
- Compiler reject dependency cycle và clip vượt policy Scene.

## Transform và camera

- `anchorX/Y` normalized trong `[0,1]`.
- `scaleX/Y >= 0`; phản chiếu chỉ dùng `flipX/Y`.
- rotation dùng degree, chiều Canvas; visible dùng step interpolation.
- Với column-vector convention, local matrix là `T(x,y) · R(rotation) · S(scale × flipSign) · T(-anchor × size)`; world matrix là `parentWorld · local` sau khi áp dụng inherit flags.
- Camera pan dùng `transform.x/y`, rotation dùng `transform.rotation`, zoom dùng duy nhất `payload.zoom`.

## Asset, dependency và offline

Asset reference luôn là ID; URI chỉ nằm trong asset manifest. Project pin mỗi Component bằng `componentId`, exact version, source và integrity. Integrity không tự bảo đảm offline: loader phải lấy đúng package từ portable bundle hoặc content-addressed cache trước khi compile.

## Timeline và audio

Project `timeline.sceneOrder` là thứ tự phát canonical. `timeline.audioTracks` chứa BGM, voiceover và SFX với start/trim/volume/loop/fade. `extensions` chỉ dành cho constraints và events chưa thuộc runtime lõi.

## Semver và semantic

Major chỉ khi public observable contract không tương thích: xóa/đổi type hoặc nghĩa prop, public semantic/control/event/slot, hoặc hành vi đã cam kết mà không migrate được. Internal ID/hierarchy không ảnh hưởng semver trừ khi đã được expose. Internal timing vẫn có thể breaking nếu làm sai bảo đảm sync công khai.

Semantic có `{ role, key?, tags[] }`. Role không unique; `key` chỉ là public address khi được expose trên Public API.
