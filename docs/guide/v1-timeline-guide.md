# MotiClip V1 Timeline

Module protocol tại `packages/motion-protocol/src/v1/timeline/`.

Timeline là **đồng hồ (clock)** cho độ dài MP4. Nội dung phát nằm trên `project.layers` — root layer = lane. Compiler / runtime / render-worker đọc `timeline.duration` và timing của **root layer**; không dựng lại từ scene/track cũ.

---

## 1. Timeline là gì?

| Khái niệm | Vai trò |
| --- | --- |
| `timeline.duration` | Độ dài MP4 (giây). Optional lúc authoring; bắt buộc ở canonical/export. Derive từ `root.timing.start + duration` |
| `workArea` | Optional; phải nằm trong `duration` |
| `clips` | Layer/property keyframes; `t` local theo layer |
| `project.layers[]` | Root layers = timeline lanes. Every layer requires `zIndex`: `>= 0` visual, `< 0` audio at root; nested always `>= 0`; unique among siblings |
| `group.children[]` | ≥1 child. Timing con **bắt buộc**, local so với parent, không vượt `parent.timing.duration`. Group không clip mặc định. |

Authoring **không** có `scenes`, `visualTracks`, `audioTracks`, `captionTracks`. Extra keys bị strict reject.

```jsonc
{
  "layers": [
    { "id": "main", "type": "group", "parentLayerId": null, "zIndex": 0, "timing": { "start": 0, "duration": 8 }, "children": [{ "id": "title", "type": "text", "parentLayerId": "main", "zIndex": 0, "timing": { "start": 0, "duration": 8 }, "frame": { "width": 800, "height": 120 } }] },
    { "id": "music", "type": "audio", "parentLayerId": null, "zIndex": -1, "timing": { "start": 0, "duration": 8 } }
  ],
  "timeline": { "duration": 8 }
}
```

Runtime IR shares the same layers-only contract: compiler emits flat `layers[]` (visual + audio) plus `propertyAnimations`. Evaluate may use an in-memory graph id `"root"` — there is no serialized `scenes` array or visual/audio clip tracks.

---

## 2. Cấu trúc một Timeline

Mỗi project có đúng một `timeline`:

```jsonc
{
  "timeline": {
    "duration": 10, // optional lúc authoring; bắt buộc ở canonical/export
    "workArea": { "start": 0, "end": 8 },
    "clips": []
  }
}
```

Không có track array. Caption không phải type: một caption line = `type: "group"`; words = `type: "text"` children với timing local.

Layer/property animation nằm ở `timeline.clips` (local time theo layer). Xem [v1-animation-keyframes-guide.md](./v1-animation-keyframes-guide.md). Runtime `propertyAnimations` là output compiler, không phải JSON authoring.

---

## 3. Derive duration

`deriveTimelineDurationV1(layers)` = max của `timing.start + duration` trên **root layers** (visual + audio). Child timing không kéo duration global.

Canonicalize snap frame-grid theo `composition.fps`, rồi điền `timeline.duration` nếu thiếu.

---

## 4. Thuật ngữ

| Term | Nghĩa |
| --- | --- |
| Root layer | Lane trên timeline (`parentLayerId: null`) |
| `zIndex` | Bắt buộc. Root = lane order. Nested = sibling paint order (`>= 0`). Unique per parent |
| Group | Visual container; `children` ≥1; không clip mặc định; xem [v1-group-guide.md](v1-group-guide.md) |
| Audio | `type: "audio"`, root-only leaf, `zIndex < 0` |
| Caption | Group + text children — UI lane, không phải protocol type |
| Component | Instance leaf `type: "component"` trên cây project |
