# Phase 7 — Asset pipeline desktop (MVP)

## Decisions

- Copy-on-import into `<projectDir>/assets/` beside the `.mt` file
- Import requires a saved project path (Save As first)
- Identity = stable `asset_*` id; `uri` is always relative (`assets/<file>`)
- Resolve via `mvmedia://media/<token>/<uri>` with path containment
- Relink = copy replacement into `assets/` + update envelope `project.assets` (dirty)
- Missing assets: `listMissing` / `MISSING_ASSET` — UI badge, no crash
- Thumbnail / waveform cache: **deferred** (stub only)

## Checklist

- [x] IPC contracts: `ImportedAsset`, `ResolveAssetInput`, `RelinkAssetInput`, `listMissing`
- [x] Error codes: `MISSING_ASSET`, `PATH_DENIED`
- [x] `resolveContainedPath` rejects absolute / `..` escape
- [x] `asset-file-service` import / resolve / relink / listMissing
- [x] `mvmedia` privileged protocol + CSP `img-src` / `media-src`
- [x] Renderer `AssetRepository` + `AssetPanel` (import / missing / relink)
- [x] Merge into `documentJson` with V2-compatible placeholder metadata
- [x] Relink returns/merges probed `width` / `height` / `duration`; keeps prior when probe omits
- [x] Unit tests: path containment, copy import, move folder, missing, relink
- [ ] Thumbnail / waveform disk cache (follow-up)
- [ ] Timeline media drop / clip URIs (Phase 5+)
- [ ] ffprobe real dimensions / duration beyond current import probe (follow-up)

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. New project → Import disabled (“Save project first”)
3. Save As → Import PNG → appears under `assets/` and in panel
4. Delete the copied file on disk → Missing badge → Relink
5. Move the project folder → reopen → resolve still works (relative uri)

## Automated

`pnpm --filter @motionvideo/desktop test` — `asset-pipeline`, `document-assets`, IPC schema coverage.
