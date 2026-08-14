# `@motionvideo/motion-protocol`

Canonical Zod schemas and TypeScript types for **Motion Format V1** — the only authoring protocol between editor/AI, compiler, and runtime.

Three package entries:

| Import | Role |
| --- | --- |
| `@motionvideo/motion-protocol` | Authoring JSON: parse, `MotionProject`, layers, `AssetV1`, bindings, patch, MCP |
| `@motionvideo/motion-protocol/runtime` | Compiler IR: `MotionRuntimeProject`, runtime assets, prepared types |
| `@motionvideo/motion-protocol/internal` | Compiler leftovers (motion units, caption token schemas) — not authoring |

> **Authoring is layers-only.** `formatVersion` must be `1`. There are no `scenes`, `visualTracks`, `audioTracks`, or `captionTracks`. Extra keys are `.strict()` rejected.

> **For AI / MCP / Skills:** Generate `MotionProjectV1` with `project.layers` as timeline lanes. Bind via `target.type` (`layer` | `componentLayer`). Component internals are sealed — consumers only set public props. Runtime IR is produced by `@motionvideo/motion-compiler`.

---

## Design

1. **Single contract** — Editor, AI planner, and compiler validate the same Zod schemas.
2. **Authoring → Runtime** — `MotionProjectV1` (variables, props, bindings) compiles to `MotionRuntimeProject` (literal layer graph + animation tracks).
3. **Strict bounds** — `.strict()`, finite numbers, `MOTION_PROTOCOL_LIMITS`.
4. **Parse path** — `parseMotionProjectV1`: normalize → schema → reference validation.

---

## Package layout

| Path | Role |
| --- | --- |
| [`src/index.ts`](./src/index.ts) | Authoring barrel (`.`) |
| [`src/runtime/index.ts`](./src/runtime/index.ts) | Runtime IR barrel (`./runtime`) |
| [`src/internal.ts`](./src/internal.ts) | Compiler leftovers (`./internal`) |
| [`src/v1/`](./src/v1) | Authoring schemas (project, layers, components, timeline, variables, animation, references) |
| [`src/runtime/`](./src/runtime) | Runtime IR schemas |
| [`src/capabilities.ts`](./src/capabilities.ts) | Limits + property capability registry |
| [`review-guide.md`](./review-guide.md) | How to review the V1 component/timeline contract |

---

## Timeline model

- `timeline` = clock metadata only: `duration?`, `workArea?`, `markers?` (`TimelineMarkerV1Schema`)
- `project.layers[]` = root lanes; `zIndex` unique (`>= 0` visual, `< 0` audio)
- Nesting via `group.children[]`; child timing is local to parent
- Audio is a root-only leaf (`type: "audio"`)

See [docs/guide/v1-timeline-guide.md](../../docs/guide/v1-timeline-guide.md).

---

## Components

- Sealed definition: public `props` / `variants`; owner-only `propBindings` + internal `layers`
- Instance = `type: "component"` layer on the **project layer tree**
- Prop keyframe `t` is local to the instance: `0..layer.timing.duration`
- No `actions` — timeline motion uses layer tracks / prop keyframes only

### Bindings (`ProjectBindingV1Schema`)

```text
target.type:
  layer          → project-tree layer property
  componentLayer → one project-tree component instance (layerId + propId)
nested-in-definition → childProp only
```

See [docs/guide/v1-component-guide.md](../../docs/guide/v1-component-guide.md).

---

## Pipeline

```text
JSON  →  parseMotionProjectV1()  →  MotionProjectV1
                │
                ▼  @motionvideo/motion-compiler
         MotionRuntimeProject (flat layers[] + tracks)
```

---

## Scripts

```bash
pnpm --filter @motionvideo/motion-protocol typecheck
pnpm --filter @motionvideo/motion-protocol test
pnpm --filter @motionvideo/motion-protocol generate:schema
```
