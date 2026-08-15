# MotiClip V1 Image

> Trạng thái: nháp
>
> Mục tiêu: field media native của layer ảnh.

---

## Đã chốt

- Hành vi ảnh nằm trên layer image.
- `assetId`, `fit`, `crop` là field media-native, không phải modifier.
- `frame` bắt buộc: hộp đặt media (placement box).
- `fit` quyết định ảnh nằm trong hộp đó thế nào; `crop` cắt nguồn, không thay size box.

---

## Còn mở

- `fit` mặc định khi AI không ghi.
- Crop trong docs authoring có luôn chuẩn hóa `0..1` không.

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-video-guide.md](./v1-video-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
