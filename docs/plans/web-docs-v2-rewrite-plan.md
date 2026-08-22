# Web Documentation V2 Rewrite Plan

> Status: planned
>
> Scope: rewrite the public documentation in `apps/web` around the current
> Atomic Protocol V2 and the 3D-first Matrix4 architecture.
>
> Non-goal: this plan does not change compiler, runtime, preview-renderer,
> Remotion export, or editor behavior.

## 1. Goals

The web documentation should teach users and AI agents what NeonVideo means
today, while remaining useful as a static product guide and example gallery.

The public docs must:

- describe Atomic Protocol V2 only;
- use Matrix4 as the single transform representation;
- use `z`, never `depth`, in current protocol examples;
- use `anchor`, never `origin`, in current transform examples;
- explain that 2D is a Matrix4 case with `z = 0`, not a separate render path;
- distinguish Atomic Protocol, Runtime IR, preview, export, and high-level intent;
- use static JSON blocks, CSS/React figures, and local media for demonstrations;
- keep the real GPU preview lab isolated at `/docs/preview`;
- hide unfinished high-level concepts without deleting their source files.

## 2. Documentation Boundaries

```text
MCP / AI / future Editor
        |
        v
High-level authoring documentation
        |
        v
Atomic Protocol V2 documentation
        |
        v
Runtime / Preview / Export documentation
        |
        +--> Static web examples
        |
        +--> Real preview lab at /docs/preview
```

### 2.1 Static documentation

Normal documentation pages may use:

- Markdown rendered by `DocsMarkdown`;
- `JsonBlock` and `QuickReference` tables;
- React/CSS figures under `components/docs/figures`;
- local images, SVGs, and videos under `apps/web/public/docs`;
- display-only V2 JSON examples;
- explicit `certified`, `planned`, or `conceptual` labels.

Normal documentation pages must not import or execute:

- `@motionvideo/motion-compiler`;
- `@motionvideo/motion-runtime`;
- `@motionvideo/preview-renderer`;
- WebGPU or WebGL2 code;
- Remotion rendering code.

### 2.2 Real preview lab

`/docs/preview` remains the only documentation surface allowed to use the
real preview fixtures and renderer integration. Its tests remain separate from
the static documentation tests.

### 2.3 High-level concepts

High-level concepts are documentation vocabulary, not Atomic Protocol fields.
They may be documented as planned intent, but the docs must not present them as
currently supported atoms.

Examples:

- Pattern;
- Preset;
- Template;
- Component;
- Parallax;
- Camera movement;
- Ken Burns;
- Page flip;
- Orbit;
- Auto layout;
- Responsive behavior.

## 3. Public V2 Documentation Model

Add a documentation registry so visibility is explicit instead of being
controlled only by scattered imports.

```ts
type DocsEntryStatus = "published" | "planned" | "hidden";
type DocsSurface = "authoring" | "protocol" | "runtime" | "preview" | "export" | "high-level";

type DocsEntry = {
  slug: string;
  label: string;
  group: string;
  status: DocsEntryStatus;
  surface: DocsSurface;
};
```

Rules:

- `published` entries appear in the sidebar and static route params;
- `planned` entries may be used in an internal roadmap, but do not appear in
  the public navigation;
- `hidden` entries are not generated as routes and are not linked publicly;
- source files for `planned` and `hidden` entries are retained;
- route generation must derive from published entries only;
- `DOCS_NAV` must not be the only source of visibility policy.

## 4. Target Public Navigation

The public navigation should be rebuilt in this order:

```text
Getting started
V2 architecture
High-level authoring
Atomic Protocol V2
Runtime and rendering
Static examples
Preview lab
```

### 4.1 Getting started

Rewrite these pages first:

- What NeonVideo is;
- How a composition is described;
- Composition, view, timeline, background, and layers;
- The difference between authoring JSON and Atomic Protocol V2;
- A minimal V2 document;
- How AI and MCP should produce intent.

### 4.2 V2 architecture

Use [`docs/guide/v2-architechture.md`](../guide/v2-architechture.md) as the
architecture source, rendered through the web docs. Keep the public page
focused on the following pipeline:

```text
MCP / AI / Editor intent
        -> High-level authoring
        -> Compiler A
        -> Atomic Protocol V2
        -> Compiler B
        -> Runtime IR
        -> Matrix4 and frame evaluation
        -> WebGPU preview / WebGL2 fallback
        -> Remotion export
```

