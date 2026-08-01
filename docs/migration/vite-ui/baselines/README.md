# Screenshot baselines (P15)

- **Baselines** (`*.png` here): Electron-captured `FixtureSurface` at 1280×720 and 1920×1080 (`status: electron-captured` in `manifest.json`).
- **Placeholders** (`placeholders/`): solid-color PNGs only — not used for visual regression.

```bash
# Electron fixture captures (builds renderer, writes PNGs + manifest)
node apps/desktop/scripts/capture-parity-baselines.mjs --electron

# Solid placeholders only
node apps/desktop/scripts/capture-parity-baselines.mjs --placeholders
```

Open fixtures in the app with `?fixture=hub-empty|hub-recent|editor-shell|sidebar-layers|timeline-empty`.

Menus portal into TitleBar (`#desktop-titlebar-menu-portal`); EditorHeader waits for the host (no dual-mount flash).
