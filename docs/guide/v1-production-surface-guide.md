# MotiClip V1 Bề mặt production

> Trạng thái: nháp
>
> Mục tiêu: AI dùng gì mặc định, cái gì nâng cao / nội bộ.

---

## Guide này cần chốt

- Feature nào an toàn mặc định
- Feature nào nâng cao nhưng vẫn cho phép
- Feature schema-valid nhưng không khuyến khích AI mặc định
- Preview-safe khác export-safe thế nào

---

## Đã chốt

- Bề mặt AI mặc định **nhỏ hơn** full schema.
- Generic `modifier` không thuộc authoring mặc định.
- Field native theo domain được ưu tiên hơn bucket extension.
- AI luôn ghi: `id`, `name`, `type`, `parentLayerId`, `zIndex`, `timing`.
- AI ghi `frame` trên mọi visual layer (kể cả group). Không ghi trên audio/camera. Không suy group.frame từ children.
- AI không ghi `locked`.
- `semantic` tùy chọn; không dùng để “vẽ khác”.
- `inheritFlags` và `modifiers` không dùng trừ khi user/tool cố ý.
- Layout: chỉ `group.layout` + child `layoutItem`. Field: `mode`, `gap`, `padding`, `justify`, `align`, size `fixed|hug|fill`, `alignSelf`, min/max. Grid cần `columns`. Không `wrap` / `grow` / `shrink` / span.

---

## Còn mở

- Allowlist production-ready đợt đầu (từng field từng type).
- Nhãn `preview-safe` / `export-safe` theo domain.
- Field nâng cao vẫn document nhưng không đưa vào ví dụ mặc định.

---

## Xem thêm

- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-format-guide.md](./v1-format-guide.md)
- [README.md](./README.md)
