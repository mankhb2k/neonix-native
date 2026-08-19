# Component authoring rules

> Status: source-of-truth
> Goal: instance a sealed component. Never author internals from the outside.

## What this is

Rules for `type: "component"` layers on `project.layers`. Human component docs explain the model; this page is the AI contract.

## When to use

When the prompt reuses a badge, card, or other definition in `project.components`.

## Hard rules

- Component layer uses `payload.componentId` + `payload.props` (+ optional `variantId`).
- Wrapper atoms still apply: `frame`, `transform`, `timing`, `zIndex`, `appearance`.
- Do not emit or edit layers inside the definition from the consumer side.
- Do not bind to an internal layer property path.
- Project binding target is only `{ "type": "prop", "layerId", "propId" }`.
- Nested components inside a definition receive values via owner `childProp`, not skip-level project bindings.
- Prefer `payload.props` literals over `project.bindings` unless the value must be a shared variable.
- Do not emit `component.variables` or inline `{ "ref": { "kind": "variable" } }` on props.
- Variants only override props.

## Canonical shape

```jsonc
{
  "id": "badge-brand",
  "type": "component",
  "parentLayerId": null,
  "zIndex": 1,
  "frame": { "width": 240, "height": 64 },
  "timing": { "start": 0, "duration": 6 },
  "payload": {
    "componentId": "BrandBadge",
    "variantId": "light",
    "props": {
      "label": "NeonVideo",
      "accent": "#0d9488"
    }
  }
}
```

## Valid example

Animate a public prop on the instance:

```jsonc
{
  "label": {
    "kind": "keyframes",
    "keys": [
      { "t": 0, "value": "" },
      { "t": 0.2, "value": "NeonVideo" }
    ]
  }
}
```

Put this on `payload.props.label`, not in `layer.animations` targeting an inner text layer.

## Invalid example

```jsonc
{
  "payload": {
    "componentId": "BrandBadge",
    "internals": [{ "id": "label", "payload": { "text": "hack" } }]
  }
}
```

```jsonc
{
  "target": {
    "type": "layer",
    "layerId": "badge-inner-text",
    "property": "payload.color"
  }
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| Edit definition layers as consumer | Sealed | Public `propId` |
| `layer.animations` on inner id | Inner ids are not project lanes | `payload.props` keyframes |
| Nested bind skip-level | Only `childProp` | Owner `propBindings` |

## AI writing guide

- Prefer setting props on the instance you created.
- Do not invent `nodeId` / `internalLayerId` targets.
- If the component is missing, do not fake internals — emit a normal `group` pattern instead.

## Related pages

- [Binding and variables rules](/docs/ai/bindings)
- [What is a component](/docs/components)
- [Layer authoring patterns](/docs/ai/layer-patterns)
