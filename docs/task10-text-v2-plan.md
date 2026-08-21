# Task 10: Deterministic Text Atom V2

## Goal

Certify one single-style Text atom across Protocol V2, Compiler B, Runtime,
WebGPU, WebGL2, preview, and Remotion without CSS layout or system-font
fallback.

```text
Text Layer V2 + exact font asset
  -> Compiler B (frame / Mat4 / timing)
  -> Runtime text preparation (HarfBuzz shaping + line layout)
  -> RuntimeFrameV2 drawText glyph run
  -> renderer-owned alpha glyph atlas
  -> WebGPU / WebGL2 / Remotion canvas
```

## Locked Contract

- `frame` is the immutable local layout box. It never derives from visible
  glyph bounds.
- `anchor` resolves from `frame`, therefore content edits cannot move the
  transform pivot.
- `fontAssetId` identifies one exact static TTF/OTF face. `family`, `weight`,
  and `style` are font-asset metadata, not competing Text fields.
- `fontSize`, `lineHeight`, and `letterSpacing` use absolute composition
  units. High-level authoring may lower relative units before V2.
- `align` positions each line inside `frame.width`; `verticalAlign` positions
  the whole line-box block inside `frame.height`.
- The Runtime owns shaping, glyph positions, baseline, and local glyph bounds.
  Renderers do not rewrap or calculate advances.
- The atom is embedded on local `z = 0` and uses the existing shared Matrix4.
- Missing/integrity-invalid fonts produce a diagnostic; system fallback is
  prohibited.

## MVP Surface

Required text payload fields:

```ts
{
  text: string;              // NFC canonical text
  fontAssetId: string;
  fontSize: number;          // > 0
  lineHeight: number;        // > 0, absolute local units
  letterSpacing: number;     // finite local units
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  wrap: "none";
  overflow: "visible";
  direction: "ltr";
  language: string;          // BCP-47 or "und"
}
```

Required text style:

```ts
{ fill: string }
```

The first certification deliberately excludes word wrapping, clipping, RTL,
font variation axes, rich text, text stroke, gradients, and text-layout
animation. Each will be a later capability ticket.

## Font Policy

- Source font files live under `assets/fonts` with license files.
- Task 10 uses static faces, never a variable-font default axis.
- The first deterministic fixture uses `Roboto-Regular.ttf`; it has Vietnamese
  glyph coverage and a simple static face identity.
- Development serves the selected binary from `apps/web/public/fonts`.
- Production uses a content-addressed R2/CDN URI and the same SHA-256.
- The project protocol references `fontAssetId`; host-specific URI resolution
  stays in the asset registry.

## Delivery Phases

### 10.0 Contract and Font Fixture

- [x] Add `font` asset schema with required exact-face metadata and integrity.
- [x] Copy/register one static Roboto face for browser preview certification.
- [x] Add strict Text V2 schema and invalid-input tests.

### 10.1 Shared Runtime Layout

- [x] Add HarfBuzz/WASM shaping using font bytes and a shaper supplied by
  explicit host resolvers.
- [x] Produce glyph IDs, source clusters, advances, baselines, local bounds,
  and outline paths in Runtime text layout.
- [x] Add no-fallback and missing-font diagnostics.
- [ ] Add deterministic metric tests for Vietnamese strings. Latin and alignment
  coverage are certified; Vietnamese expands after the first multi-script ticket.

### 10.2 Compiler and Paint Contract

- [x] Lower Text V2 to `RuntimeTextV2` while preserving the certified Matrix4,
  timing, opacity, z-index, and frame semantics.
- [x] Add `drawText` with an already-resolved glyph run to `RuntimeFrameV2`.
- [x] Test left/center/right and top/middle/bottom line-box positioning.

### 10.3 Preview Renderer

- [x] Build/cache alpha glyph atlases from Runtime outline paths inside each
  renderer backend.
- [x] Paint glyph quads through the same texture path in WebGPU and WebGL2.
- [ ] Add a 3D rotate-Y/perspective fixture after flat text parity is green.

### 10.4 Host and Export

- [x] Preload the exact font in PreviewStage before text preparation.
- [x] Make Remotion consume the same prepared Runtime V2 frame semantics.
- [x] Add local `/docs/preview` fixtures and browser E2E pixel tests.

### Deferred Tickets

- [ ] `wrap: "word"` with one shared Unicode line-break engine.
- [ ] `overflow: "clip"` after the 3D clipping/offscreen contract is certified.
- [ ] RTL, variable-font axes, weight/style face selection, rich text, text
  stroke/gradient, typewriter and layout-sensitive animation.
