# Phase 8 — Inspector foundation (MVP)

## Decisions

- Property registry + commands live in `@motionvideo/editor-core` (not timeline command union)
- Desktop session owns selection + history; Inspector emits `EXECUTE_PROPERTY_COMMAND`
- Selection stub: clip/node chips in Inspector (no Phase 5 timeline hit-testing)
- Numeric scrub uses `replaceOrPushHistory` coalesce keys → one undo step
- Feature flag: `INSPECTOR_ENABLED` in `renderer/src/editor/inspector/feature-flag.ts`

## Checklist

- [x] `PropertyDefinition` / mixed helpers / `PROPERTY_REGISTRY` (transform + opacity + name/visible)
- [x] `executePropertyCommand` + clamp via `motionPropertyCapability`
- [x] `replaceOrPushHistory` coalesce
- [x] Session: `SET_SELECTION`, `EXECUTE_PROPERTY_COMMAND`, `UNDO`, `REDO`
- [x] Serialize project back into envelope `documentJson` (dirty)
- [x] InspectorPanel + number/boolean/string editors
- [x] Undo/Redo toolbar
- [x] Mixed multi-clip selection (Ctrl/Cmd-click)
- [ ] Timeline clip hit-testing selection (Phase 5 slice 4)
- [ ] Text / media / animation property groups
- [ ] Preview-only transaction without writing document mid-scrub (optional polish)

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. Open a project with scene clips (or paste fixture JSON)
3. Inspector → select clip → edit X / opacity
4. Scrub label → Undo once returns to pre-scrub
5. Ctrl-click two clips with different X → Mixed

## Automated

- `pnpm --filter @motionvideo/editor-core test` — property-registry + coalesce
- `pnpm --filter @motionvideo/desktop test` — inspector-session
