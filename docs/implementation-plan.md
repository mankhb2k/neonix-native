# Schema-first motion engine implementation plan

## Mission

We are building a schema-first 2D motion composition engine for AI-authored projects. The source of truth is the canonical Motion Format v2 JSON contract. AI-generated components and templates must be parseable, reference-valid, compilable to normalized Runtime IR, and deterministic at render time.

This is not an editor-first project. The Next.js surfaces are consumers of the same contract. Browser preview, export, and future editor controls must read the normalized Runtime IR instead of inventing a second animation model.

## What we are doing in every phase

Every capability follows one repeatable loop:

```text
use case / composition
  -> positive authoring fixture
  -> negative and resource-limit fixtures
  -> strict Zod schema and discriminated types
  -> reference/property/capability validation
  -> compiler expansion or normalization
  -> evaluator/renderer behavior
  -> expected Runtime IR and, where visual, PNG/media golden
  -> documentation and a focused commit
```

A capability is **done** only when its fixture, schema validation, compiler/runtime behavior, and deterministic assertions all pass. A schema-only field is not considered implemented.

## Current state

The completed and committed milestones are tracked in [`roadmap-status.md`](roadmap-status.md). The verified suite covers the foundation through Path Morph and Component Action outer playback (`action.loop`, reverse/alternate).

Counts after Action playback: 24 positive artifacts, 68 negative artifacts, 38 limit cases, 15 Runtime goldens, 14 PNG goldens, 21 pinned assets.

The remaining P0 work is intentionally explicit and **fixtures-first** (positive/negative fixtures before expanding Zod, then compiler/runtime, goldens, docs, commit):

1. Lip-sync cue generation.
2. Secondary Motion.
3. Figma/Illustrator import sanitization and stable re-import.
4. Camera projection and scene transitions.
5. Video frame rendering and trim/loop behavior.
6. Audio mixing/export.
7. Browser preview/export parity using Runtime IR.

P1 primitives (particles, trim path, animated dashes/gradients, blend modes, constraints and IK) stay deferred until a real composition requires them. P2 deformation/physics/expression features are outside the current product boundary.

## Execution order for the remaining work

### Phase 2.5 — Path Morph fixtures then promote

Author topology-compatible positive morph, mismatch/limit negatives, Runtime IR, and PNG goldens at progress `0 / 0.5 / 1`. Only then treat the WIP scaffold as stable.

Exit criteria: fixture matrix + evaluator/renderer asserts + docs ledger update + commit.

### Phase 2.6 — Component Action outer playback

Expand outer action invocations through shared playback semantics (iterations, reverse/alternate, `action.loop` fill). Fixtures before relaxing the one-normal-iteration compiler guard permanently.

Exit criteria: loop/reverse fixtures, Runtime golden, commit.

### Phase 2.7 — Lip-sync cues

Cue schema driven by cut-out mouth fixtures: cues compile to `payload.assetId` step keys; cue metadata must not leak into Runtime IR.

Exit criteria: cue positives/negatives, generated track golden, commit.

### Phase 3 — Secondary Motion

Define a bounded, deterministic segmented-chain modifier. Add a positive cut-out fixture, invalid chain/reference/cycle/limit negatives, Runtime IR output, and a PNG golden at multiple timestamps. The solver must be random-access: rendering frame `t` cannot depend on having rendered frame `t-1`.

Exit criteria: schema, capability registry, compiler/evaluator, renderer assertion, fixture matrix, and a dedicated commit.

### Phase 4 — Camera and scene transitions

Apply the active camera projection to world-space draw plans and define transition timing (cut, fade, or crossfade) in the schema. Add camera-reference, invalid projection, overlap, and transition-duration fixtures plus a frame golden.

Exit criteria: camera transforms affect the same Runtime IR used by preview/export; no camera logic remains only in the UI.

### Phase 5 — Video frames and audio

Implement deterministic video frame selection from timestamp, trim, loop, mute, and fit/crop policy. Then implement audio trim, loop, gain, fade, role, overlap, and stream validation. Keep video and audio fixtures separate so failures identify the media layer.

Exit criteria: decoded-frame/runtime assertions, media metadata negatives, and an end-to-end probe of the produced streams.

### Phase 6 — Import and re-import

Add a sanitizer/parser for Figma/Illustrator-exported SVG, stable element fingerprints, named group/part mapping, and re-import reconciliation. Import output must be a canonical component fixture; it must never bypass schema validation.

Exit criteria: import positive fixture, unsupported/unsafe SVG negatives, stable IDs across re-import, and a cut-out render golden.

### Phase 7 — Browser preview parity

Move browser preview from CSS/mock blocks to a browser-safe Runtime IR adapter. Reuse the shared evaluator, frame clock, property vocabulary, masks, effects, and transform conventions. Add timestamp parity checks against worker output and a browser smoke test.

Exit criteria: the same project/time produces equivalent node transforms and sampled properties in worker and browser; preview is no longer a separate animation implementation.

### Phase 8 — Freeze and extension policy

When all P0 phases pass, freeze Motion Format v2: document version policy, reject unknown normative fields, pin fixture counts, and publish the extension rule. New P1 primitives must repeat the same fixture-first loop and receive their own commit; no speculative placeholder fields are added.

## Milestone and commit protocol

Each milestone is isolated in its own commit after verification:

```text
feat(schema): ...       contract, limits, references, fixtures
feat(compiler): ...     expansion/normalization behavior
feat(runtime): ...      evaluator/renderer behavior
test(runtime): ...      deterministic goldens and assertions
docs(roadmap): ...      status/plan-only changes
```

Before committing a completed milestone, run:

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm validate:primitives
git diff --check
```

Update [`roadmap-status.md`](roadmap-status.md) in the same milestone or immediately after it. Mark a row **done** only after all exit criteria pass; otherwise mark it **partial/WIP** and include the next required fixture or runtime work.

## Handoff rule

The repository can be continued from the latest clean commit. A WIP commit is a checkpoint, not a release: it must remain visibly marked in the ledger until its fixture and golden matrix is complete.
