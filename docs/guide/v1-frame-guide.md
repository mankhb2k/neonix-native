# MotiClip V1 Frame

> Trạng thái: v1
>
> Mục tiêu: `frame` là size box local bắt buộc của mọi layer nhìn thấy được.

---

## Đã chốt

- `frame` là size box **local của chính layer đó**, trước translate / scale / rotate.
- Mọi visual layer **bắt buộc** có `frame`: group, component, text, image, svg, video, shape, path, solid, bone, adjustment.
- **Cấm** `frame`: audio, camera.
- Không auto-suy `group.frame` từ children trong JSON canonical. Editor có thể auto-fit lúc soạn, nhưng file ghi ra phải có số cụ thể.
- Layout luôn tính từ `frame` của group. `layoutItem` đổi `frame` kết quả của child lúc compile.
- `group.frame` không clip children.

**Câu chốt:** `frame` là box size của chính layer đó. Visual layer không được thiếu.

| Bắt buộc | Cấm |
| --- | --- |
| group, component, text, image, svg, video, shape, path, solid, bone, adjustment | audio, camera |

---

## Không phải

Timeline frame, container, clipping box mặc định, transform, quyền kiểm soát children.

---

## Xem thêm

- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-group-guide.md](./v1-group-guide.md)
- [v1-layout-guide.md](./v1-layout-guide.md)
- [v1-transform-guide.md](./v1-transform-guide.md)
