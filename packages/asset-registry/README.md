# `@motionvideo/asset-registry`

Đăng ký và xử lý **asset an toàn** cho MotionVideo: font whitelist (Tiếng Việt), import/sanitize SVG từ Figma/Illustrator, reconcile re-import.

## Vai trò

- Whitelist font OFL/Apache dùng được với copy Việt
- Sanitize SVG export (reject script / URL ngoài)
- Map leaf parts → fingerprint; giữ identity khi re-import

## API chính

```ts
import {
  listSafeFonts,
  vietnameseSafeFonts,
  assertSafeSvgExport,
  importSvgExport,
  reconcileSvgReimport,
  sanitizeSvgExport,
  SvgImportError,
} from "@motionvideo/asset-registry";
```

Binary font/image/video **không** nằm trong package — sống dưới `docs/fixtures/v2/assets/` hoặc CDN/product storage.

## Docs

- SVG cut-out / import: [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md)
- Fixture import: `docs/fixtures/v2/imports/`
