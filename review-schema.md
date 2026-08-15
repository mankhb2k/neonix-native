# Review Schema — AI Authoring Guide

Kế hoạch xây dựng bộ guide cho AI tạo JSON, ưu tiên theo thứ tự từ dưới lên.

---

## 1. Layers

> Nên là guide đầu tiên, vì toàn bộ V1 là **layers-only**.

Cần chốt thật rõ:

- Mỗi `layer.type` dùng khi nào
- Field bắt buộc / tùy chọn
- Sự khác biệt giữa **root layer** và **nested layer**
- Cách `zIndex`, `parentLayerId`, `timing`, `frame` hoạt động
- Loại nào **production-safe**, loại nào còn **partial**

> **Lý do:** AI tạo JSON chủ yếu sẽ _"nghĩ bằng layer"_, không nghĩ bằng component hay effect trước.

---

## 2. Properties / Atoms

Sau khi có layer guide, bổ sung guide cho các atom chung:

- `transform`
- `appearance`
- `compositing`
- `effects`
- `timing`
- `modifiers`

**Mục tiêu:** biến chúng thành _"vocabulary đóng"_ cho AI:

- Property nào hợp lệ
- Property nào **animatable**
- Property nào **bindable**
- Giá trị hợp lệ là gì
- Ví dụ tối thiểu và ví dụ sai

---

## 3. Variables & Bindings

Guide rất quan trọng cho AI authoring production, vì nó quyết định JSON có **reusable** hay không.

Cần làm rõ:

- Khi nào dùng **literal**, khi nào dùng **variable**
- `binding` vào layer khác gì `componentLayer`
- Mapping **type-safe** giữa variable type và property kind
- Các lỗi phổ biến và cách sửa

---

## 4. Safe Animation

Tiếp theo mới đến animation:

- `keyframes`
- `easing`
- `tracks`
- `drivers`
- Local time vs global time
- Subset nào AI nên dùng mặc định

> Sẽ giữ scope chặt: trước hết dạy AI _"animate an toàn"_, chưa cần mở rộng hết mọi driver/modifier.

---

## 5. Asset Authoring

Guide storage hiện nói về lưu trữ là tốt, nhưng AI còn cần guide ở mức **authoring**:

- Asset nào cần metadata gì
- `image` / `svg` / `video` / `audio` khác nhau thế nào trong JSON
- `crop` / `fit` / `trim` dùng ra sao
- Đâu là **export-safe**, đâu còn **partial**

---

## 6. Production Support Matrix

Ngay sau các guide trên, thêm một guide riêng kiểu:

- `schema-valid`
- `preview-safe`
- `export-safe`
- `not recommended for AI`

Guide này cực kỳ đáng làm sớm, vì repo hiện có nhiều capability partial.
