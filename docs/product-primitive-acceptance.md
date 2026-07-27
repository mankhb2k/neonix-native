# Product primitive acceptance

Product validation loop for Motion Format v2 atoms: composition acceptance pack, scorecard, export smoke, failure triage, and phased Web/AI Author gates.

Related ledgers: [`fixtures/v2/acceptance/scorecard.json`](fixtures/v2/acceptance/scorecard.json), [`roadmap-status.md`](roadmap-status.md), [`primitives-object.md`](primitives-object.md).

## Scope

Phase A validates that P0 vocabulary can express 12 real compositions across four maps (infographic · product TVC · cut-out · mascot). Playwright browser screenshot parity is **not** required for Phase A visual pass — worker PNG + MP4 are the source of truth.

## Rubric (0–2 each; pass ≥ 10/12, Compile/Export ≠ 0)

| Criterion | Meaning |
|---|---|
| compile | Parse + Runtime IR deterministic |
| exportMp4 | Encode smoke / product export |
| publicApi | AI User patch stays on variables / `payload.props` |
| visualIntent | Matches brief |
| timing | Readable easing / schedule |
| reuse | Instance + prop swap |

Score rows live in `docs/fixtures/v2/acceptance/scorecard.json`. Open gaps go to `failure-log.json` before any schema change.

## Pack (12)

| Id | Map | Project |
|---|---|---|
| accept-process-trim | infographic | `projects/accept-process-trim.mt.json` |
| accept-bignumber-paint | infographic | `projects/accept-bignumber-paint.mt.json` |
| accept-compare-blend | infographic | `projects/accept-compare-blend.mt.json` |
| accept-tvc-hook | product-tvc | `projects/accept-tvc-hook.mt.json` |
| accept-showcase-lookat | product-tvc | `projects/accept-showcase-lookat.mt.json` |
| accept-ribbon-promo | product-tvc | `projects/accept-ribbon-promo.mt.json` |
| accept-cutout-talk | cut-out | `projects/accept-cutout-talk.mt.json` |
| accept-prop-mask | cut-out | `projects/accept-prop-mask.mt.json` |
| accept-look-at | cut-out | `projects/accept-look-at.mt.json` |
| accept-secondary-wave | mascot | `projects/accept-secondary-wave.mt.json` |
| accept-path-morph | mascot | `projects/accept-path-morph.mt.json` |
| accept-action-loop | mascot | `projects/accept-action-loop.mt.json` |

## Verify commands

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm validate:primitives
pnpm validate:acceptance-export
pnpm validate:acceptance-web-parity
pnpm score:acceptance-pack
pnpm score:designer-corrections
pnpm e2e:render
```

Agent scoring of the 12 compositions: `pnpm score:acceptance-pack` → updates [`fixtures/v2/acceptance/scorecard.json`](fixtures/v2/acceptance/scorecard.json) and [`fixtures/v2/acceptance/scoring-report.md`](fixtures/v2/acceptance/scoring-report.md) (`status: agent-scored`, not Designer signed-off).

Optional Web checks (not Phase A visual truth):

```bash
pnpm test:preview-parity
pnpm --filter @motionvideo/web exec playwright test e2e/acceptance-web-parity.spec.ts
```

Intentional golden updates only:

```bash
pnpm update:v2-goldens
pnpm update:v2-frame-goldens
pnpm validate:acceptance-web-parity -- --write
```

## Failure triage

| Fail type | Action |
|---|---|
| Bug evaluator/draw/compiler | Fix code + intentional golden update |
| Docs / schema ambiguity | Fix `motion-format-v2.md` / catalog |
| Missing capability (cannot express brief) | Open P1 with failing composition fixture first |
| Preview Web ≠ export | Parity bug only — do not change schema |

P1 candidates (Parallax, animated gradient stops, constraint `pin`, emitter, 2-bone IK, audio markers) open only when the same missing capability fails ≥ 2 compositions.

## Product path

- Editor and `/appai` **Xuất video** both call `exportMotionProject` → `POST /api/export` → render-worker CLI.
- `/appai` seeds from `template-library` (`fnb-hook-offer-cta`) and applies public draft fields (name, brief, brand color).
- **`/factory`** is the Designer + AI Author Component Factory: Magnific-style Scene Block flow canvas (palette → connect → Public API Controls → validate/export). Catalog at `/factory/catalog`; certify workspace at `/factory/components/[id]`. Registry: `registry/scene-components.json`.
- Block Lab CSS is not an acceptance truth surface.

## Phase C — Web parity (subset)

Worker PNG checksums for four map representatives: `acceptance/web-parity-baseline.json` via `pnpm validate:acceptance-web-parity`.

Browser transform harness: `/appai/runtime-harness?fixture=accept-look-at` + Playwright `acceptance-web-parity.spec.ts`. Full Canvas pixel ≈ worker PNG remains deferred per `browser-preview-atomic-roadmap.md`.

## Phase D — AI Author / Designer corrections

Ledger: `acceptance/designer-corrections.json`. Seed briefs with `pnpm score:designer-corrections -- --init`. Ready when ≥4 runs, average internal edits ≤2, public-only rate ≥75%.
