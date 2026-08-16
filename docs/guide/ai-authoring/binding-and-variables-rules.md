# Binding and variables rules

> Status: source-of-truth
> Goal: one-way data: variable → public prop. No loops, no deep layer paths.

## What this is

When to use `payload.props`, when to use `project.variables` + `project.bindings`, and the one-way rule.

## When to use

- Literal on one instance → `payload.props`
- Same value on many instances / theme → `variables` + bindings
- Never to “wire two layers together” as a graph

## Hard rules

- Variable is typed project data (`string`, `number`, `boolean`, `color`, `asset`, `choice`).
- Binding is one-way `variable → prop`. It is not render logic.
- Target is only `{ "type": "prop", "layerId", "propId" }`.
- Do not use `layer`, `layerProp`, `componentLayer`, or a dotted layer property as a binding target.
- Variable type must match the prop (including `assetKind` and choice ⊆ options).
- Do not emit inline variable refs on props.
- Do not emit `component.variables`.
- Do not create cycles (A binds to B binds to A). One source, many sinks.
- Owner `propBindings` map a public prop onto internals. Consumers never write those.

## Canonical shape

```jsonc
{
  "variables": [
    { "id": "theme-accent", "type": "color", "value": "#0d9488" }
  ],
  "bindings": [
    {
      "id": "bind-badge-accent",
      "source": { "kind": "variable", "variableId": "theme-accent" },
      "target": { "type": "prop", "layerId": "badge-brand", "propId": "accent" }
    }
  ]
}
```

## Valid example

One-off instance (no variable):

```jsonc
{
  "payload": {
    "componentId": "BrandBadge",
    "props": { "accent": "#0d9488" }
  }
}
```

## Invalid example

```jsonc
{
  "target": {
    "type": "layer",
    "layerId": "hero-title",
    "property": "payload.color"
  }
}
```

```jsonc
{
  "props": {
    "accent": { "ref": { "kind": "variable", "variableId": "theme-accent" } }
  }
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| Bind layer field | V1 bind surface is props only | `type: "prop"` |
| Variable for a single literal | Extra indirection | `payload.props` |
| Two-way / expression | Not in V1 | One variable, one-way binds |

## AI writing guide

- Prefer `payload.props` unless the prompt says theme / shared / CMS-like value.
- Do not invent expression languages.
- If you need … a color on text that is not a component, set `payload.color` on the text layer — do not fake a binding.

## Related pages

- [Component authoring rules](/docs/ai/component-rules)
- [Decision guide](/docs/ai/decision-guide)
- [Naming and ID conventions](/docs/ai/naming)
