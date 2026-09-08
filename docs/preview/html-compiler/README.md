# HTML compiler tag-lowering fixtures

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
