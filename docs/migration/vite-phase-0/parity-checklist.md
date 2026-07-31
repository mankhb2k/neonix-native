# Parity checklist — Legacy (Next) vs Vite

Phase 0 fills **Legacy** only. **Vite** stays blank until the matching vertical slice lands (Phase 5+). Status: `pass` | `fail` | `n/a` | blank.

Fixtures: [`fixtures/`](./fixtures/) · Goldens: [`goldens/`](./goldens/) · Shortcuts: [`keyboard-shortcut-matrix.md`](./keyboard-shortcut-matrix.md)

| ID | Behavior | Fixture / golden | Legacy | Vite | Status |
|---|---|---|---|---|---|
| P0-SHELL-01 | Electron boots frameless window | — | pass | pass | Phase 12 default Vite |
| P0-SHELL-02 | `MOTIONVIDEO_RENDERER=legacy` loads Next URL | — | pass | n/a | Rollback path retained |
| P0-SHELL-02b | Default / unset loads Vite | — | n/a | pass | Phase 12 cutover |
| P0-SHELL-03 | Close-save handshake before quit | — | pass | pass | |
| P0-SHELL-04 | Window minimize / maximize / close IPC | — | pass | pass | |
| P0-DOC-01 | Open seeded small project | `fixtures/small.project.json` | pass | pass | Shell + project I/O |
| P0-DOC-02 | Open medium (overlay + audio) | `fixtures/medium.project.json` | pass | | Partial |
| P0-DOC-03 | Open large (dense timeline) | `fixtures/large.project.json` | pass | | Partial (virtualization MVP) |
| P0-DOC-04 | Persistence envelope `storageVersion: 2` | fixtures | pass | pass | |
| P0-CMD-01 | Move clip | `goldens/move-clip.after.json` | pass | | Phase 5 open |
| P0-CMD-02 | Trim / resize clip | `goldens/trim-clip.after.json` | pass | | Phase 5 open |
| P0-CMD-03 | Split at playhead | `goldens/split-clip.after.json` | pass | | Phase 5 open |
| P0-CMD-04 | Duplicate selection | `goldens/duplicate-clip.after.json` | pass | | Phase 5 open |
| P0-CMD-05 | Delete selection | `goldens/delete-clip.after.json` | pass | | Phase 5 open |
| P0-CMD-06 | Undo after move | `goldens/undo-after-move.after.json` | pass | | Phase 5 open |
| P0-CMD-07 | Redo after undo | `goldens/redo-after-undo.after.json` | pass | | Phase 5 open |
| P0-CMD-08 | Lane lock flag | `goldens/lane-lock.after.json` | pass | | Phase 5 open |
| P0-CMD-09 | Lane reorder | `goldens/lane-reorder.after.json` | pass | | Phase 5 open |
| P0-TL-01 | Timeline ruler + clips render | screenshots/timeline | pass | pass | Read-only MVP |
| P0-TL-02 | Virtualization DOM budget (unit) | large / vitest | pass | pass | Phase 10 |
| P0-TL-03 | DnD + auto-scroll (e2e suite) | e2e/timeline | pass | | Phase 5 open |
| P0-KB-01 | Undo/redo/clipboard/split/delete hotkeys | shortcut matrix | pass | | Phase 5 open |
| P0-KB-02 | Playhead arrow / Home / End | shortcut matrix | pass | | Phase 5 open |
| P0-KB-03 | Space is **not** play/pause | shortcut matrix | pass | | |
| P0-PB-01 | Transport play/pause + seek | e2e playback | pass | pass | Phase 6 MVP |
| P0-PB-02 | Preview stage shows scene | screenshots/stage | pass | pass | Phase 6 MVP |
| P0-WS-01 | Workspace layout (sidebar/stage/timeline) | screenshots/workspace | pass | pass | |
| P0-EXP-01 | Export via web HTTP | feature inventory | pass | n/a | Desktop jobs Phase 9 |
| P0-FS-01 | Native project open/save | — | n/a (localStorage) | pass | Phase 4 |

## How to update

1. After a Vite slice ships, run the same fixture/golden/e2e against Vite.
2. Set **Vite** = `pass`/`fail` and **Status** = note or PR link.
3. Do not change Legacy expectations without a documented behavior change PR.
