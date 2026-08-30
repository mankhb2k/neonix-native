# Atomic CSS → Protocol V2

Bảng đối chiếu mục tiêu cho HTML/CSS compiler. Protocol V2 chỉ nhận kết quả
đã resolve; selectors, cascade, inheritance, units, layout và CSS animation
semantics thuộc high-level compiler.

| CSS domain | Atomic output thực sự | V2 hiện tại / owner | Đánh giá |
| --- | --- | --- | --- |
| selectors / cascade / inheritance | resolved values | compiler | ✅ |
| CSS variables | resolved values | compiler | ✅ |
| `%`, `calc()`, units | numbers / geometry | compiler | ✅ |
| flex | frame / hierarchy | compiler | ✅ |
| grid | frame / hierarchy | compiler | ✅ |
| margin | geometry | compiler | ✅ |
| padding | geometry | compiler | ✅ |
| gap | geometry | compiler | ✅ |
| width / height / auto / min / max | frame | compiler | ✅ |
| absolute / relative positioning | frame / translate | compiler | ✅ |
| z-index | hierarchy + paint order | `parentLayerId` / `order` | ✅ |
| opacity | opacity | `opacity` | ✅ |
| translate | transform | `transform.translate` | ✅ |
| scale | transform | `transform.scale` | ✅ |
| rotate | transform | `transform.rotate` | ✅ |
| skew | transform | `transform.skew` | ✅ |
| transform-origin | resolved anchor | `transform.anchor` | ✅ |
| arbitrary `matrix()` / `matrix3d()` | ordered transform operation | `transform.operations[]` với `type: "matrix"` | ✅ protocol |
| CSS local perspective | projective transform / context | `group.render3d.perspective` | ✅ protocol |
| preserve-3d / flatten | render-group boundary | `group.render3d.transformStyle` | ✅ protocol |
| backface-visibility | backface culling | `layer.backfaceVisibility` | ✅ protocol |
| animation-* semantics | tracks | compiler → `layer.tracks` | ✅ |
| transition-* semantics | tracks | compiler → `layer.tracks` | ✅ |
| keyframe time / value | temporal primitive | `tracks[].keyframes[]` | ✅ |
| solid color | paint | shape fill | ✅ |
| linear-gradient | paint | gradient fill | ✅ |
| radial-gradient | paint | gradient fill | ✅ |
| conic-gradient | paint | shape gradient `type: "conic-gradient"` | ✅ protocol |
| complex border | path geometry | path | ✅ |
| complex border-radius | path geometry | path fallback | ✅ |
| image | texture / source | image | ✅ |
| object-fit | resolved image geometry | `fit` | ✅ |
| SVG path | path | path | ✅ |
| clip-path | mask / path | mask | ✅ |
| simple alpha/luma mask | mask | mask | ✅ |
| multi-mask composite | compositing op | cần kiểm tra | ⚠️ |
| blur | effect | blur | ✅ |
| brightness | effect | color-adjust | ✅ |
| contrast | effect | color-adjust | ✅ |
| saturation | effect | color-adjust | ✅ |
| hue-rotate | effect | color-adjust | ✅ |
| grayscale | semantic effect → color matrix | `effects[].type: "grayscale"` | ✅ protocol |
| sepia | semantic effect → color matrix | `effects[].type: "sepia"` | ✅ protocol |
| invert | semantic effect → color matrix | `effects[].type: "invert"` | ✅ protocol |
| filter opacity | ordered effect chain | `effects[].type: "filter-opacity"` | ✅ protocol |
| basic box shadow | effect | `drop-shadow` | ✅ |
| shadow spread | effect | thiếu | ⚠️ |
| inset shadow | effect | chưa tương đương | ⚠️ |
| mix-blend-mode | blend operation | `composite.blendMode` (CSS canonical enum) | ✅ protocol |
| isolation | compositing boundary | `composite.isolation` | ✅ protocol |
| text CSS layout | glyph positions | compiler | ✅ concept |
| basic text rendering | glyph / text primitive | text | ✅ |
| wrapping | glyph layout output | Atomic hiện chưa đủ | ⚠️ |
| bidi | glyph runs | Atomic hiện chưa đủ | ⚠️ |
| rich inline style | multiple glyph runs | Atomic hiện chưa đủ | ⚠️ |
| variable font | resolved font instance / glyphs | partial | ⚠️ |

Gradient protocol note: `linear-gradient`, `radial-gradient`, and
`conic-gradient` accept at least two normalized color stops. Stop offsets are
non-decreasing; background shorthand, layer order, and implicit stop
resolution remain compiler responsibilities.

## Quy ước temporal

Protocol V2 dùng milliseconds cho toàn bộ giá trị thời gian:

- `timing.start` / `timing.duration`;
- `tracks[].keyframes[].time`;
- video trim;
- audio timing, trim, fade;
- media asset duration.

Ví dụ 5 giây:

```json
{
  "timing": { "start": 0, "duration": 5000 },
  "tracks": [
    {
      "id": "fade-in",
      "path": "opacity",
      "keyframes": [
        { "time": 0, "value": { "type": "number", "value": 0 } },
        { "time": 1000, "value": { "type": "number", "value": 1 } }
      ]
    }
  ]
}
```

## Quy ước keyframe

- Track thuộc về layer và dùng local layer time.
- Một track target một leaf property qua dot-separated `path`.
- `keyframes[].time` phải tăng dần.
- `number`, vector và color là giá trị có thể nội suy.
- `boolean`, `string`, `enum` là giá trị discrete / step.
- Effect path dùng stable effect ID, ví dụ `effects.main-blur.radius`.
- CSS `animation`, CSS `transition`, Figma smart animate và AE-style editor
  actions đều là high-level input; compiler hạ chúng về cùng một track model.

## Phạm vi trách nhiệm

```text
HTML / CSS / SVG
    ↓
Parser + cascade + layout + paint resolution + animation lowering
    ↓
Atomic Protocol V2
    ↓
Compiler / Runtime / Preview / Export
```

Các dòng đánh dấu `compiler` không phải là field cần thêm vào Atomic. Chúng là
phần xử lý để tạo ra `frame`, `transform`, `paint`, `mask`, `effect` hoặc
`tracks` trước khi document đi vào render pipeline.
