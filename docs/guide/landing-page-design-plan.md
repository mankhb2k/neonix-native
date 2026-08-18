# NeonVideo — Landing Page Design Plan

> Trạng thái: plan
>
> Mục tiêu: landing page neon cyberpunk cho "neon cyberpunk video generator
> for music, stories, and motion graphics" — đi từ concept tới spec thiết kế
> chi tiết, map về đúng design system hiện có của `apps/web`.

---

## 0. Phát hiện cần chốt TRƯỚC KHI làm

Đây là các xung đột giữa concept và codebase hiện tại. Không chốt thì landing
sẽ lệch brand hoặc lệch product.

### 0.1 Tên sản phẩm — CHỐT: NeonVideo

| Nguồn            | Tên         | Ghi chú                                                          |
| ---------------- | ----------- | ---------------------------------------------------------------- |
| Repo / workspace | `moticlip`  | Tên folder + monorepo (nội bộ)                                   |
| Code `apps/web`  | `NeonVideo` | `APP_NAME`, metadata, logo `neonix-logo.svg` — **tên công khai** |
| `clipkit/`       | `Clipkit`   | Repo **fork tham khảo**, brand riêng, không đụng vào             |

**Đã chốt:** dùng **một tên duy nhất `NeonVideo`** xuyên suốt landing + app.
`moticlip` là tên repo nội bộ, `clipkit` là repo fork để tham khảo (không liên
quan đến brand landing). `APP_NAME` đã là NeonVideo — chỉ cần đảm bảo copy /
logo / metadata đồng nhất tên NeonVideo.

### 0.2 Định vị / ngôn ngữ

- Landing hiện tại `(marketing)/page.tsx`: **tiếng Việt**, "TVC motion 2D cho
  doanh nghiệp Việt" — B2B local.
- Concept mới: **tiếng Anh**, "music, stories, motion graphics" — B2C / creator
  toàn cầu.

Đây là **pivot định vị**, không chỉ redesign. Cần chốt:

- Ngôn ngữ landing: **EN** (theo concept) hay giữ song ngữ vi-VN?
- Đối tượng: creator (musician, storyteller, motion designer) thay vì doanh nghiệp.

**Đã chốt:** landing **EN-first** (đúng concept + niche music/remix toàn cầu),
giữ `lang="vi"` hiện tại cho product UI; landing dùng copy tiếng Anh.

### 0.3 Clipkit = repo fork tham khảo, KHÔNG dùng cho landing

