# P0 schema freeze checklist

**Frozen:** 2026-07-25. Format stays `formatVersion: 2`. After freeze, schema PRs require ± fixtures and an explicit breaking/non-breaking note. Breaking changes require `formatVersion` bump or an `extensions` namespace.

Gate run (green): `pnpm typecheck`, `pnpm validate:v2-fixtures` (27+/107−/40 limits/17 Runtime/113 coverage), `pnpm validate:primitives`.

## Design decisions (locked)

| Decision | Normative rule |
|---|---|
| Transitions | `cut \| fade \| crossfade` only; wipe rejected |
| Paint | Solid string fill/stroke only; gradient/dash/trim are P1 rejects |
| Cut-out | No `RestPose` / `RigMapper` types; use `sourceImports` + `cutoutRigs` + `bone.payload.restRotation` |
| Resolvable values | Only on clip/track/playback/params already typed; `text.payload.text` stays `string` |
| Binding targets | One binding per `(nodeId, property)` (component) or `(sceneId, nodeId, property)` (project); one variable may drive many targets |
| Patch | `set` only on project variables or Component Instance `payload.props.*` public surface |
| AI vocabulary | Enumerate capabilities with `public: true` on P0 node types only |

## Audit: Partial → action

| Catalog row | Action | Evidence |
|---|---|---|
| Artifact identity / Stable ID / Integrity / Semver | Promote schema | `negative/schema/wrong-format*`, `empty-id`, `source-integrity-mismatch`, `unpinned-component` |
| JSON literal / Resolvable | Close gap | round-trip assert + missing variable + finite map |
| Variable / Binding / Public param | Close gap | `variables-all-types`, duplicate-target reject, public-param type mismatch |
| Keyframe / Track / Schedule / Clip | Close gap | `duplicate-key-time`, key-over-duration, schedule missing/cycle |
| Playback / Preset / Named Action / Clock | Promote | `schedule-playback`, `action-playback` |
| Transform / Hierarchy / World matrix | Promote schema (Web N/A) | `hierarchy-transform` + primitives validate |
| Draw order / Bounds / Hit-test | Promote schema; visual worker separate | mask/hierarchy goldens |
| Group / Text / SVG / Bone | Promote schema; Web deferred | media/cutout/hierarchy fixtures |
| Shape / Path / Image / Video / Camera / Component | Promote | geometry/media/camera projects |
| Mask / Effects / Morph / Motion Path / Secondary / Repeater / Text Animator | Promote | existing goldens |
| Cut-out import / variants / lip-sync / prop | Promote schema | imports + cutout-dialogue |
| Rig Mapper / Rest Pose | Defer as mapped fields (not new types) | cutout-character |
| Scene / Timeline | Close gap | sceneOrder orphan/duplicate/unscheduled negatives |
| Audio / Assets / Media probe | Promote | media-assets |
| Font resolver | Close gap | fontAssetId unknown/wrong-type negatives |
| Patch | Close gap | parse + `applyMotionPatch` public-surface |
| Inspector / Timeline UI / Canvas / Import UI | Defer N/A | not Motion Format surface |
| Preview / Web parity | Defer N/A for freeze | browser roadmap |
| P1 rows | Keep reject wall for remaining P1 | `negative/p1-not-normative/*` (emitter, two-bone-ik, audio-marker) |

## Post-freeze additive primitives (2026-07-25)

Additive (non-breaking, `formatVersion` stays 2): Trim Path, Gradient fill, Dash, Blend mode (`normal|multiply|screen|add`), Path Bend (chord + sin(πt) offset), Constraint (`look-at|copy-position|copy-rotation` with topo evaluation + cycle reject). Evidence: projects/negatives above + Runtime/PNG goldens.

## Freeze gate evidence

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Discriminated Node/asset/effect/modifier unions + `.strict()` | Pass | `v2.ts`; `unsupported-node-type`, `group-extra-payload`, P1 rejects |
| 2 | Property paths via capability registry | Pass | `capabilities.ts`; unsupported-property / runtime-unsupported-property |
| 3 | P0 coverage contract/reference/limits | Pass | `primitives-coverage.json` (113) asserted in `validate:v2-fixtures` |
| 4 | Compile-time constructs absent from Runtime IR | Pass | repeater/text-animator/component/lipSync asserts in validate script |
| 5 | Limits + reference graph | Pass | 40 limit cases + negative matrix |
| 6 | Four compositions compile deterministic | Pass | mapped: effects+text-animator+repeater, media+camera, cutout-dialogue, bone-secondary+hierarchy |
| 7 | AI registry = public P0 surface | Pass | validate assert enumerates public caps; no P1 node types |

## Commands

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm validate:primitives
```

## Post-freeze policy

1. Do not add P1 fields to normative unions without removing the matching `p1-not-normative` reject and adding full ± / Runtime fixtures.
2. Schema change without fixture change is incomplete.
3. `formatVersion` remains 2 until a breaking authoring IR change.
