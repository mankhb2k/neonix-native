# Kế hoạch xây Motion Block

Mục tiêu: có thư viện block **dùng được trong Pattern**, không phải kho file cho đẹp.

Nguyên tắc:

```text
AI / bạn sinh hàng loạt
  → chỉ merge block đã preview + gắn vào ≥1 Pattern
  → số trên kệ sản phẩm < số AI draft
```

---

## Có cần lấy từ LottieFiles / nguồn ngoài không?

### Trả lời ngắn

| Nguồn | Có cần ngay? | Dùng để làm gì |
|---|---|---|
| **Tự làm (JSON preset / code)** | **Có — ưu tiên** | Fade, slide, scale, stagger, counter, highlight… = 80% infographic |
| **Icon tĩnh** (Lucide, Phosphor…) | Có, sớm | Asset trong layer `icon`, không phải “motion block” |
| **LottieFiles** | Tuỳ chọn, sau | Icon/illustration đã animate phức tạp; nghiên cứu timing |
| **Envato / AE template** | Chỉ nghiên cứu | Học taxonomy, nhịp, lower-third — **không copy** |
| **Rive** | Sau | Character / UI interactive (pha 2) |

**Tháng đầu: không bắt buộc LottieFiles.**  
Hầu hết Motion Block của bạn nên là **preset trong schema** (engine animate text/shape), không phải file Lottie.

Lottie = **một loại asset đã có sẵn chuyển động**.  
Motion Block của bạn = **quy tắc animate** áp lên layer (text, shape, icon tĩnh).

```text
Motion Block (của bạn)     ≠    Lottie file
"fade-up trong 0.6s"              "icon loading xoay sẵn"
```

Dùng Lottie khi: cần illustration phức tạp mà code mất nhiều ngày.  
Không dùng Lottie để thay toàn bộ library — khó thống nhất brand, tiếng Việt, và map vào Pattern.

---

## Phân loại Motion Block (taxonomy)

Giai đoạn 1 chỉ làm nhóm **A–D**. E–G để sau.

### A. Entrance (generic — dùng cho text/shape/icon; làm trước)

| ID | Tên | Ghi chú |
|---|---|---|
| `enter.fade-in` | Fade In | Chỉ opacity |
| `enter.fade-up` | Fade Up | Hook mặc định |
| `enter.fade-down` | Fade Down | Đối xứng |
| `enter.fade-left` | Fade Left | Dịch nhẹ hơn slide |
| `enter.fade-right` | Fade Right | Đối xứng |
| `enter.scale-in` | Scale In | Big number / giá |
| `enter.zoom-in` | Zoom In | Mạnh hơn scale-in |
| `enter.slide-up` | Slide Up | Travel xa hơn fade-up |
| `enter.slide-left` | Slide Left | So sánh cột |
| `enter.slide-right` | Slide Right | So sánh cột |
| `enter.pop` | Pop | Overshoot nhẹ |
| `enter.bounce-in` | Bounce In | Dùng sparingly |
| `enter.flip` | Flip | Perspective X |
| `enter.rotate-in` | Rotate In | Badge / sticker |
| `text.typewriter` | Typewriter | Chỉ chữ, grapheme-safe (`text.typing` = alias) |

Id cũ `text.fade-up`… vẫn resolve qua alias trong `catalog.ts`.

**Text đặc biệt (kệ Text):** `text.stagger-words`, `text.highlight`, `text.counter`

### B. Shape / Layout Motion

| ID | Tên |
|---|---|
| `shape.fade` | Fade |
| `shape.scale-in` | Scale In |
| `shape.draw-line` | Draw Line (gạch nối bước) |
| `shape.bar-grow` | Bar Grow (so sánh) |
| `shape.progress` | Progress fill |
| `shape.pop` | Pop / bounce nhẹ |

### C. Icon Motion (icon **tĩnh** + animate bằng engine)

| ID | Tên |
|---|---|
| `icon.fade-up` | Fade Up |
| `icon.pop` | Pop |
| `icon.float` | Float nhẹ |

(Icon SVG từ Lucide/Phosphor — **không** cần Lottie.)

### D. Scene / CTA / Transition

| ID | Tên |
|---|---|
| `cta.slide-up` | CTA Slide Up |
| `cta.pulse` | Pulse nhẹ |
| `logo.reveal` | Logo Reveal |
| `trans.fade` | Chuyển scene fade |
| `trans.slide` | Chuyển scene slide |

### E. Camera (pha sau — preset, không keyframe tay)

`camera.zoom-in`, `camera.zoom-out`, `camera.pan-left`, `camera.focus-center`

### F. Character / G. Lottie pack

Chỉ khi có khách hoặc pattern bắt buộc.

---

## Pattern nào cần block nào? (để không gen thừa)

Làm **pattern trước danh sách block**, rồi chỉ gen block mà pattern cần.

