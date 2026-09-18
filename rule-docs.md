# Public documentation rules

This file is mandatory reading before creating or updating any public documentation, marketing copy, guide, example, preview page, or API explanation.

## Public scope

Public docs describe only user-facing authoring contracts:

- HTML and CSS authoring;
- agent intent as an input concept;
- Neonix JSON V2 structure and semantics;
- composition, view, layers, transforms, assets, text, paint, effects, animation and audio fields;
- validation rules, supported values and user-visible diagnostics;
- public examples that can be copied as Neonix JSON V2 or HTML.

The public conceptual flow may stop at:

```text
HTML / CSS / agent intent
        ↓
Compiler
        ↓
Neonix JSON V2
        ↓
Output
```

## Never expose in public docs

Do not describe or name internal implementation details, including:

- RuntimeProject, RuntimeFrame, PaintCommandBuffer or internal IR;
- CanvasKit, Skia, WebGPU/WebGL implementation choices or native renderer details;
- worker topology, queues, Cloud Run, Docker, FFmpeg, encoders, GPU/CPU benchmarks or storage-provider internals;
- internal adapters, replay, readback, rasterization, color-conversion or IPC pipelines;
- private routes, internal environment variables, credentials, feature flags or diagnostic implementation names.

Use user-facing terms such as “preview”, “export”, “font”, “asset” and “output” when describing outcomes. Do not explain how those outcomes are implemented.

## JSON V2 writing rules

- Show semantic authoring fields only. For example, text paint belongs in a span's `fill` field.
- Never show derived fields such as `fillPaint`, glyph buffers, renderer commands or backend metadata.
- Examples must remain valid, minimal and copyable Neonix JSON V2 unless explicitly marked as pseudocode.
- Explain observable behavior and constraints, not the processing sequence underneath.
- Keep implementation notes in private engineering documents, not under public docs routes.

## Review checklist

Before publishing a change:

1. Search the changed public surface for internal terms and implementation names.
2. Remove architecture diagrams that go beyond Compiler → Neonix JSON V2 → Output.
3. Check that examples contain authoring JSON rather than derived runtime data.
4. Verify links, Markdown rendering and the relevant typecheck/build.

If an internal note is needed, put it in a private engineering document and do not link it from the public docs navigation.