`clipkit/` là repo **fork để tham khảo**, không phải brand của sản phẩm.
Đừng kéo brand Clipkit vào landing neon (BRAND.md của nó chốt "Never:
gradient-heavy, emoji-led, salesy" + 2 accent đỏ/vàng + Geist — ngược neon).
Landing dùng design token neon của `apps/web/globals.css` (cyan/magenta) — đây
là brand của NeonVideo.

---

## 1. Concept & thông điệp

### 1.1 Định vị một câu

```txt
Neon cyberpunk video generator for music, stories, and motion graphics.
```

### 1.2 Benefit ladder (không mở đầu bằng schema)

```txt
AI creates.
JSON keeps it editable.
Audio makes it move.
Neon makes it unforgettable.
```

Luật copy: nói **benefit** trước, JSON/schema là "credibility" phía sau
(cùng chiến lược với `clipkit/BRAND.md`: "lead with the runtime; protocol
shows up as _how is this possible?_").

### 1.3 Persona

| Persona                | Job                    | Landing phải trả lời                |
| ---------------------- | ---------------------- | ----------------------------------- |
| Musician / DJ          | remix, visualizer      | "beat-synced, không cần timeline"   |
| Storyteller / YouTuber | story video neon       | "prompt → editable video"           |
| Motion designer        | template / client work | "component reusable, props an toàn" |
| Developer / AI agent   | build on top           | "strict JSON, editable motion doc"  |

---

## 2. Visual system — map về token hiện có

`globals.css` đã có nền móng neon đúng hướng. Landing **kế thừa**, chỉ thêm
token marketing (KHÔNG đụng chrome editor).

### 2.1 Kế thừa (giữ nguyên)

| Token                         | Giá trị               | Vai trò trên landing              |
| ----------------------------- | --------------------- | --------------------------------- |
| `--bg-site`                   | `#07090f`             | Nền tối chính (blue-black)        |
| `--bg-elevated`               | `#161b28`             | Card / panel                      |
| `--accent`                    | `#22d3ee`             | Glow cyan chủ đạo                 |
| `--accent-magenta`            | `#c084fc`             | Glow magenta phụ                  |
| `--fg-primary` / `--fg-muted` | `#eef1f8` / `#8e97ab` | Text                              |
| `--font-sans`                 | Be Vietnam Pro        | Body / UI                         |
| `--font-display`              | Fraunces              | Headline serif cinematic (đã có!) |
| `--font-roboto-mono`          | Roboto Mono           | Eyebrow / code / label            |

### 2.2 Token mới (chỉ thêm, không sửa token cũ)

| Token đề xuất         | Giá trị                  | Vai trò                          |
| --------------------- | ------------------------ | -------------------------------- |
| `--landing-bg-deep`   | `#05060b`                | Nền hero đậm hơn                 |
| `--landing-bg-purple` | `#0d0a1a`                | Nền phụ tím-đen (audio/reactive) |
| `--electric-blue`     | `#3b82f6`                | Glow xanh điện (grid, stroke)    |
| `--neon-magenta-loud` | `#e879f9`                | Magenta glow mạnh cho HUD/hover  |
| `--neon-cyan-loud`    | `#67e8f9`                | Cyan glow mạnh (CTA hover)       |
| `--glass-surface`     | `rgba(22,27,40,0.55)`    | Card kính mờ                     |
| `--glass-border`      | `rgba(125,211,252,0.18)` | Viền card kính                   |
| `--scanline`          | `rgba(125,211,252,0.03)` | Scanline overlay                 |

> Quy ước: token neon mạnh (loud) chỉ dùng ở **landing**, không rò vào chrome
> editor (đúng ghi chú hiện có: magenta "không nhuộm chrome").

### 2.3 Các hiệu ứng nền (pure CSS, không ảnh)

| Hiệu ứng         | Cách làm                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Grid perspective | 2 lớp `linear-gradient` ngang/dọc + `transform: perspective` ở chân hero, màu `--electric-blue` mờ |
| Scanline         | `repeating-linear-gradient(0deg, transparent 0 2px, rgba(...) 2px 3px)` overlay `opacity` thấp     |
| Glow             | `box-shadow` nhiều lớp + `filter: blur` trên pseudo-element (không dùng SVG blur nặng)             |
| Card kính        | `backdrop-filter: blur(12px)` + `--glass-surface` + `--glass-border`                               |
| Pulse theo beat  | `@keyframes` scale/opacity sync theo demo (xem §7)                                                 |

---

## 3. Typography

Dùng 3 family đã có, mở rộng scale cho landing:

| Cấp             | Family                      | Weight | Size (clamp)                   | Tracking             |
| --------------- | --------------------------- | ------ | ------------------------------ | -------------------- |
| Hero display    | `--font-display` (Fraunces) | 600    | `clamp(2.75rem, 6vw, 4.5rem)`  | `-0.035em`           |
| Section heading | `--font-display`            | 600    | `clamp(1.75rem, 4vw, 2.75rem)` | `-0.02em`            |
| Eyebrow / label | `--font-roboto-mono`        | 500    | `0.8rem`                       | `+0.08em`, uppercase |
| Body            | `--font-sans`               | 400    | `1.05rem`                      | 0                    |
| Code / JSON     | `--font-roboto-mono`        | 400    | `0.85rem`                      | 0                    |

Quy tắc: headline lớn, sắc, cinematic (serif Fraunces) đối lập label mono
kỹ thuật — tái hiện duality "human vs machine" của brand.

---

## 4. Cấu trúc 12 section — spec từng mục

Mỗi mục ghi: **Mục tiêu · Copy · Visual · Motion · Component**.

### S1 — Hero

- **Mục tiêu:** nói rõ benefit trong 3 giây, có motion preview làm bằng chứng.
- **Copy:**
  - Eyebrow (mono): `NEON CYBERPUNK VIDEO GENERATOR`
  - H1: `Create Neon Motion Videos from JSON, Audio, and AI`
  - Sub: `Build cyberpunk music visualizers, story videos, glowing titles, and animated templates with an AI-first motion format.`
  - CTA primary `Start Creating` → `appUrl("/")`
  - CTA secondary `Watch Demo` → scroll tới S7 showcase (anchor)
- **Visual:** card preview neon đang **pulse theo beat** (ring scale + glow
  opacity, dùng chính `audioAnalysisToTimelineClips` render demo). Nền grid
  perspective + scanline nhẹ + 2 radial glow (cyan trên, magenta dưới).
- **Motion:** hero preview loop beat pulse; chữ fade-up stagger nhẹ khi load.
- **Component:** `HeroSection` + `BeatPulsePreview` + `GridBackdrop` + `ScanlineOverlay`.

### S2 — Problem

- **Mục tiêu:** tạo đồng cảm trước khi bán giải pháp.
- **Copy:** H2 `Making motion graphics is still too manual.`
- **Pain (5 box HUD):** timeline phức tạp · keyframe thủ công · template khó
  tùy biến · AI khó xuất file editor chuẩn · video music/remix cần motion theo beat.
- **Visual:** 5 `HudPanel` nhỏ, mỗi panel một icon + dòng pain, viền neon mờ.
- **Motion:** reveal tuần tự (stagger).
- **Component:** `ProblemSection` + `HudPanel`.

### S3 — Core Promise

- **Mục tiêu:** một câu chốt giá trị cốt lõi.
- **Copy:** H2 `Describe the video. NeonVideo turns it into editable motion.`
- **3 ý (3 cột):** AI generates structured JSON · Components keep templates
  reusable · Audio analysis creates beat-synced keyframes.
- **Visual:** 3 `NeonCard` kính mờ, mỗi cột có mini-visual (JSON → component →
  waveform).
- **Motion:** none-to-light (chỉ reveal), giữ focus vào câu chốt.
- **Component:** `CorePromiseSection`.

### S4 — Use Cases

- **Mục tiêu:** cho thấy "đây là cho tôi".
- **6 card:** Neon music visualizers · Cyberpunk YouTube stories · Glowing
  lyric/title videos · AI-generated motion templates · Podcast/reel visuals ·
  Brand intros/outros.
- **Visual:** grid 3×2, mỗi card có thumb demo + label mono. Card hover glow.
- **Component:** `UseCasesSection` + `UseCaseCard`.

### S5 — How It Works

- **Mục tiêu:** minh hoạ 2 flow ngắn gọn.
- **Flow A (4 bước):** `Prompt → JSON → Compile → Render`
- **Flow B (nhạc, 4 bước):** `Upload audio → Analyze beat → Generate keyframes → Render neon video`
- **Visual:** 2 `HudPanel` flow ngang, mũi tên neon, số thứ tự mono.
- **Motion:** connector line draw-on-scroll (nếu có) hoặc step reveal.
- **Component:** `HowItWorksSection` + `FlowSteps`.

### S6 — Feature Grid

- **Mục tiêu:** list capability đáng giá.
- **8 feature:** AI-first JSON protocol · Neon/cyber effects (glow, inner-glow,
  noise, blur) · Reusable components · Beat-synced motion · Timeline keyframes ·
  R2 managed assets · Production renderer · Template system.
- **Visual:** grid 4×2 `NeonCard`, mỗi card icon + tên + 1 dòng.
- **Component:** `FeatureGridSection` + `FeatureCard`.

### S7 — Neon Effects Showcase (QUAN TRỌNG cho niche)

- **Mục tiêu:** show từng primitive hiệu ứng — proof trực quan nhất.
- **Copy:** H2 `Built for light, glow, rhythm, and atmosphere.`
- **6 primitive:** Outer Glow · Inner Glow · Noise Grain · Cyber Stroke · Blend
  Modes · Color Adjust. Mỗi primitive là 1 tile **interactive/hover** render thật.
- **Visual:** grid 3×2 tile, mỗi tile demo hiệu ứng đó trên một shape neon.
- **Component:** `NeonEffectsShowcase` + `EffectTile`.

### S8 — Audio-Reactive

- **Mục tiêu:** chốt niche remix/music.
- **Copy:** H2 `Make visuals move with the music` + body `Analyze beats, bass
energy, loudness, and sections to generate timeline keyframes automatically.`
- **Visual:** waveform + beat markers + glow pulse preview đồng bộ. Nền tím-đen
  (`--landing-bg-purple`).
- **Motion:** waveform scroll, beat marker nhấp theo demo audio.
- **Component:** `AudioReactiveSection` + `Waveform` + `BeatMarker`.

### S9 — Template / Component

- **Mục tiêu:** bán "AI control được template".
- **Copy:** H2 `Templates that AI can actually control` + nhấn mạnh
  `Change colors, text, images, and motion without breaking internals.`
- **4 template:** character · visualizer · cyber HUD · intro/outro.
- **Visual:** 4 card, mỗi card thumb + tên + "props" tag minh hoạ (color/text/image/motion).
- **Component:** `TemplateSection` + `TemplateCard`.

### S10 — JSON / Developer Trust

- **Mục tiêu:** credibility cho AI-first (schema đừng nói quá sớm — đây là nơi đúng).
- **Copy:** H2 `Structured motion, not prompt soup` + `Every video is backed by
a strict, editable motion document.`
- **Visual split 3 cột:** trái = prompt, giữa = JSON, phải = rendered video.
- **Motion:** JSON typing/scroll nhẹ; video phát loop.
- **Component:** `JsonTrustSection` + `JsonSpecimen`.

### S11 — Gallery

- **Mục tiêu:** social proof bằng mẫu thật.
- **5 mẫu:** Neon DJ visualizer · Cyber UI explainer · Glowing quote video ·
  Futuristic product promo · Storytelling character scene.
- **Visual:** masonry/carousel, mỗi mẫu 1 video + caption mono.
- **Component:** `GallerySection` + `GalleryItem`.

### S12 — Final CTA

- **Copy:** H2 `Build your first neon motion video` · CTA `Join Beta` · phụ
  `View Examples`.
- **Visual:** lặp lại nền grid/glow như hero để khép vòng.
- **Component:** `FinalCtaSection`.

---

## 5. Component inventory

### Primitives (dùng lại nhiều section)

| Component          | Trách nhiệm                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `NeonCard`         | Card kính mờ + viền neon + hover glow                              |
| `HudPanel`         | Box viền neon kiểu HUD (có góc bracket `▛`/`▜`)                    |
| `GlowButton`       | CTA primary (glow cyan) / secondary (outline)                      |
| `GridBackdrop`     | Nền grid perspective                                               |
| `ScanlineOverlay`  | Scanline nhẹ overlay                                               |
| `SectionEyebrow`   | Label mono uppercase + accent                                      |
| `SectionHeading`   | H2 serif chung                                                     |
| `BeatPulsePreview` | Ring neon pulse theo beat (canvas/CSS)                             |
| `Waveform`         | Waveform SVG từ `bassEnergy[]`                                     |
| `JsonSpecimen`     | JSON syntax-highlight (key muted, string vàng, số đỏ — theo brand) |

### Sections

`HeroSection` · `ProblemSection` · `CorePromiseSection` · `UseCasesSection` ·
`HowItWorksSection` · `FeatureGridSection` · `NeonEffectsShowcase` ·
`AudioReactiveSection` · `TemplateSection` · `JsonTrustSection` ·
`GallerySection` · `FinalCtaSection`.

---

## 6. Motion & interaction spec

| Rule                       | Giá trị                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Reveal                     | `IntersectionObserver` fade-up + translate, stagger 60–80ms |
| Hero preview               | loop beat pulse (dùng data analysis thật, không fake)       |
| Hover card                 | viền + glow tăng, translate-y −2px                          |
| Easing                     | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out)                 |
| Thời lượng                 | reveal ≤ 600ms, không motion gây chóng mặt                  |
| **prefers-reduced-motion** | tắt scanline animation + pulse, giữ reveal tĩnh             |

---

## 7. Beat-synced hero (proof đúng niche)

Hero preview **không nên fake** — dùng chính pipeline vừa build
(`packages/audio-analysis`):

```ts
const analysis = await analyzeAudio({ audioUrl: "/demo/track.mp3", ... });
const clips = audioAnalysisToTimelineClips({
  analysis,
  preset: "neon-circle-pulse",
  targets: { ringLayerId: "hero.ring", glowEffectId: "hero.glow" },
});
// render loop: ring scale = clip-ring-scale, glow opacity = clip-beat-glow
```

- Ring scale + glow opacity lấy trực tiếp từ `clips` (beat pulse + bass scale).
- Demo audio: 1 track ngắn 6–8s loop, đặt `public/demo/`.
- Fallback khi chưa có asset: static keyframe timeline (sẽ thay bằng data thật).

---

## 8. File structure đề xuất

```txt
apps/web/app/(marketing)/
  layout.tsx                       # giữ, thêm lang="en" cho landing
  page.tsx                         # compose 12 sections

apps/web/components/site/landing/
  index.ts                         # barrel
  HeroSection.tsx
  ProblemSection.tsx
  CorePromiseSection.tsx
  UseCasesSection.tsx
  HowItWorksSection.tsx
  FeatureGridSection.tsx
  NeonEffectsShowcase.tsx
  AudioReactiveSection.tsx
  TemplateSection.tsx
  JsonTrustSection.tsx
  GallerySection.tsx
  FinalCtaSection.tsx
  primitives/
    NeonCard.tsx
    HudPanel.tsx
    GlowButton.tsx
    GridBackdrop.tsx
    ScanlineOverlay.tsx
    SectionEyebrow.tsx
    SectionHeading.tsx
    BeatPulsePreview.tsx
    Waveform.tsx
    JsonSpecimen.tsx

apps/web/app/globals.css           # thêm token §2.2
apps/web/public/demo/              # track.mp3, thumbnails, sample videos
```

---

## 9. Content / asset model

| Asset         | Loại                        | Nơi                     | Ghi chú                |
| ------------- | --------------------------- | ----------------------- | ---------------------- |
| Demo track    | mp3 6–8s loop               | `public/demo/track.mp3` | cho S1/S8              |
| Gallery video | mp4 (5 mẫu)                 | `public/demo/gallery/`  | S11                    |
| Effect tile   | render thật hoặc CSS/canvas | component               | S7                     |
| JSON specimen | JSON text highlight         | component               | S10                    |
| Logo          | SVG wordmark NeonVideo      | `public/`               | thay `neonix-logo.svg` |

---

## 10. Accessibility & performance

- Màu text đạt contrast (FG trên bg tối ≥ 4.5:1); glow chỉ trang trí, không
  mang thông tin.
- `backdrop-filter` có fallback solid khi không hỗ trợ.
- `prefers-reduced-motion` tắt pulse/scanline (xem §6).
- Video/Ảnh lazy-load (`loading="lazy"`), hero preview eager.
- Không chặn LCP bằng JS; font `display: swap` đã có.
- Focus ring rõ (`--border-focus`) cho mọi link/button.

---

## 11. Phased rollout

### Phase 0 — Chốt quyết định (DONE)

- [x] Tên: **NeonVideo** (một tên duy nhất; `moticlip` = repo nội bộ, `clipkit` = fork tham khảo).
- [x] Ngôn ngữ landing: **EN-first**.
- [x] Positioning: creator toàn cầu (music/story/motion graphics).
- [x] Kế thừa `globals.css`, thêm token khi thiếu.
- [ ] Thu thập 1 demo track + 5 gallery video (asset thật, Phase 3).

Done khi: 1 tên duy nhất + 1 đoạn định vị được approve. ✅

### Phase 1 — Token + primitives

- [ ] Thêm token §2.2 vào `globals.css`.
- [ ] Build primitives §5 (NeonCard, HudPanel, GlowButton, GridBackdrop,
      ScanlineOverlay, SectionEyebrow/Heading, JsonSpecimen).
- [ ] Storybook cho từng primitive.

Done khi: primitives render đúng neon + typecheck/test pass.

### Phase 2 — Sections tĩnh (không cần video)

- [ ] S1 (hero copy + CTA, preview = placeholder) → S2 → S3 → S4 → S5 → S6 →
      S9 → S10 → S12.
- [ ] Wire toàn bộ copy §4.

Done khi: 1 page cuộn đầy đủ 12 section, desktop + mobile responsive.

### Phase 3 — Motion preview + audio-reactive

- [ ] `BeatPulsePreview` + `Waveform` dùng `packages/audio-analysis`.
- [ ] S7 effect tiles render thật, S8 audio-reactive sync beat, S11 gallery video.

Done khi: hero pulse theo beat thật; S7/S8/S11 có demo thật.

### Phase 4 — Hardening

- [ ] `prefers-reduced-motion`, lazy-load, SEO metadata, OG image.
- [ ] Lighthouse perf / a11y ≥ 90.
- [ ] E2E smoke (Playwright) cho CTA + scroll sections.

Done khi: landing production-ready.

---

## 12. Chốt cuối

```txt
AI creates.
JSON keeps it editable.
Audio makes it move.
Neon makes it unforgettable.
```

Landing **kế thừa** design system neon sẵn có của `apps/web`, **thêm** token
marketing riêng, **không** đụng chrome editor, **không** kéo brand Clipkit
(repo fork tham khảo) vào.