| Pattern | Block tối thiểu |
|---|---|
| `big-number` | `text.counter` hoặc `enter.scale-in` + `enter.fade-up` + `shape.fade` |
| `process-steps` | `enter.fade-up` (text + icon) + `shape.draw-line` (stagger) |
| `compare-2` | `enter.slide-left/right` + `shape.bar-grow` |
| `quote` | `enter.fade-up` + `shape.fade` |
| `feature-list` | `text.stagger-words` / `enter.fade-up` × N |
| `cta` | `cta.slide-up` + `logo.reveal` |
| `problem-solution` | 2 scene: `enter.fade-in` + `trans.fade` |

→ Khoảng **15–25 block “trên kệ”** là đủ nuôi 6–8 pattern đầu.

AI có thể draft 50–100 biến thể; **merge ~20–30** sau khi preview.

---

## Kế hoạch 4 tuần (solo + AI)

### Tuần 1 — Nền + 3 pattern sống

**Mục tiêu:** schema block ổn + 3 pattern chạy trên preview.

1. Chốt format Motion Block trong repo (metadata + map sang animation preset schema).  
2. Viết tay / AI + duyệt: **12 block lõi** (nhóm A–D tối thiểu ở bảng trên).  
3. Pattern: `big-number`, `process-steps`, `compare-2`.  
4. Viewer: mở JSON → thấy thứ tự scene + chữ (preview stub OK).  

**Không:** Lottie, camera, character, editor CapCut hoàn chỉnh.

### Tuần 2 — Nhân bản block có kiểm soát

1. AI gen thêm biến thể (duration 0.4 / 0.6 / 0.8, ease khác).  
2. Bạn duyệt batch 10/ngày → chỉ merge cái dùng được.  
3. Thêm pattern: `quote`, `feature-list`, `cta`.  
4. Icon pack tĩnh (Lucide) + gắn `icon.*` blocks.  

**LottieFiles (tuỳ chọn):** xem 20 shot “infographic” phổ biến → ghi note timing (0.3s? 0.6s?), **không download cả kho**.

### Tuần 3 — Template ngành + render thử

1. Template: `education-tiktok`, `saas-feature` = Pattern + Block + màu/font.  
2. Gắn 1 pipeline render thử (Motion Canvas hoặc tạm export thủ công 1 mẫu để cảm nhận).  
3. Chuẩn hoá ID: `enter.fade-up`, không `FadeUp1` / `fade_up_final`.  

### Tuần 4 — AI Intent → Pattern

1. Prompt: nội dung → chọn pattern + gán block ID có sẵn.  
2. Zod validate toàn bộ.  
3. KPI: từ 1 đoạn văn → JSON hợp lệ → preview.  

---

## Quy trình tạo một block (checklist)

Mỗi block trước khi merge:

- [ ] Có `id` ổn định (`enter.fade-up`)  
- [ ] Có `duration` mặc định + min/max  
- [ ] Có mô tả 1 dòng (AI/retrieve sau này)  
- [ ] Có tags: `text`, `enter`, `vi-safe`  
- [ ] Preview OK với chữ tiếng Việt có dấu (`ể`, `ẫ`, `ộ`)  
- [ ] Được reference bởi ≥1 Pattern  
- [ ] Không trùng ý với block đã có (tránh 15 loại fade giống nhau)

---

## Khi nào mới lấy LottieFiles?

Bật Lottie khi **cả 3** đúng:

1. Pattern đã chạy bằng block code/preset.  
2. Cần illustration phức tạp (không chỉ icon line).  
3. License rõ (free for commercial / mua đúng gói) và style gần brand bạn.

Cách dùng đúng:

```text
Layer type: lottie
assetId: lottie.infographic-arrow-01
animation: play (hoặc scrub theo timeline)
```

Lottie là **asset**, vẫn nằm dưới Pattern — không thay Motion Block library.

---

## Cấu trúc thư mục (Motion Library)

```text
packages/template-library/src/blocks/
├── content/
│   ├── text/
│   ├── shape/
│   ├── media/
│   ├── container/
│   ├── data/
│   ├── character/
│   └── camera/
├── animation/
│   ├── entrance/
│   ├── exit/
│   ├── emphasis/
│   ├── transform/
│   ├── text/              # Text Animation
│   ├── number/            # Number Animation
│   ├── shape/             # Shape Animation
│   ├── transition/
│   ├── camera/            # Camera Presets
│   └── timing/            # schema only
├── library.ts
├── catalog.ts
└── types.ts
```

| Family | Shelf | Ý nghĩa |
|---|---|---|
| Content | text…camera | Khối tĩnh trên khung |
| Animation | entrance…camera-presets | Chuyển động / preset |
| Meta | timing | delay/duration/easing trên schema |

Lab filter: **Content | Animation**.

---

## KPI tháng 1 (thực tế)

| Chỉ số | Mục tiêu |
|---|---|
| Block AI draft | 50–100 (phễu) |
| Block đã duyệt trên kệ | **20–30** |
| Pattern | **6–8** |
| Template ngành | **2** |
| Lottie file | **0–5** (không bắt buộc) |

---

## Tóm tắt một câu

**Tự xây Motion Block dạng preset (text/shape/icon/cta) là gốc; LottieFiles/Envato để học và bổ sung asset phức tạp — không phải nguồn chính tháng đầu.**
