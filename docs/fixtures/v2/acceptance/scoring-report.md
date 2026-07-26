# Acceptance pack scoring report

Scored by: agent · Date: 2026-07-25
Pass threshold: ≥ 10/12 with compile/export ≠ 0

**Result: 11/12 agent-scored, 1 fail**

| Id | Map | C | E | P | V | T | R | Total | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| accept-process-trim | infographic | 2 | 2 | 2 | 1 | 2 | 2 | 11 | agent-scored | Trim line + title OK; timeline-steps instance sits off 1:1 frame (9:16 layout) so process list not visible at t=1. |
| accept-bignumber-paint | infographic | 2 | 2 | 2 | 1 | 2 | 2 | 11 | agent-scored | Gradient panel + glow + dashed stroke clear; big-number text clipped by aspect mismatch (component 9:16 on 1:1). |
| accept-compare-blend | infographic | 2 | 2 | 2 | 0 | 1 | 2 | 9 | fail | Only screen-blend highlight visible; compare cards off-frame — fails compare brief at sample frame. |
| accept-tvc-hook | product-tvc | 2 | 2 | 1 | 2 | 2 | 2 | 11 | agent-scored | Hook scene readable (discount copy + accent); multi-scene/audio/camera composition holds TVC intent. |
| accept-showcase-lookat | product-tvc | 2 | 2 | 2 | 1 | 2 | 2 | 11 | agent-scored | Motion-path + look-at markers visible; product showcase body mostly cropped — partial product-TVC read. |
| accept-ribbon-promo | product-tvc | 2 | 2 | 2 | 2 | 2 | 2 | 12 | agent-scored | Gradient card, label, and bent ribbon read clearly as promo; strongest paint/modifier combo frame. |
| accept-cutout-talk | cut-out | 2 | 2 | 1 | 2 | 2 | 2 | 11 | agent-scored | Cut-out rig + prop in frame; talk/wave actions and VO-backed dialogue map satisfied. |
| accept-prop-mask | cut-out | 2 | 2 | 1 | 2 | 2 | 1 | 10 | agent-scored | Hierarchy limbs + prop + spotlight mask readable; fixture enrich more than packaged public API. |
| accept-look-at | cut-out | 2 | 2 | 1 | 2 | 2 | 1 | 10 | agent-scored | Eye/target look-at composition clear with caption; good constraint demo, not a product MVC. |
| accept-secondary-wave | mascot | 2 | 2 | 1 | 2 | 2 | 1 | 10 | agent-scored | Secondary rotation chain silhouettes + caption; mascot-wave map satisfied as primitive composition. |
| accept-path-morph | mascot | 2 | 2 | 1 | 2 | 2 | 1 | 10 | agent-scored | Morph fills/strokes + caption present; expression accent intent clear. |
| accept-action-loop | mascot | 2 | 2 | 1 | 1 | 2 | 2 | 10 | agent-scored | Four action instances render as tiny markers; playback wiring OK but visual punch weak at t=1. |

## Weak / fail
- **accept-compare-blend** (total 9): Only screen-blend highlight visible; compare cards off-frame — fails compare brief at sample frame.

## Artifacts
- MP4: `tmp/acceptance-score/*.mp4`
- Machine scores: `acceptance/machine-scores.json`
- Failure log: `acceptance/failure-log.json`

Status `agent-scored` is not Designer signed-off. Re-run: `pnpm score:acceptance-pack`.
