# `@motionvideo/ai-planner`

Lớp **AI Author stub**: brief/brand/script → chọn template → điền text/màu → `MotionProject` đã parse Zod.

## Vai trò

```text
PlanInput (brand, industry, script, tags…)
        ↓
  retrieve template (template-library)
        ↓
  fill scenes / brand
        ↓
parseMotionProject → MotionProject
```

Internals hiện tại là stub deterministic (không gọi LLM). Giữ signature `planMotionProject` khi thay bằng planner thật — output luôn phải qua schema.

## API chính

```ts
import { planMotionProject, type PlanInput } from "@motionvideo/ai-planner";

const project = planMotionProject({
  brandName: "Cà Phê Sáng",
  industry: "fnb",
  script: "Hook…\nOffer…\nCTA…",
  templateId: "fnb-hook-offer-cta",
});
```

## Phụ thuộc

- `@motionvideo/motion-schema` — validate output
- `@motionvideo/template-library` — seed templates
- `@motionvideo/motion-grammar` — (sẵn cho pattern scene; stub hiện retrieve theo template)

## Docs

- Acceptance AI User chỉ sửa public surface: [`docs/product-primitive-acceptance.md`](../../docs/product-primitive-acceptance.md)
