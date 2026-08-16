# MotiClip V1 Compiler / Runtime

> Trạng thái: v1
>
> Mục tiêu: authoring JSON là nguồn thật; compiler chỉ normalize/compile; runtime không mở rộng protocol.

---

## Pipeline

```text
MotionProjectV1
  → Zod + semantics + publicMotionPropertyCapabilities
  → compileMotionProjectV1
  → MotionRuntimeProject (IR)
  → evaluator / snapshot / paint
```

Public vocabulary = `publicMotionPropertyCapabilities(nodeType)`. Binding, animation, AI chỉ đường đó.

Ngôn ngữ:

- `clip` — khai báo animation trên authoring `timeline.clips`
- `keyframe` — điểm `{ t, value }` (authoring) / `{ t, v }` (runtime)
- `propertyAnimation` — output runtime đã compile từ clip / prop keyframes
- `track` — không dùng cho protocol animation V1 (audio/caption UI tracks vẫn giữ)

Runtime `propertyAnimations[]` là **internal evaluated animation units** sinh từ `timeline.clips` (và component prop keyframes). Không phải authoring. Clip nội bộ compiler (nếu còn) dùng `source.kind: "propertyAnimations"`.

---

## Compiler emit (per type)

| Type | Runtime payload / style |
| --- | --- |
| text | `payload.text`, `payload.color`, typography. Derive `style.fill` từ `payload.color` (paint đọc style; không phải authoring path). |
| shape / path | Geometry trên `payload`. Paint trên `style`. Không `payload.color`. Path `fillRule` giữ authoring (`nonzero` / `evenodd`). `morphTargets` là data tĩnh. |
| image | `assetId`, `fit` default **cover**, optional `crop`. Không `style`. |
| svg | `assetId`, `fit` default **contain**, optional `style.fill`. |
| video | `assetId`, `fit` default **cover**, `loop: false`, `muted: false`, optional trim. Không crop, không `style`. |
| component | Sealed instance: expand thành wrapper + internals. Prop keyframes → propertyAnimations trên internal paths. |

Không emit: `modifiers`, rich text runs, `modifiers.*` propertyAnimations, `payload.color` trên shape/path/svg, `style` trên image/video.

Animation nguồn compile: `timeline.clips` + component `payload.props` keyframes. **Không** ingest `extensions["com.moticlip.ai"].motionUnits`.

Variable chỉ vào layer qua `project.bindings` → public prop. Compiler **không** resolve `{ ref: { kind: "variable" } }` trên field/keyframe.

---

## Cấm V1 production

- Modifier (motion-path, path-morph, path-bend, trim-path, constraint, secondary-motion, parallax-as-modifier)
- Authoring `tracks` / public property-track language (`propertyAnimations` chỉ là runtime IR)
- AI extra motionUnits / presets như animation thứ hai
- Animate morph/bend/trim-path qua modifier — nếu cần sau này: field canonical trên payload, không modifier

---

## Known gaps (fail-closed, chưa implement paint)

Snapshot/paint chưa apply:

- Image/SVG `payload.fit` / `crop`
- Style fill/stroke **propertyAnimations** (static style vẫn vẽ)
- Video trim/loop đầy đủ (`resolveMediaTiming`)

Policy: diagnostic rõ (preview warn / export error), không silent ignore. Không tự bịa ngôn ngữ runtime để “cho chạy”.

---

## Liên kết

- [v1-format-guide.md](./v1-format-guide.md)
- [v1-animation-keyframes-guide.md](./v1-animation-keyframes-guide.md)
- [protocol-guide.md](../../packages/motion-protocol/protocol-guide.md)
