# `@motionvideo/template-library`

Kệ sản phẩm của MotionVideo: **Motion Block → (Pattern) → Template**, cộng retrieval theo tag/ngành.

AI / editor **không** bịa animation tùy ý — chọn `id` đã duyệt trên kệ, gắn vào Motion JSON (`@motionvideo/motion-schema`).

## Chức năng

| Phần | Vai trò |
|---|---|
| **`src/blocks/`** | Motion Library — preset vào/ra/nhấn + text/shape/… |
| **`src/templates/`** | Template seed (scene + layer + animation sẵn) |
| **`src/retrieve.ts`** | Lọc template theo `industry` / `tags` / `aspectRatio` (RAG vector sau) |

```text
Block (fade-up, counter…)
  → Pattern (big-number, compare-2…)   # sắp thêm
    → Template (F&B hook→offer→cta…)
      → MotionProject JSON → preview / render
```

## Motion Library (`src/blocks/`)

```text
text/  shape/  media/  chart/  character/  camera/
entrance/  exit/  emphasis/  transform/  transition/
timing/  audio/  effects/
library.ts   # thứ tự kệ (motionLibrary)
catalog.ts   # motionBlocks (id duy nhất) + get/list helpers
```

Hai trục:

- **kind** — target layer (`text`, `shape`, …)
- **intent / shelf** — vai trò timeline (`entrance`, `exit`, `emphasis`, …)

**Timing** không phải block: `delay` / `duration` / `easing` nằm trên mọi animation trong schema.

Lab preview: app web `/app/lab/blocks`.

## API chính

```ts
import {
  motionBlocks,
  motionLibrary,
  getMotionBlock,
  listMotionBlocksByKind,
  listMotionBlocksByIntent,
  listMotionBlocksByShelf,
  templates,
  retrieveTemplates,
} from "@motionvideo/template-library";
```

Ví dụ animation trong template:

```ts
{ preset: "fade-up", start: 0, duration: 0.8, delay: 0.2, easing: "easeOut" }
```

## Nguyên tắc kệ

1. Block mới phải có `id` ổn định (`text.fade-up`), preview lab, và (lý tưởng) gắn ≥1 pattern/template.
2. Không commit 200 preset marketing — MVP ~30–40 block đủ tổ hợp.
3. Chữ tiếng Việt: stagger theo **từ**, typewriter theo **grapheme** — không tách dấu.
4. Code sống trong **`src/`**. Không dùng folder stub `blocks/` / `templates/` ở root package.

## Docs liên quan

- Repo: [`README.md`](../../README.md), [`workflow.md`](../../workflow.md)
- Kế hoạch block: [`docs/blocks-plan.md`](../../docs/blocks-plan.md)
