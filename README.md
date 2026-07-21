# MotionVideo

AI **motion graphic 2D** cho doanh nghiệp Việt — tạo TVC 15–30 giây dạng timeline có thể chỉnh, không phải hộp đen text → video.

> Người dùng không mua “AI”. Họ mua video quảng cáo, nội dung TikTok, và thời gian tiết kiệm so với After Effects.

---

## App này làm gì?

MotionVideo giúp marketing / SME / agency nhỏ:

1. Tạo dự án (tên + tỉ lệ khung hình)
2. AI (hoặc template) dựng **storyboard → scene → layer → animation** thành **Motion JSON**
3. Chỉnh trong editor kiểu CapCut-lite: scene, layer, chữ, màu brand, preset animation, AI chat
4. Xuất video (ngang / dọc) qua render worker

**Phạm vi sản phẩm (MVP):** TVC motion 2D tiếng Việt — kinetic text, logo reveal, icon, shape, CTA — tối ưu cho F&B / spa / SME Việt Nam.

**Không nhằm:** thay thế After Effects đầy đủ, hay cạnh tranh Runway/Pika kiểu cinematic generative video.

---

## Motion là gì? (không phải slide, không phải “AI video”)

### Motion ≠ PowerPoint

| Slide | Motion graphic |
|---|---|
| Slide 1 → 2 → 3 gần như độc lập | Một **timeline** liên tục (0s → 30s) |
| Animation chủ yếu trong từng slide | Text, image, shape, camera, audio **chồng thời gian** |
| Chuyển slide | Scene là đoạn trên cùng một dòng thời gian |

### Motion ≠ Generative AI video

| AI video (Runway, Pika, text→video…) | MotionVideo |
|---|---|
| Model sinh **pixel / clip** | AI sinh / lắp **timeline có cấu trúc** |
| Khó chỉnh từng chữ, từng scene | Sửa layer, preset, màu, CTA rồi render lại |
| Brand / font tiếng Việt khó kiểm soát | Font whitelist VN, template, grammar quảng cáo |
| Output gần như hộp đen | Source of truth = **Motion JSON** |

**Định nghĩa làm việc:**

> Motion graphic = một **scene graph** (scene → layer → object) được phát theo **timeline** (khi nào xuất hiện, kéo dài bao lâu, animate thế nào), rồi **render** thành video.

```text
Project
├── Brand (tên, màu, logo, font)
├── Aspect ratio (9:16 | 16:9 | 1:1)
└── Scenes[]
    ├── role (hook | offer | cta | …)
    ├── duration
    └── Layers[]
        ├── type (text | logo | shape | …)
        ├── content / asset
        └── animations[] (preset + start + duration)
```

Timeline là trái tim. Scene gần “slide” nhưng chỉ là **đoạn thời gian** trên timeline, không phải trang độc lập.

---

## Luồng AI (quan trọng)

```text
Prompt / form brand + kịch bản
        ↓
AI Planner + Template / Grammar (retrieve)
        ↓
Motion JSON  ← có thể validate (Zod) và chỉnh tay
        ↓
Compiler
        ↓
Render engine (MVP: Motion Canvas runtime)
        ↓
FFmpeg (encode, tỉ lệ, audio)
        ↓
MP4
```

**AI không nên chỉ sinh file video cuối.**  
AI nên sinh (hoặc chọn + điền) **timeline**. User giữ quyền sửa trước khi xuất.

Camera (pha sau): không bắt user keyframe như AE — dùng **camera preset** (`Zoom In`, `Focus Object`, …); trong data có thể là transform/preset trên scene, không nhất thiết “một layer lung tung” trên UI.

---

## Khác gì video AI generate ngoài kia?