### 4.3 Atomic Protocol V2

The public atom reference should be organized as:

- `Composition`;
- `View`;
- `Group`;
- `Shape`;
- `Path`;
- `Text`;
- `Image`;
- `Video`;
- `Frame`;
- `Transform`;
- `Timing`;
- `Animation`;
- `Effects`;
- `Mask`;
- `Composite`.

Each atom page must state:

1. What the atom represents.
2. Required fields.
3. Optional fields.
4. Fields that are explicitly not part of V2.
5. A minimal V2 JSON example.
6. A static visual example.
7. Whether the atom is certified, planned, or conceptual.

## 5. Transform Documentation Rules

All transform documentation must follow these rules:

```text
Transform input
    -> Matrix4
    -> View projection
    -> Runtime frame
    -> Backend
```

Current vocabulary:

- `translate.x`, `translate.y`, `translate.z`;
- `rotate.x`, `rotate.y`, `rotate.z`;
- `scale.x`, `scale.y`, `scale.z`;
- `anchor.x`, `anchor.y`, `anchor.z`;
- `skew.x`, `skew.y`;
- `z` for world position and ordering semantics where applicable.

Do not publish new examples containing:

- `transform.depth`;
- `transform.origin`;
- `bone`;
- a Matrix2D as a separate protocol contract;
- backend-specific matrix or shader fields.

If an old page explains a removed field, either rewrite it to V2 or mark it as
an internal migration note that is not included in public navigation.

## 6. Components: Hide, Do Not Delete

Components are a future high-level authoring concept. They are not current
Atomic Protocol V2 atoms and are not ready to be presented as a shipped user
feature.

### 6.1 Required behavior now

- Keep `apps/web/lib/docs/content/components/**` in the repository.
- Keep component figures and supporting UI components in the repository.
- Remove the Components group from published navigation.
- Mark component entries as `planned` or `hidden` in the docs registry.
- Exclude component slugs from `generateStaticParams`.
- Return `notFound()` for direct public access to hidden component pages.
- Do not include component instructions in the current AI authoring rules.
- Do not add component fields to Atomic Protocol V2 examples.

### 6.2 Future activation

When high-level components are designed:

1. Define the authoring JSON contract first.
2. Define Compiler A lowering rules into V2.
3. Add static documentation examples.
4. Add AI/MCP authoring rules.
5. Add component navigation only after the compiler and schema are certified.

This preserves the existing content without allowing unfinished concepts to
leak into the current protocol contract.

## 7. Rewrite Phases

### Phase 0 - Preserve and inventory

- Create a docs snapshot before editing.
- Inventory every current docs slug and content file.
- Mark each page `publish`, `rewrite`, `planned`, `hide`, or `remove-from-public`.
- Record all V1 terms and imports.
- Keep `/docs/preview` outside this rewrite.

Acceptance criteria:

- No render package files are changed.
- A complete inventory exists.
- The current docs can be restored from the snapshot.

### Phase 1 - Introduce visibility policy

- Add the docs entry/status registry.
- Make navigation and route generation use published entries only.
- Hide Components without deleting their source.
- Keep preview routes separate.

Acceptance criteria:

- Hidden pages are not linked or statically generated.
- Published pages have deterministic slugs.
- Direct access to hidden component pages returns 404.

### Phase 2 - Rewrite architecture and getting started

- Rewrite the home docs page around V2.
- Explain high-level authoring versus Atomic Protocol.
- Explain the composition tree:

```text
Composition
├── View
├── Background
├── Timeline
└── Nodes
    ├── Shape
    ├── Path
    ├── Text
    └── Group
```

- Explain WebGPU default and WebGL2 fallback only as renderer behavior.
- Explain Remotion export as a separate adapter with the same runtime meaning.

Acceptance criteria:

- A new user can understand the pipeline without reading implementation code.
- No current page claims that V1 is the active protocol.

### Phase 3 - Rewrite Atomic Protocol pages

- Add one page per certified atom.
- Use only V2 JSON snippets.
- Document required and optional fields explicitly.
- Add static figures using CSS/React or local media.
- Link each page to its corresponding preview-lab case when one exists.

Acceptance criteria:

