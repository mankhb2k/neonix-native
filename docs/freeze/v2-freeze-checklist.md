# Motion Format v2 — Freeze checklist (R9)

Status: **ready for intentional freeze after gates below pass**.

## Required gates

1. [x] R0 contract truth — capability ledger + AI manifest
2. [x] R2 professional tracks — cubic/spring/markers
3. [x] R3 layout/typography — solver + fit-text
4. [x] R4 layered 2.5D — depth/parallax/projection snapshot
5. [x] R5 compositing — isolation/adjustment/matte/motion-blur
6. [x] R6 driver graph + motion recipes (allowlisted)
7. [x] R7 planner/critic/repair loop (deterministic stub)
8. [x] PR-3 kinetic vertical slice fixtures
9. [x] R8 RenderSnapshot contract + Pixi adapter sync (DOM fallback same contract)
10. [ ] Packaged Electron lifecycle soak (deferred desktop packaging)

## Compatibility policy after freeze

- Breaking schema changes require `formatVersion` bump or migration.
- New capabilities use versioned capability IDs; unknown required capability fails closed.
- AI surface ⊆ ledger `implemented|partial` only.
- No silent semantic fallbacks.

## Commands

```bash
pnpm validate:v2-fixtures
pnpm validate:ai-fixtures
pnpm --filter @motionvideo/motion-schema test
pnpm --filter @motionvideo/motion-runtime test
pnpm --filter @motionvideo/ai-planner test
pnpm --filter @motionvideo/pixi-renderer test
```
