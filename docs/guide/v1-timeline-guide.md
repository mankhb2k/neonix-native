# NeonVideo V1 Timing

Authoring JSON **không có** `project.timeline`. Độ dài project và animation sống trên layer.

---

## 1. Project length

Project length **không ghi ra JSON**. Derive:

`max(root.timing.start + root.timing.duration)` trên layer `parentLayerId === null` (visual + audio). Không có root → `0`. Child timing không kéo duration global. Không padding, không tail đen.

Compiler stamp `runtime.timeline.duration` với giá trị đó. Frame `t >= duration` không thuộc composition.

```jsonc
{
  "layers": [
    { "id": "main", "type": "group", "parentLayerId": null, "zIndex": 0, "timing": { "start": 0, "duration": 8 }, "children": [{ "id": "title", "type": "text", "parentLayerId": "main", "zIndex": 0, "timing": { "start": 0, "duration": 8 }, "frame": { "width": 800, "height": 120 } }] },
    { "id": "music", "type": "audio", "parentLayerId": null, "zIndex": -1, "timing": { "start": 0, "duration": 8 } }
  ]
}
```

Runtime IR vẫn có `timeline: { duration }` — đó là output compiler, không phải authoring.

UI timeline (lanes, clips, playhead) là session/projection. Không phải protocol timeline.

---

## 2. Layer timing

| Khái niệm | Vai trò |
| --- | --- |
| `layer.timing.start` / `duration` | Nguồn thời gian duy nhất |
| Root `start` | Global |
| Child `start` | Local theo parent; child phải nằm trong `parent.timing.duration` |
| `project.layers[]` | Root layers. `zIndex`: `>= 0` visual, `< 0` audio at root; nested always `>= 0`; unique among siblings |
| `layer.animations[]` | Layer property keyframes; `t` local `0 .. layer.timing.duration` |

Authoring **không** có `scenes`, `workArea`, `timeline.clips`. Extra keys bị strict reject.

Helper: `deriveProjectDurationV1(layers)`. Canonicalize snap layer timing lên `composition.fps`, rồi derive duration ra ngoài JSON.

---

## 3. Thuật ngữ

| Term | Nghĩa |
| --- | --- |
| Root layer | Layer `parentLayerId: null` — quyết định project length |
| `zIndex` | Bắt buộc. Root = stack/lane order. Nested = sibling paint order |
| Group | Visual container; `children` ≥1; xem [v1-group-guide.md](v1-group-guide.md) |
| Audio | `type: "audio"`, root-only leaf, `zIndex < 0`, không có `animations` |
| UI TimelineClip | Projection editor — không ghi vào protocol JSON |
| AnimationClip | `layer.animations[]` |
