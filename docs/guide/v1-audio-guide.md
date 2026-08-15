# MotiClip V1 Audio

> Trạng thái: v1
>
> Mục tiêu: audio là timeline object **chỉ root**, không phải visual primitive.

---

## Đã chốt

- Audio vẫn là một `layer` trên `project.layers` (cùng clock `timing`).
- Không dùng mental model visual: không `frame`, không `transform`, không `layout` / `layoutItem`, không `appearance`.
- Chỉ root: `parentLayerId: null`. Không nest trong group.
- `zIndex` bắt buộc và **< 0**. Đây là lane rule trên timeline, không phải visual stacking.
- `timing` bắt buộc; cửa sổ hiệu lực giao với composition như layer khác.
- Playback sống trên `payload`: `assetId`, `trimStart`, `trimEnd`, `playbackRate`, `volume`, `fadeIn`, `fadeOut`, `loop`, `muted`.
- `trim*` cắt **nguồn**, không phải layer trim protocol.
- `volume` nguyên `0..100` (100 = đầy). Tắt tiếng bằng `muted`, không bằng `appearance.visible`.
- Hit-test / editor selection không thuộc JSON audio.

---

## Câu chốt

Audio là làn âm thanh trên timeline. Visual guide không áp dụng.

---

## Xem thêm

- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-video-guide.md](./v1-video-guide.md)
- [v1-appearance-guide.md](./v1-appearance-guide.md)
