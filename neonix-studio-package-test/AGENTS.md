# Neonix HTML Project

## Workflow

1. Read `RULE.md` and `neonix-capabilities.json` before editing.
2. Keep `neonix.config.json` valid and treat its composition as the source of truth.
3. Use only supported HTML tags and CSS properties.
4. Run `npm run studio` after source changes to inspect the composition preview.
5. Keep the composition dimensions fixed; do not turn the scene into a responsive web page.

## Project layout

- Author HTML in `src/scene.html`.
- Author CSS in `src/scene.css`.
- Keep images, videos, audio and fonts in `assets/`.
- The `@neonix/studio` package serves only a local preview iframe. It does not compile HTML/CSS to JSON yet.

## Composition

This project uses the `1:1` composition preset. CSS coordinates are authored in composition space, not browser viewport space.
