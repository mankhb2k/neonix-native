# HTML compiler final-document fixtures

Every fixture is exposed as one final HTML document. The document filename is
not significant; `compileDocument({ html })` requires exactly one
`meta[name="neonix-document"]` with `schemaVersion: 2` and reads CSS from inline
`<style>` resources. The same HTML is used for the browser reference and for
Protocol V2 compilation, so a fixture cannot accidentally test a different CSS
source in each preview.

The canonical shape is:

```html
<!doctype html>
<html>
  <head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
    <style data-neonix-bundle>
      /* fixture CSS */
    </style>
  </head>
  <body><!-- visual HTML --></body>
</html>
```

The fixture registry keeps the legacy `source` field only as a temporary test
inspection aid; its `html` field is the contract consumed by the preview and
the compiler.

## HTML compiler tag-lowering fixtures

The live fixtures are registered in
`apps/web/lib/docs/html-compiler-tag-lowering-fixtures.ts` and rendered at
`/docs/preview/html-compiler`. They appear together in the dedicated
**HTML tag lowering** sidebar section.

| Tag family | Expected Protocol lowering |
| --- | --- |
| `html`, `head`, `meta`, `body` | Document/layout shell; no visual layer by itself |
| `main`, `header`, `section`, `article`, `nav`, `aside`, `figure`, `footer`, `div`, `figcaption` | CSS-driven container: group when it owns children, shape when it is a painted leaf |
| `h1`–`h6`, `p`, `span`, `strong`, `b`, `em`, `i`, `small`, `blockquote`, `pre`, `code`, `br` | Text layer; nested text is flattened and `br` becomes a newline |
| `img` | Image layer plus image asset |
| `video` | Video layer plus video asset |
| `audio` | Root audio track and clip plus audio asset; no visual layer |
| `svg`, `g` | Group/container scope |
| `g` | Nested SVG group preserving the parent coordinate space |
| `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` | Canonical SVG path layer |

The E2E contract is in
`apps/web/e2e/html-compiler-tag-lowering.spec.ts`. It verifies the normalized
Protocol JSON shown by the preview page, not only that the browser iframe is
visible.

## Text compiler and layout fixtures

Text behavior is intentionally evaluated in a separate sidebar section. The
fixtures are registered in
`apps/web/lib/docs/html-compiler-text-compiler-layout-fixtures.ts` and cover:

| Fixture | Focus |
| --- | --- |
| `br-hard-break` | `<br>` source semantics and Protocol text payload |
| `nested-inline-content` | Nested inline tags and flattened text order |
| `whitespace-contract` | `normal` versus `pre` source/layout policy |
| `fixed-line-height` | Explicit line boxes and baseline spacing |
| `wrap-width` | Fixed-width word wrapping |
| `auto-height` | Intrinsic height from wrapped text |

The E2E contract is in
`apps/web/e2e/html-compiler-text-compiler-layout.spec.ts`.

## Ten-second motion export samples

The `export-samples/` directory contains three canonical, single-file HTML
documents used to exercise the complete authoring path:

| File | Theme | Motion focus |
| --- | --- | --- |
| `marketing-launch.html` | Marketing launch | staged title/card entrance and a repeating campaign orb |
| `product-story.html` | Product story | staged narrative reveal and an accent line |
| `creative-brand.html` | Creative / motion brand | kinetic typography, geometric shapes, motion path, depth cards, and logo convergence |

Each document declares a 1920×1080, 30 fps composition. The export harness
overrides the compiler timeline to exactly 10 seconds, writes the compiled
Protocol V2 JSON, prepares text with the same HarfBuzz path used by runtime,
and encodes an MP4 through Skia WASM:

```bash
pnpm --dir apps/web export:html-motion-samples
```

For a fast smoke run, set `HTML_MOTION_FRAME_COUNT=1`; omit it for the full
300-frame export. Outputs are written to `tmp/html-motion-exports/` and are
ignored as generated artifacts. The matching Playwright contract is
`apps/web/e2e/html-motion-export-samples.spec.ts`; it checks the browser at the
same 1920×1080 viewport and captures frame checkpoints at 0, 5, and 9.999
seconds.
