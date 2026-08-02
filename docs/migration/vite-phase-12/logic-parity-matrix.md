# Logic parity matrix (Logic-6)

Tracks command/domain coverage across desktop Vite. Each row should have at least one automated test. Update Vite status when slices land.

Status: `pass` | `partial` | `fail` | `n/a` | blank

| Domain | Behavior / command | Automated coverage | Vite | Notes |
|--------|--------------------|--------------------|------|-------|
| **Window** | minimize / maximize / close IPC | `register-ipc-dispose.test.ts` | pass | |
| **Window** | close-save handshake | `e2e-packaged-lifecycle.mjs` + DesktopApp confirm | pass | Logic-5 Vite prod (not NSIS) |
| **Project** | new / open / save / saveAs | `project-lifecycle.test.ts` | pass | atomic + `.bak` |
| **Project** | crash journal recover/discard | `project-journal-service.test.ts` | pass | Logic-1 + P1 barrier/validate |
| **Timeline** | move / trim / split / delete | `deterministic-commands.test.ts` | pass | goldens |
| **Timeline** | undo / redo | `deterministic-commands.test.ts` + session | pass | |
| **Timeline** | advanced scaffold map | `advanced-timeline-scaffold.test.ts` | partial | Logic honesty map |
| **Lane** | lock / mute / reorder | lane flag ops + scaffold | partial | reorder UI partial |
| **Assets** | import / resolve / missing | asset IPC schemas + service | partial | packaged URL soak open |
| **Inspector** | transform / opacity / metadata | `property-registry.test.ts` | pass | |
| **Inspector** | color / enum / vector / style / text / media | `property-registry.test.ts` Logic-2 | pass | UI editors wired |
| **Inspector** | audio volume/fade · effects · keyframe | `property-registry.test.ts` Logic-2 | pass | domain cmds; deep UI later |
| **Playback** | play / pause / seek | phase-6 session + PreviewStage | pass | |
| **Stage** | DOM default; canvas-experimental only | `stage-renderer-contract.test.ts` | pass | Logic-4; no PixiJS |
| **Export** | preview / fhd presets | export service + CLI smoke | pass | |
| **Export** | uhd / 4k scale=2 size assert | `export-presets-4k.test.ts` | pass | Logic-3 |
| **Export** | frame vs encode bench | `bench-export-split.mjs` | partial | engineering, not gate |
| **Project** | lifecycle save/reopen (real service) | `lifecycle-file-io.test.ts` + `test:e2e:lifecycle` | pass | Logic-5 honesty |
| **Window** | dirty close Cancel / Save ok / Save fail | `e2e-packaged-lifecycle.mjs` | pass | asserts confirmClose branches |

## How to extend

1. Add domain command + unit test under `packages/editor-core` or `apps/desktop/src/__tests__`.
2. Flip **Vite** to `pass` and link the test file in **Automated coverage**.
3. Keep `docs/migration/vite-phase-0/parity-checklist.md` in sync for fixture/golden IDs.
