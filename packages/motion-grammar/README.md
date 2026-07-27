# `@motionvideo/motion-grammar`

**Ngữ pháp cảnh** cho video template: chuỗi role scene (hook → offer → CTA, …) theo ngành.

## Vai trò

Cung cấp pattern cấu trúc storytelling, không chứa node/keyframe. AI planner / gallery dùng để chọn khung scene trước khi fill content.

## API chính

```ts
import {
  grammarPatterns,
  getGrammarForIndustry,
  type SceneRole,
  type GrammarPattern,
} from "@motionvideo/motion-grammar";

const patterns = getGrammarForIndustry("fnb");
// → hook-offer-cta, …
```

| Role | Ý nghĩa |
|---|---|
| `hook` | Mở đầu / thu hút |
| `pain` | Nỗi đau |
| `benefit` | Lợi ích |
| `demo` | Minh họa sản phẩm |
| `offer` | Ưu đãi |
| `cta` | Kêu gọi hành động |
| `logo` | Brand / outro |

## Docs

- Templates dùng grammar: `@motionvideo/template-library`
