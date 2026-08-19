# Naming and ID conventions

> Status: source-of-truth
> Goal: stable kebab-case ids so patches, bindings, and errors stay readable.

## What this is

How to name `metadata.id`, layer ids, asset ids, variable ids, clip ids, and binding ids.

## When to use

Every new object. Especially when the project will be patched later.

## Hard rules

- Use kebab-case: `hero-title`, `bg-image`, `badge-brand`, `audio-bgm`.
- Do not use random UUIDs for authoring ids unless the host already assigned them — then **keep** them.
- Layer id = role, not index: `cta-label` not `layer3`.
- Asset id matches role: `bgm`, `hero-photo`, `font-display`.
- Clip id describes the motion: `fade-hero-title`, `slide-cta-label`.
- Binding id: `bind-<layer>-<prop>` → `bind-badge-brand-accent`.
- Variable id: `theme-accent`, `copy-headline`.
- Ids must be unique in their collection (layers tree-wide, assets, variables, bindings, clips).
- After first emit, treat ids as API. Renaming is a breaking patch.

## Quick reference

| Role | Id |
| --- | --- |
| Background bitmap | `bg-image` |
| Hero text | `hero-title` |
| Subtitle | `hero-subtitle` |
| Call to action | `cta-label` |
| Brand badge instance | `badge-brand` |
| Caption group | `caption-block` |
| Caption line | `caption-line-1` |
| Music | `audio-bgm` |
| Voice | `audio-vo` |

## Canonical shape

```jsonc
{
  "id": "hero-title",
  "type": "text"
}
```

```jsonc
{
  "id": "fade-hero-title",
  "layerId": "hero-title",
  "property": "opacity"
}
```

## Valid example

`badge-brand` instance + `bind-badge-brand-accent` + variable `theme-accent`.

## Invalid example

```jsonc
{
  "id": "Layer_0xAF91",
  "type": "text"
}
```

```jsonc
{
  "id": "title",
  "type": "text"
}
```

(Second `title` in the same tree duplicates.)

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| UUID per layer | Unreadable diagnostics | kebab role |
| `text1` `text2` | Collides on copy | `hero-title`, `cta-label` |
| Rename on every patch | Breaks clips | Keep id, change payload |

## AI writing guide

- Prefer the table. Extend with a role suffix (`hero-title-vi`) only if needed.
- Do not localize ids (`tieu-de`); keep English kebab even when `locale` is `vi-VN`.
- If you need two titles, `hero-title` and `end-title`, not two `hero-title`.

## Related pages

- [Patching existing projects](/docs/ai/patching)
- [Layer authoring patterns](/docs/ai/layer-patterns)
- [Binding and variables rules](/docs/ai/bindings)
