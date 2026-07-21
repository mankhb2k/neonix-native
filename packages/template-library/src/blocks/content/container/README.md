# Content · Container

Khối **nhóm / layout** — chứa text, shape, media bên trong.  
Không thay Animation: container chỉ cấu trúc; Entrance gắn lên container hoặc children.

## Kệ (`CONTAINER_BLOCKS`)

| ID | Tên | Dùng cho |
|---|---|---|
| `container.card` | Card | Feature / price card có nền |
| `container.group` | Group | Parent ảo — transform chung, không style |
| `container.grid` | Grid | Lưới 2×N so sánh / feature |
| `container.stack` | Stack | Xếp dọc/ngang + gap |
| `container.frame` | Frame | Safe area / crop / clip |
| `container.mask` | Mask | Clip children theo shape/path |
| `container.background` | Background | Nền scene (màu / gradient / ảnh) |
| `container.section` | Section | Khối lớn trong scene dài |

## Nguyên tắc

1. **Group vs Card** — Group không có fill/border; Card có bề mặt nhìn thấy.
2. **Frame vs Mask** — Frame = vùng an toàn / bố cục; Mask = cắt hình theo path (reveal sau dùng Shape/Camera animation).
3. **Stack vs Grid** — Stack 1 chiều; Grid 2 chiều.
4. **Background** thường full-bleed, z-index thấp nhất trong scene.
5. Children tham chiếu bằng parentId trong Motion JSON (engine sau).

## Thứ tự dựng scene gợi ý

```text
background → section/frame → stack|grid → card → text/media/shape
```
