# MotiClip V1 Audio

> Trạng thái: nháp
>
> Mục tiêu: audio là bề mặt authoring **chỉ root**.

---

## Đã chốt

- Audio chỉ root: `parentLayerId: null`.
- Không có `frame`. Không có `transform`.
- `zIndex` bắt buộc và **< 0** (là làn âm thanh, không chồng visual).
- `timing` bắt buộc; cửa sổ hiệu lực = giao với composition / tổ tiên như layer khác.
- Field media native: `trimStart`, `trimEnd`, `playbackRate`, `volume`, `fadeIn`, `fadeOut`, `loop`, `muted`.
- `trim*` cắt nguồn, không phải layer trim protocol.

---

## Còn mở

- Audio có giữ `appearance.visible` trong docs canonical không.
- Fade / rate / loop production-safe trên preview và export đến đâu.

---

## Xem thêm

- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-video-guide.md](./v1-video-guide.md)
