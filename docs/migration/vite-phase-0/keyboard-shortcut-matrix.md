# Keyboard shortcut matrix (legacy baseline)

Source of truth: implementation under `apps/web/components/desktop/editor` + Electron main. **Mod** = Ctrl (Windows/Linux) or Meta (macOS).

Editable targets (`INPUT` / `TEXTAREA` / `SELECT` / `contentEditable`) ignore timeline hotkeys.

## Timeline clips (`useTimelineClipHotkeys`)

| Shortcut | Action | Notes |
|---|---|---|
| Mod+Z | Undo | Requires `canUndo` |
| Mod+Shift+Z | Redo | Requires `canRedo` |
| Mod+Y | Redo | Alternate |
| Mod+C | Copy selected clips | Needs selection |
| Mod+X | Cut selected clips | Needs selection |
| Mod+V | Paste at playhead | Needs clipboard |
| Mod+D | Duplicate selected | Needs selection |
| Mod+B | Split at playhead | Playhead must split selection |
| Mod+Shift+S | Split at playhead | Same as Mod+B |
| Delete / Backspace / Del | Delete selected | Needs selection |

## Playhead (focused) (`Playhead.tsx`)

| Shortcut | Action |
|---|---|
| ← / → | Seek ±1 frame |
| Shift+← / Shift+→ | Seek ±10 frames |
| Home | Seek to 0 |
| End | Seek to duration |

## Pointer / marquee sessions

| Shortcut | Action |
|---|---|
| Escape | Cancel marquee / pointer session (rollback preview) |

## Clip focus (Tracks)

| Shortcut | Action |
|---|---|
| Enter / Space on focused clip | Select clip (DOM activation) |

## Explicit non-bindings (do not invent on Vite as “parity”)

| Key | Legacy behavior |
|---|---|
| Space (global) | **Not** play/pause — TransportBar button only |
| Mod+S | Not wired as save hotkey in timeline (persistence is autosave / menu) |

## Electron shell (unpackaged)

| Shortcut | Action |
|---|---|
| F12 | Toggle DevTools |
| Ctrl+Shift+I | Toggle DevTools |