- Every published atom page has a valid display example.
- Display examples are not compiled or rendered by the real preview engine.
- Preview links point to `/docs/preview` rather than embedding the renderer.

### Phase 4 - Rewrite Matrix4 and view semantics

- Document orthographic and perspective projections.
- Explain that both 2D and 3D consume Matrix4.
- Explain `z = 0` as the normal 2D case.
- Explain `anchorZ` as a valid 3D pivot coordinate.
- Explain WebGL2 depth conversion without exposing backend shader details.

Acceptance criteria:

- No public page describes a separate Matrix2D protocol.
- No page uses `depth` as the current 3D position field.

### Phase 5 - Rewrite effects, masks, and compositing

- Document fill and stroke opacity independently.
- Document blend ownership as the upper layer applying to the lower result.
- Document blur, drop shadow, outer glow, inner glow, noise, and masks.
- Explain isolation and offscreen passes conceptually, without exposing GPU code.
- Keep effect examples static and deterministic.

Acceptance criteria:

- Each public effect page identifies its source, operator, and composite result.
- No page promises an effect that is not certified in V2.

### Phase 6 - Rewrite text, image, and video pages

- Document text frame semantics, alignment, paragraph layout, and local fonts.
- Document image frame ratio, fit, crop, and asset references.
- Document video asset references and deterministic frame seeking.
- Use static figures and local assets only.

Acceptance criteria:

- Examples describe frames in composition units.
- Text, image, and video pages do not depend on browser playback or GPU preview.

### Phase 7 - Rewrite AI and MCP guidance

- Define the current AI vocabulary.
- Separate high-level intent from atomic fields.
- Add prohibited-field rules for `depth`, `origin`, `bone`, V1 format names, and
  backend-specific fields.
- Add examples of valid V2 patches and invalid requests.
- Keep Components in a future/planned section only.

Acceptance criteria:

- AI guidance can generate V2-compatible examples without guessing.
- AI guidance does not generate hidden component fields.

### Phase 8 - Static examples and gallery

- Rebuild the examples gallery from V2 display-only JSON.
- Add badges for `certified`, `planned`, and `conceptual`.
- Keep CSS/React figures deterministic and responsive.
- Do not call compiler, runtime, preview, or Remotion from the gallery.

Acceptance criteria:

- The gallery renders in a browser without GPU initialization.
- Every example has a source JSON block and a visual result.

### Phase 9 - Validation and cleanup

- Test every published slug.
- Test hidden component slugs return 404.
- Scan public docs for forbidden V1 vocabulary and imports.
- Run static docs tests and preview-lab tests separately.
- Verify `/docs/preview` still uses the real preview lab.
- Commit docs changes separately from render-core changes.

## 8. Required Test Coverage

Add or keep the following checks:

```text
docs-registry.test.ts
    published entries have unique slugs
    hidden/planned entries are not public

docs-static-boundary.test.ts
    static docs do not import compiler/runtime/preview-renderer

docs-v2-vocabulary.test.ts
    public docs do not use MotionProjectV1
    public docs do not use transform.depth or transform.origin
    public docs do not publish bone/component atom fields

docs-routes.test.ts
    every published slug resolves
    hidden component routes do not resolve

preview-lab.test.ts
    remains separate and continues validating real V2 fixtures
```

## 9. Commit Boundaries

Use small commits with no render-core changes mixed in:

1. `docs: add V2 documentation registry`
2. `docs: hide unfinished component documentation`
3. `docs: rewrite V2 architecture and getting started`
4. `docs: rewrite atomic protocol reference`
5. `docs: rewrite V2 effects and media reference`
6. `docs: rewrite AI and MCP authoring guidance`
7. `test: validate static V2 documentation boundary`

Do not use `git reset --hard`, broad `git restore`, or repository-wide
checkouts during this work. Existing editor, Remotion, compiler, runtime, and
preview changes must remain untouched.

## 10. Definition of Done

The rewrite is complete when:

- public docs teach V2 and only V2 as the active protocol;
- static docs do not initialize or call the real preview renderer;
- `/docs/preview` remains the explicit real-render verification surface;
- Components are retained in source but hidden from public docs;
- high-level concepts are clearly separated from atomic fields;
- Matrix4, `anchor`, and `z` are used consistently;
- all published routes and static docs tests pass;
- compiler, runtime, preview-renderer, and export packages have no code changes
  from the docs rewrite.
