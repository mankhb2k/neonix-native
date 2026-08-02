# Vite UI parity contract (N2)

Reference: `apps/web/components/desktop/**` (visual/keyboard only — do not import).

## Baselines

Capture at **1280×720** and **1920×1080**:

| Surface | Notes |
|---------|--------|
| Hub home | empty + with recent |
| Editor shell | titlebar + header + panels |
| Sidebar | each tab: Layers/Media/Text/Elements/Audio |
| Timeline | playhead, selection, empty lanes |

Store under `docs/migration/vite-ui/baselines/` when screenshots are taken (manual or future Playwright).

## Interaction matrix

For each control: hover / focus / disabled / loading / empty / error / dragging.

## Classification

| Item | Policy |
|------|--------|
| Tokens / spacing / icons | copy-CSS / adapt |
| Hub create dialog | adapt-behavior (DesktopAPI) |
| Timeline DnD | adapt-behavior (session commands) |
| AppLink / Next router / Zustand | **do-not-port** |
| Mock library / fake Pro badge | **do-not-port** |
| Inspector deep sections | **do-not-port** until shell complete |

## Keyboard

| Shortcut | Behavior |
|----------|----------|
| Ctrl+Z/Y | Undo/Redo via session |
| Ctrl+C/X/V | Clipboard via session |
| Escape | Cancel rename / library drag / dialog |
| Delete | Delete selected clips |
