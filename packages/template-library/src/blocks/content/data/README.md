# Content · Data

Khối **infographic / số liệu**. Content = cấu trúc dữ liệu tĩnh; animate bằng Number Animation (`text.counter`) hoặc Shape Animation (`bar-grow`…) sau.

## Kệ (`DATA_BLOCKS`)

| ID | Tên | Dùng cho |
|---|---|---|
| `data.bar-chart` | Bar Chart | So sánh giá trị theo cột |
| `data.pie-chart` | Pie Chart | Tỷ lệ phần |
| `data.line-chart` | Line Chart | Xu hướng theo thời gian |
| `data.progress` | Progress Bar | Thanh 0–100% |
| `data.counter` | Counter | Ô số để đếm (content); motion = `text.counter` |
| `data.timeline` | Timeline | Mốc thời gian / quy trình |
| `data.table` | Table | Bảng hàng/cột |
| `data.comparison` | Comparison | A vs B / trước–sau |
| `data.statistic` | Statistic | Chỉ số lớn + nhãn |
| `data.gauge` | Gauge | Đồng hồ / tốc độ % |

## Content vs Animation

| Content | Animation gắn kèm |
|---|---|
| `data.counter` / `data.statistic` | `text.counter` (Number Animation) |
| `data.progress` / `data.bar-chart` | Shape Animation: bar-grow / progress-fill |
| `data.pie-chart` / `data.gauge` | Shape Animation: fill / reveal (pha sau) |
| `data.line-chart` / `data.timeline` | draw-line / stagger enters |

`text.number` / `text.percentage` = chữ số đơn; `data.*` = widget có layout (trục, legend, nhiều series).

## MVP ưu tiên

1. Progress Bar + Statistic + Comparison  
2. Bar Chart  
3. Counter (+ Number Animation)  
4. Timeline  
5. Pie / Line / Table / Gauge — sau khi pattern cần
