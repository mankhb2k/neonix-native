---
slug:
title: Neonix V2 documentation
description: Static guide to Neonix's current authoring vocabulary and the Neonix JSON V2 document contract.
---
# Neonix V2

This is the static guide to Neonix's current authoring vocabulary and Neonix JSON V2. The examples on these pages are display-only teaching material and are not submitted as projects.

## Start with the model

Neonix separates authoring intent from the document contract:

```text
HTML / CSS / agent intent
        -> Compiler
        -> Neonix JSON V2
        -> Output
```

This guide explains the public authoring contract and the observable output, not the implementation underneath.

## Composition tree

```text
Composition
+-- View
+-- Background
+-- Timeline
\-- Nodes
    +-- Shape
    +-- Path
    +-- Text
    \-- Group
```

## Current rules

- Neonix JSON V2 is the current public document contract.
- Transform data is designed around a 4x4 matrix.
- A normal 2D layer is a 3D layer with zero Z rotation and zero Z position.
- `anchor` describes the pivot; `z` describes position along the world axis.
- High-level patterns and components are future authoring vocabulary, not atoms.
- Static documentation examples explain meaning but do not render media.

## Continue

- Read [Authoring model](/docs/authoring) for the boundary between intent and atoms.
- Read [HTML authoring](/docs/html) for the document metadata, CSS shell and import flow.
- Read [Neonix JSON V2](/docs/atoms) for the atom catalog.
- Read [Output](/docs/rendering) for the user-facing result.

---
slug: authoring
title: Authoring model
description: The boundary between high-level authoring intent and explicit Neonix JSON V2 fields, and how MCP agents should patch a document.
---
# Authoring model

## Intent first

High-level authoring is where a person, Claude via MCP, a template, or the editor can express rich intent:

```json
{
  "kind": "hero-intro",
  "headline": "A calm beginning",
  "motion": "fade-up"
}
```

This is illustrative high-level input. The fields are not Neonix JSON V2 fields. The compiler expands and normalizes this intent before output.

## Atomic input

An atomic document is explicit and deterministic:

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": { "width": 1920, "height": 1080, "fps": 30 },
  "layers": []
}
```

## What belongs where

| Concern | High-level authoring | Neonix JSON V2 |
| --- | --- | --- |
| Pattern and preset names | Yes | No |
| Semantic motion intent | Yes | No |
| Shape geometry | Described | Explicit |
| Transform pivot | Requested | `anchor` |
| World position | Requested | `translate.z` |
| Timeline window | Requested | `timing` |

## Determinism

An authoring surface may be expressive. The JSON result must be explicit enough for preview and export without guessing.

## MCP authoring

MCP is an authoring transport, not a second format. An agent should express intent first, then create or update explicit Neonix JSON V2 fields.

- Ask for missing composition dimensions, timing, asset references and font information.
- Use `anchor` for a pivot, `translate.z` for world position and `order` for paint order.
- Keep fill opacity, stroke opacity and effect order independent.
- Do not invent renderer, shader, texture, buffer or preview-state fields.
- Keep patterns, presets, templates and components labeled as intent until a lowering rule exists.

For a targeted edit, send a small patch instead of replacing the whole document:

```json
{
  "operation": "update",
  "target": "layers.hero.transform",
  "set": {
    "anchor": { "x": 0.5, "y": 0.5, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": -4 }
  }
}
```

## Static example policy

JSON blocks in this guide teach structure. They are not validated or rendered by the web documentation page.
