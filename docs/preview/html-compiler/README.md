# HTML compiler fixtures

Every fixture is a self-contained HTML document under
`apps/web/public/docs/html-compiler/fixtures/`. The browser preview and the
compiler both consume the same file URL; TypeScript contains only fixture
metadata, labels and asset registries.

Each document follows this contract:

```html
<!doctype html>
<html>
  <head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"} }'>
    <style data-neonix-bundle>
      /* fixture CSS */
    </style>
  </head>
  <body><!-- visual HTML --></body>
</html>
```

The compiler requires exactly one `meta[name="neonix-document"]` with
`schemaVersion: 2` and reads CSS only from inline `<style>` resources.

The registry is `apps/web/lib/docs/html-compiler-preview.ts`. It maps each
case to a public `fixtureUrl` and keeps the UI metadata separate from the HTML
source. The preview route is `/docs/preview/html-compiler`.

## Fixture coverage

The fixture set covers HTML tag lowering, text compiler/layout, geometry,
paint, effects, transforms/3D, typography/media, animation and combined
pipeline cases. Focused opacity cases are available as:

| Fixture | What it checks |
| --- | --- |
| `opacity-image.html` | Fractional opacity on an image over a solid card |
| `opacity-grid.html` | Opacity on a grid container, child cells and grid lines |
| `opacity-shape.html` | Independent opacity on overlapping shapes |

The tag-lowering and text-layout E2E contracts are
`apps/web/e2e/html-compiler-tag-lowering.spec.ts` and
`apps/web/e2e/html-compiler-text-compiler-layout.spec.ts`.

## Motion export samples

The same fixture directory contains the long-form samples used by the export
harness:

| File | Theme |
| --- | --- |
| `marketing-launch.html` | Marketing launch |
| `product-story.html` | Product story |
| `creative-brand.html` | Creative / motion brand |
| `neonix-overview-60s.html` | Legacy 60-second overview |

The three 10-second samples declare a 1920×1080, 30 fps composition. Export
them with:

```bash
pnpm --dir apps/web export:html-motion-samples
```

For a fast smoke run, set `HTML_MOTION_FRAME_COUNT=1`. Generated outputs are
written to `tmp/html-motion-exports/` and are ignored.
