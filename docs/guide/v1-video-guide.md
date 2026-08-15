# MotiClip V1 Video

> Trạng thái: nháp
>
> Mục tiêu: playback và placement native của layer video.

---

## Đã chốt

- Hành vi video nằm trên layer video.
- Field native: `assetId`, `fit`, `crop`, `trimStart`, `trimEnd`, `loop`, `muted`, `framePolicy`.
- `frame` bắt buộc: hộp đặt media.
- `trimStart` / `trimEnd` là cắt nguồn media, không phải layer trim protocol. Timing layer vẫn là `timing`.
- Cửa sổ hiệu lực = giao `timing` với tổ tiên, giống layer khác.

---

## Còn mở

- Field nào export-safe hôm nay.
- `framePolicy` nằm bề mặt AI mặc định hay mục nâng cao.

---

## Xem thêm

- [v1-image-guide.md](./v1-image-guide.md)
- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
