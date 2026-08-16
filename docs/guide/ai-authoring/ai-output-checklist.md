# AI output checklist

> Status: source-of-truth
> Goal: run this list against every generated or patched MotionProjectV1 before returning it.

## What this is

A pre-return gate. If any item fails, fix JSON. Do not return “almost”.

## Hard rules

### Root shape

- [ ] `format` is `"motion-project"`
- [ ] `formatVersion` is `1`
- [ ] `metadata`, `composition`, `timeline` present
- [ ] 9:16 → composition `1080×1920`, not `metadata.aspectRatio`

### No unknown fields

- [ ] No `scenes`, `visualTracks`, `audioTracks`, `captionTracks`
- [ ] No `project.tracks` / `project.propertyAnimations`
- [ ] No `modifiers`, `locked`, `flipX`, `flipY`, `transform.z`, `transform.x`

### Canonical property paths only

- [ ] Clips use paths from [Canonical property paths](/docs/ai/property-paths)
- [ ] Keys use `t` + `value` (not `v`)
- [ ] No clips on frame, timing, zIndex, origin, fit, trim, assetId

### Audio root-only

- [ ] Every `type: "audio"` has `parentLayerId: null` and `zIndex < 0`
- [ ] No `frame` / `appearance` / `transform` on audio

### Component via props only

- [ ] Instances set `payload.componentId` + `payload.props`
- [ ] No internals, no bind to inner layer paths
- [ ] Bindings are `target.type: "prop"` only

### IDs and references valid

- [ ] Kebab-case role ids ([Naming](/docs/ai/naming)) unless host already assigned ids
- [ ] Unique layer / asset / variable / binding / clip ids
- [ ] Every `payload.assetId` exists in `assets[]`
- [ ] Every binding `variableId` exists in `variables[]`
- [ ] Root layers have `zIndex` + `timing`
- [ ] Roots do not overflow `timeline.duration` when duration is set

## Valid example

A project that ticks every box above (empty `layers` still counts if envelope is complete).

## Invalid example

Any object that fails one checkbox — do not ship it.

## AI writing guide

- Prefer returning one JSON object.
- Do not attach a parallel “explanation scene graph”.
- If you need … a missing asset, stop and add `assets[]` before layers that reference it.

## Related pages

- [Authoring rules](/docs/ai/rules)
- [Common error fixes](/docs/ai/error-fixes)
- [Valid and invalid patterns](/docs/ai/patterns)
