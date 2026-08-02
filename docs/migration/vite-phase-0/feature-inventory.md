# Desktop editor — feature inventory (legacy baseline)

Inventoried from `apps/desktop` + `apps/web/components/desktop/editor` and related `lib/editor` (2026-07-31). Behavior-preserving reference for Vite migration; not a redesign backlog.

## 1. Electron shell (`apps/desktop`)

| Feature | Notes |
|---|---|
| Frameless main window | 1440×900 default, min 1024×640, dark `#0A0A0B` |
| Preload bridge | `window.motionvideoDesktop`, contextIsolation + sandbox |
| Load renderer URL | `MOTIONVIDEO_DESKTOP_URL` or default `http://localhost:3000/app` |
| Renderer mode flag | `MOTIONVIDEO_RENDERER=legacy\|vite` (Phase 0+) |
| Window controls IPC | minimize / maximize toggle / close / isMaximized |
| Close-save handshake | `desktop:requestCloseSave` → renderer flush → `desktop:confirmClose` |
| External links | `setWindowOpenHandler` → `shell.openExternal` |
| DevTools | F12 / Ctrl+Shift+I (unpackaged only) |
| App menu | Hidden (`Menu.setApplicationMenu(null)`) |

## 2. Desktop chrome (in web renderer)

| Feature | Location |
|---|---|
| Title strip / caption drag | `DesktopTitleStrip`, `TitleBar` |
| Menu bar | `DesktopMenuBar` |
| Window control buttons | `DesktopWindowControls` |
| Close-save flush | `DesktopEditorShell` |
| Hub chrome | `components/desktop/hub/*` |

## 3. Editor workspace layout

| Area | Feature |
|---|---|
| Sidebar tabs | Layers (frame), Elements, Text, Upload/Media, Stickers, Audio |
| Stage | `PreviewStage` (Pixi), panel header “Trình phát” |
| Inspector / right dock | `RightDock`, property sections |
| Timeline | `Timeline` / `TimelineBoard` / Tracks / Ruler / Transport / Playhead |
| Panel resize | Sidebar, right dock, timeline heights via `usePanelResize` |
| Global drag preview | `GlobalDragPreview` |

## 4. Timeline

| Feature | Status in legacy |
|---|---|
| Lanes (base / overlay / audio) | Yes |
| Clip items (scene / audio) | Yes |
| Time ruler + zoom / fit | Yes |
| Playhead scrub + keyboard seek | Yes (when focused) |
| Transport play/pause/seek UI | Yes — **no Space hotkey** |
| Clip DnD (same / cross lane) | Yes |
| Resize / trim | Yes (`clip/trim`) |
| Split at playhead | Yes |
| Marquee select | Yes |
| Auto-scroll during drag | Yes |
| Virtualization / visible-range | Yes (DOM budget tests) |
| Lane lock / mute / visible / rename / reorder | Yes |
| Transitions command seam | `transition/add` present |

## 5. Document & persistence

| Feature | Notes |
|---|---|
| Format | `motion-project` `formatVersion: 2` |
| Storage envelope | `storageVersion: 2` + clips/lanes + overlay sidecar |
| Keys | `motionvideo.project.<id>`, index, legacy `motionvideo.projects` migrate |
| Autosave | localStorage via adapter |
| Undo / redo | History manager on command apply |
| Clipboard | Copy / cut / paste / duplicate clips |
| Selection | Clip / lane / none |
| Migrations | `project-migrations.ts`, timeline lane migration |

## 6. Playback & preview

| Feature | Notes |
|---|---|
| Playback clock store | Separate from document Zustand updates per frame |
| PreviewStage Pixi | Scene adapter / evaluator |
| Seek / play / pause | Transport + playhead |

## 7. Assets & export

| Feature | Notes |
|---|---|
| Upload / library panels | Web path / blob oriented |
| Export | HTTP / web worker path — **rewrite in Phase 9** (native FS + utility process) |

## 8. Explicit non-goals for Phase 0 port parity

- Native filesystem project open/save (Phase 4)
- Vite renderer UI (Phase 1+)
- Inspector registry rewrite (Phase 8)
- Plugin marketplace
- Spacebar play/pause (not in legacy — do not invent as “parity”)
