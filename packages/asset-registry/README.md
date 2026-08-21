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

Binary font/image/video **không** nằm trong package — sống dưới `assets/` hoặc CDN/product storage.

Atomic Protocol V2 references image and video assets by `payload.assetId`. The V2 project
may carry a small renderer-neutral `assets[]` descriptor list; this package can
provide the manifest/storage adapter that resolves those ids to URLs or local
files. GPU textures remain owned by preview backends and are never stored in
Protocol JSON.

## Docs

- V2 architecture: [`docs/guide/v2-architechture.md`](../../docs/guide/v2-architechture.md)
- Fixture import: `assets/`