| | ChatGPT / Runway / HeyGen avatar… | MotionVideo |
|---|---|---|
| Bài toán | Sinh clip / talking head / cinematic | TVC motion 2D có cấu trúc quảng cáo |
| Chỉnh sửa | Prompt lại, hoặc edit hạn chế | Editor: scene, layer, inspector, AI patch có **Áp dụng** |
| Brand | Dễ lệch | Logo, màu, font VN-safe |
| Tiếng Việt | Thường phụ | Kinetic typography + font đã QA dấu |
| Moat | Model lớn | Template, grammar TVC VN, asset, UX |
| Xuất | Video | Video **từ** project format riêng (đổi engine được) |

Tóm lại: cạnh tranh bằng **workflow + thư viện motion cho VN**, không bằng “model lớn hơn”.

---

## Công nghệ

### Monorepo (pnpm)

| Phần | Vai trò |
|---|---|
| `apps/web` | Next.js — landing + app editor |
| `apps/render-worker` | Queue render (không chạy trong serverless Next) |
| `packages/motion-schema` | Zod contract: Motion JSON |
| `packages/template-library` | Template / motion block + retrieve (tag) |
| `packages/motion-grammar` | Hook → Offer → CTA… |
| `packages/ai-planner` | Input → MotionProject (stub → LLM sau) |
| `packages/asset-registry` | Font VN-safe whitelist |
| `packages/shared` | Constants / job status |

### Stack chính

- **UI:** Next.js (App Router), React, Zustand  
- **Domain model:** TypeScript + Zod (`@motionvideo/motion-schema`)  
- **Render (hướng MVP):** Motion Canvas (runtime) + **FFmpeg** (encode)  
- **AI:** LLM API gọi qua planner; output bắt buộc khớp schema  
- **Deploy ý tưởng:** `motionvideo.com` (landing) + `app.motionvideo.com` (app); local: `/` và `/app`

### Nguyên tắc kiến trúc

1. Editor chỉ thao tác **Motion JSON** — không phụ thuộc cứng một render engine.  
2. Web **không** render video nặng trong request Next.js — đẩy sang worker.  
3. Preview (browser) và final render (worker) có thể khác engine; cùng một project format.  
4. MVP: animation **preset** + scene timing; keyframe graph kiểu AE = pha sau nếu khách trả tiền.

---

## Cấu trúc thư mục (rút gọn)

```text
motionvideo/
├── apps/
│   ├── web/                 # Next.js UI + editor
│   └── render-worker/       # compile → runtime → ffmpeg → upload
├── packages/
│   ├── motion-schema/
│   ├── template-library/
│   ├── motion-grammar/
│   ├── ai-planner/
│   ├── asset-registry/
│   └── shared/
├── assets/                  # fonts / music / characters (binary)
└── scripts/
```

---

## Chạy local

Yêu cầu: Node ≥ 20, **pnpm** ≥ 9.

```bash
pnpm install
pnpm dev
```

- Landing: http://localhost:3000  
- App: http://localhost:3000/app  

Worker (khi nối queue):

```bash
pnpm dev:worker
```

Sao chép `.env.example` → `.env.local` nếu cần URL marketing/app.

---

## Trạng thái hiện tại (MVP)

**Đã có**

- Tách landing / app (+ middleware subdomain cho prod)
- Workspace + modal tạo dự án (tên + tỉ lệ)
- Editor layout kiểu CapCut: icon nav, panel cảnh/layer, preview, timeline, AI / Cơ bản
- Motion JSON schema + template F&B mẫu + planner stub
- Lưu project tạm trên `localStorage`

**Chưa có / đang stub**

- Render Motion Canvas + FFmpeg thật
- LLM planner production
- TTS / nhạc đồng bộ
- Camera preset
- Auth, billing, storage cloud

---

## Định hướng sản phẩm

1. **Ship Next.js** để validate và có doanh thu.  
2. Xây moat: template + grammar + font tiếng Việt + UX.  
3. Chỉ khi khách thật cần hiệu năng / offline: native / C++ / Wasm cho hot path — **không** bắt đầu bằng clone After Effects.

Model AI là “điện”. Tài sản là **format + template + engine preset**.

---

## License

Private / chưa công bố — cập nhật khi mở source hoặc commercial.
