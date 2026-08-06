# Zero-template go/no-go report

Generated as part of Sprint E MVP harness. Re-run metrics with:

```bash
pnpm exec tsx scripts/run-zero-template-eval.ts --runs 3
pnpm exec tsx scripts/run-zero-template-eval.ts --runs 10 --briefs Z1 --variance
AI_MODE=live ANTHROPIC_API_KEY=... pnpm exec tsx scripts/run-zero-template-eval.ts --runs 3
```

Scorecards land in `tmp/ai-eval/scorecard-*.json`.

## Hard gates (§3.1)

| Gate | How measured | Template phase unlock |
|---|---|---|
| 100% parse or structured diagnostics | Orchestrator Zod parse / explicit errors | Required |
| 100% no CSS/TSX/JS in project | Command-batch only path | Required |
| ≥90% compile after ≤2 model repairs | Eval `compileOk` + `modelRepairs≤2` | Required |
| ≥90% render MP4 | Optional via `/api/export` post-pass | Required for ship |
| Stable selectable IDs | Node IDs in project + editor hit-test | Required |
| Silent unsupported = 0 | Blocked commands throw; stubs emit diagnostics | Required |
| Preview/export same runtime | Remotion snapshot + render-worker draw | Required |

## Product gates (§3.2)

Tracked qualitatively in stub mode; live rubric scoring is manual until visual judge lands.

## Claude Code + Remotion đối chứng (§10)

See [`docs/zero-template-claude-code-runbook.md`](./zero-template-claude-code-runbook.md).

## Decision rule (§13)

- **Go template phase** only if hard gates pass on 10×3 (30) runs.
- If hard gates fail: improve planner/critic/vocabulary — do **not** add templates.
- If hard gates pass but product gates low: continue zero-template iteration.

## Current MVP status (stub scorecard)

Latest harness (`pnpm eval:zero-template -- --runs 3`):

- **30/30** compile+critic OK (100% pass rate, 100% compile rate)
- Z1 variance 10/10 OK (`--runs 10 --briefs Z1 --variance`)
- Hard gates (stub): parse OK, no CSS/TSX/JS, empty scenes = 0, invented assets = 0, silent unsupported = 0
- Live Anthropic + MP4 export rates: fill from `AI_MODE=live` scorecard + `/api/export` before flipping template-phase go

### Shipped

- P0 allowlist + transition vocab + PNG probe CLI
- Sprint A gateway/orchestrator/API/Z1
- Sprint B multi-scene + 2 model repairs + variance
- Sprint C image/svg commands + asset ingest + Z2/Z10
- Sprint D Ask AI → API → Apply (undoable) + refine + envelope generation meta
- Sprint E fixtures Z1–Z10 + eval harness + this report + Claude Code runbook
