# Inspector V2 — kế hoạch UI/UX và trường dữ liệu

## Mục tiêu

Thiết kế lại inspector bên phải trong `EditorShell` đang có, dùng `MotionProtocolV2`
làm nguồn dữ liệu. Inspector phải ngắn gọn, chỉnh được field đúng với layer đang chọn,
không hiển thị raw JSON để người dùng chỉnh thường xuyên và không tạo một editor mới.

Tham chiếu Clipkit: inspector được thể hiện như một panel tối giản theo selection, chỉ
đưa các giá trị trực tiếp như `x`, `y`, font, weight và animation preset ra trước.
Timeline và inspector cùng ghi vào một schema/project document. [Clipkit editor](https://www.clipkit.dev/)

## Quy ước UX

- Inspector chỉ có một tab mặc định: **Properties**. Không đưa Diagnostics trở lại tab.
- Không chọn layer: hiện **Composition** và hướng dẫn chọn một layer.
- Chọn một layer: header identity cố định, sau đó là các section accordion theo loại layer.
- Multi-select: chỉ cho phép những field dùng chung; field khác nhau hiển thị `Mixed`.
- Mỗi field commit khi `Enter` hoặc `blur`; slider/color có debounce. Không mutate document
  ở từng ký tự đang gõ.
- Lỗi schema/command hiển thị inline dưới field, giữ giá trị document trước đó.
- `order` không là input số công khai. Paint stack dùng action **Bring forward / Send backward**
  để bảo đảm sibling order luôn unique.

## Bố cục đề xuất

```text
┌ Properties ───────────────────────────┐
│ [type icon] layer name          • V2  │  sticky identity header
│ Shape · 00:03.20–00:08.20             │
├────────────────────────────────────────┤
│ TIMING                            ˅    │
│ Start       [ 3.20 ]  Duration [ 5 ]   │
│ End         [ 8.20 ]  (read-only)      │
├────────────────────────────────────────┤
│ TRANSFORM                         ˅    │
│ X           [ 640  ]  Y        [ 360 ] │
│ W           [ 640  ]  H        [ 360 ] │
│ Scale X     [ 100% ] Scale Y   [ 100%] │
│ Rotation    [ 0°   ] Opacity   [ 100%] │
│ [align left | center | right]          │
│ Anchor      [ 3×3 pivot presets ]      │
├────────────────────────────────────────┤
│ APPEARANCE                        ˅    │
│ Fill        [ color swatch ]           │
│ Stroke      [ color ]  Width [ 0 ]     │
│ Radius      [ 0 ]                      │
├────────────────────────────────────────┤
│ type-specific section(s)               │
├────────────────────────────────────────┤
│ COMPOSITING                       ˅    │
│ Blend       [ Normal ▾ ]               │
│ Stack       [ ↓ Back ] [ ↑ Forward ]   │
└────────────────────────────────────────┘
```

### Nguyên tắc visual

- Giữ nền/panel/token hiện có của `EditorShell`; không dựng theme mới.
- Header inspector và header selection sticky; body cuộn độc lập.
- Section uppercase 10px, field label 11px, control 12px; cùng compact scale với header mới.
- Numeric controls theo grid hai cột; `X/Y`, `W/H`, `Scale X/Y` luôn nằm một hàng.
- Không bọc từng section thành card. Dùng separator mảnh và accordion để giống nhịp tối giản
  của Clipkit hơn là một form dài.
- Icon chỉ dùng cho type và action; label vẫn là nguồn thông tin chính.

## Ma trận field

| Section | Tất cả visual layer | Text | Shape | Image | Video | Group | Audio clip |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identity | id, type, parent (read-only) | ✓ | ✓ | ✓ | ✓ | ✓ | track + clip id |
| Timing | start, duration, end (derived) | ✓ | ✓ | ✓ | ✓ | ✓ | start, duration, trim |
| Transform | x/y, frame w/h, scale x/y, rotate z, opacity, anchor x/y | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Text | — | content, font asset, size, line height, letter spacing, align, vertical align, language | — | — | — | — | — |
| Appearance | — | fill | fill, stroke, stroke width, radius | fit, crop | fit | — | — |
| Media | — | — | — | asset, fit, crop | asset, fit, trim start/end, loop, muted, frame policy | — | asset, gain, pan, loop, fades |
| Compositing | blend mode | ✓ | ✓ | ✓ | ✓ | mask controls | — |
| Effects | ordered effect list when capability exists | ✓ | ✓ | ✓ | ✓ | — | — |
| Stack | bring forward / send backward | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |

`End` là derived (`start + duration`) nên không nhận input trong phase đầu.
`Font weight` là metadata của font asset ở Protocol V2, vì vậy UI chọn font asset thay vì
tạo một weight number không có nơi lưu hợp lệ.

## Phases và checklist

## Phase 0 — Contract và inventory

- [x] **I0.1 — Audit field:** lập mapping chính xác từ `MotionProtocolV2` đến từng control UI;
  không thêm field không có trong schema.
- [x] **I0.2 — Selection states:** chốt empty, single visual layer, single audio clip, multi-select
  và group selection.
- [x] **I0.3 — Command boundary:** mọi edit đi qua `V2EditorCommand`/transaction + history;
  không sửa object React/Zustand trực tiếp.
- [x] **I0.4 — Stack policy:** thay input `order` bằng commands reorder sibling deterministic.

**Nghiệm thu Phase 0**

- [x] Có field matrix được review và không có raw `order` editor.
- [x] Có fixture cho text, shape, image, video, group và audio.

## Phase 1 — Inspector shell theo bố cục Clipkit

- [x] **I1.1 — Giữ folder cũ:** refactor trong `apps/web/components/editor/inspector/`;
  `SchemaInspector` vẫn là entry point.
- [x] **I1.2 — Sticky selection header:** type icon, layer name, type/timing summary, V2 badge.
- [x] **I1.3 — Accordion primitive:** section không card, separator mảnh, state mở/đóng theo session.
- [x] **I1.4 — Compact field primitives:** numeric grid, text input, textarea, select, color swatch,
  read-only derived row và inline error.
- [x] **I1.5 — Empty/project state:** không chọn layer thì hiện composition width/height/FPS/background
  và CTA chọn layer.

**Nghiệm thu Phase 1**

- [x] Panel đọc rõ ở width inspector hiện có và scroll chỉ nằm trong body.
- [x] Một selection thể hiện được identity, timing và transform mà không mở JSON.

## Phase 2 — Common visual controls

- [x] **I2.1 — Timing:** start, duration, derived end; validation non-negative/positive ngay tại field.
- [x] **I2.2 — Transform:** x/y, width/height, scale x/y, rotation Z, opacity percent UI ↔ normalized
  `0..1` Protocol V2.
- [x] **I2.3 — Alignment actions:** left/center/right + top/middle/bottom, hạ xuống transform numeric
  theo composition frame.
- [x] **I2.4 — Anchor/pivot:** thêm 3×3 preset (top-left → center → bottom-right) cùng field
  `anchor.x/y`; preset quy đổi sang local frame units (`0`, `width / 2`, `width` và tương tự
  cho height). `anchor.z` chỉ hiện trong Advanced khi có 3D transform.
- [x] **I2.5 — Compositing:** blend mode và deterministic stack actions, bảo toàn sibling uniqueness.
- [x] **I2.6 — History behavior:** drag/slider coalesce thành một history step; Enter/blur là một step.

**Nghiệm thu Phase 2**

- [x] Sửa Transform/Timing cập nhật stage, timeline và sidebar trong cùng transaction.
- [x] Đổi anchor không làm layer nhảy vị trí trên stage: command bù `translate` để giữ vị trí visual;
  có test cho scale/rotation cơ bản.
- [x] Undo/redo trả lại chính xác giá trị trước khi sửa.

## Phase 3 — Type-specific properties

- [ ] **I3.1 — Text:** content textarea, font asset selector, size, line height, tracking, horizontal/
  vertical align, language; normalize NFC trước commit.
- [ ] **I3.2 — Shape:** fill/stroke, stroke width, corner radius; control chỉ hiện khi shape hỗ trợ.
- [ ] **I3.3 — Image:** asset source read-only/link, fit, crop UI; không thêm image field ngoài schema.
- [ ] **I3.4 — Video:** asset, fit, trim start/end, loop, muted, frame policy.
- [ ] **I3.5 — Group:** parent/mask controls đúng ràng buộc direct child và blend mode.
- [ ] **I3.6 — Audio:** inspector selection adapter cho audio clips; gain, pan, loop, trim, fade in/out.

**Nghiệm thu Phase 3**

- [ ] Mỗi control chỉ xuất hiện cho layer/clip hợp lệ.
- [ ] Command invalid hiện inline error, document và preview không commit partial state.

## Phase 4 — Effects inspector hoàn chỉnh

- [ ] **I4.1 — Capability boundary:** Effects chỉ hiện cho `text`, `shape`, `image`, `video` và
  `path`; không hiện cho `group` hoặc audio vì Protocol V2 không cho các type này có `effects`.
- [ ] **I4.2 — Effects section:** thêm accordion **Effects** theo bố cục compact: số effect ở title,
  nút `+ Add effect`, danh sách ordered và empty state “Chưa có effect”. Không dùng tab riêng.
- [ ] **I4.3 — Add menu + defaults:** menu chỉ liệt kê sáu effect hiện có trong schema với default
  deterministic:
  - `Color adjust`: brightness `0`, contrast `1`, saturation `1`, hue `0`.
  - `Blur`: radius `8`.
  - `Drop shadow`: x `0`, y `8`, blur `12`, `#000000`, opacity `0.35`.
  - `Outer glow` / `Inner glow`: radius `12`, `#ffffff`, opacity `0.5`.
  - `Noise`: scale `4`, amount `0.1`, opacity `0.2`, seed stable do generator cấp.
- [ ] **I4.4 — Effect card:** mỗi effect là một row/card mảnh có drag handle, type icon, label,
  collapse caret và nút remove. Không thêm toggle enable/bypass vì field đó chưa tồn tại trong
  Protocol V2.
- [ ] **I4.5 — Typed controls:** controls chỉ theo schema của effect:
  - Color adjust: brightness, contrast, saturation, hue rotate.
  - Blur: radius.
  - Drop shadow: X/Y, blur, color, opacity.
  - Outer/inner glow: radius, color, opacity.
  - Noise: scale, amount, opacity, seed.
- [ ] **I4.6 — Order UI:** kéo row hoặc dùng Move up/Move down trên keyboard; thứ tự array là thứ tự
  render nên UI không được sort theo label/type.
- [ ] **I4.7 — Command + history:** add, patch, remove và reorder thay toàn bộ `effects` array qua
  một `patch-layer` transaction; mỗi action có inverse/history duy nhất và không commit partial
  array khi validation fail.
- [ ] **I4.8 — Guardrails:** ID effect unique, tối đa 8 effects/layer, color/number range theo
  `V2EffectListSchema`; ẩn/disable menu khi đạt limit, inline error khi document bị reject.
- [ ] **I4.9 — Preview parity:** render preview ngay sau commit; blur/shadow/glow/noise phải có
  cùng thứ tự và pixel semantics với `compileProtocolV2`/export.
- [ ] **I4.10 — Tests:** defaults, every typed field, max-eight, duplicate ID rejection, reorder,
  remove, undo/redo, visual golden một effect và stacked effects.

**Nghiệm thu Phase 4**

- [ ] Có thể thêm, chỉnh, sắp xếp và xóa toàn bộ sáu effect type từ inspector.
- [ ] Preview/timeline/history đồng bộ; export compile output hợp lệ với effect array ordered.
- [ ] Group và audio không hiển thị controls effects không hợp lệ.

## Phase 5 — Multi-select, polish và accessibility

- [ ] **I5.1 — Multi-edit:** transform/opacity/timing hợp lệ cho selection cùng capability; `Mixed`
  cho giá trị khác nhau.
- [ ] **I5.2 — Keyboard:** Tab order, Enter commit, Escape revert draft, label/aria cho icon controls.
- [ ] **I5.3 — Responsive:** khi inspector bị ẩn ở breakpoint hiện tại, selection/edit vẫn không mất;
  mở lại khôi phục section state.
- [ ] **I5.4 — Tests:** unit conversion %, command/history, integration stage/timeline sync, visual regression.

**Nghiệm thu Phase 5**

- [ ] Inspector hoạt động được cho visual/audio/multi-select mà không làm lệch Protocol V2.
- [ ] Các fields và layout giữ compact, không cần scroll ngang ở width panel chuẩn.

## Ngoài phạm vi hiện tại

- Keyframe editor/graph, animation preset authoring và captions high-level sẽ
  được làm sau khi `EditorProjectV2` high-level model được nghiệm thu.
- Không đưa `trackId`/`uiOrder` vào Protocol V2 inspector; chúng thuộc high-level editor model.
