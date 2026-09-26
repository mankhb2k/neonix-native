# Layout snapshot vs native: fixture-wide diff (offline, baked snapshots)

Fixtures checked: 107
Clean (every layer within 1px): 79
Fixtures with at least one layer diff: 24
Compile/layer-count mismatches (not comparable): 4
Missing baked snapshot: 0

## Compile/layer-count mismatches

- html-compiler.paint.svg-stroke-dasharray-odd-count (layer count: native=2, snapshot=1)
- html-compiler.tags.svg-lowering (layer count: native=5, snapshot=4)
- html-compiler.motion-path.basics (layer count: native=17, snapshot=14)
- html-compiler.motion-path.advanced (layer count: native=17, snapshot=16)

## Per-layer diffs (delta = snapshot - native, px)

| fixture | layer | dx | dy | dwidth | dheight |
| --- | --- | --- | --- | --- | --- |
| html-compiler.tags.svg-path | logo-mark | 0.0 | 30.0 | -320.0 | -250.0 |
| html-compiler.geometry.sizing-constraints | caption-tl | 0.0 | 0.0 | -469.4 | -0.6 |
| html-compiler.geometry.sizing-constraints | caption-tr | 0.0 | 0.0 | -465.0 | -0.6 |
| html-compiler.geometry.sizing-constraints | caption-bl | 0.0 | 0.0 | -463.1 | -0.6 |
| html-compiler.geometry.sizing-constraints | caption-br | 0.0 | 0.0 | -458.7 | -0.6 |
| html-compiler.geometry.sizing-constraints | caption-tl-2 | 0.0 | 0.0 | -451.6 | -0.6 |
| html-compiler.geometry.sizing-constraints | caption-tr-2 | 0.0 | 0.0 | -461.1 | -0.6 |
| html-compiler.geometry.box-model-spacing | margin-group | 0.0 | 0.0 | 0.0 | 58.0 |
| html-compiler.geometry.box-model-spacing | margin-group::paint | 0.0 | 0.0 | 0.0 | 58.0 |
| html-compiler.paint.svg-fill | fill-rule-evenodd | 0.0 | 0.0 | 0.0 | -20.0 |
| html-compiler.paint.svg-stroke | stroke-style | 40.0 | 50.0 | -60.0 | -100.0 |
| html-compiler.paint.svg-dash-order | dash-order | 40.0 | 40.0 | -80.0 | -100.0 |
| html-compiler.tags.text-lowering | title | 0.0 | 48.2 | 0.0 | 0.0 |
| html-compiler.tags.text-lowering | caption | 0.0 | 36.0 | 0.0 | 0.0 |
| html-compiler.tags.container-aliases | figure | 40.0 | 16.0 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | h2 | 0.0 | 39.8 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | h3 | 0.0 | 42.0 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | h4 | 0.0 | 47.9 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | h5 | 0.0 | 53.4 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | h6 | 0.0 | 65.2 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | quote | 40.0 | 24.0 | 0.0 | 0.0 |
| html-compiler.tags.text-tag-matrix | pre | 0.0 | 22.0 | 0.0 | 0.0 |
| html-compiler.tags.svg-primitive-matrix | nested-group | 40.0 | 40.0 | -240.0 | -300.0 |
| html-compiler.tags.svg-primitive-matrix | path | 0.0 | 0.0 | -760.0 | -300.0 |
| html-compiler.tags.svg-primitive-matrix | ellipse | 200.0 | 5.0 | -720.0 | -310.0 |
| html-compiler.tags.svg-primitive-matrix | polyline | 460.0 | 0.0 | -700.0 | -300.0 |
| html-compiler.typography.font-catalog-ui-body | title | 0.0 | 0.0 | -1426.3 | 0.0 |
| html-compiler.typography.font-catalog-ui-body | subtitle | 0.0 | 0.0 | -1096.7 | 0.0 |
| html-compiler.typography.font-catalog-ui-body | grid | 0.0 | 0.0 | 0.0 | -368.0 |
| html-compiler.typography.font-catalog-ui-body | grid::paint | 0.0 | 0.0 | 0.0 | -368.0 |
| html-compiler.typography.font-catalog-display | title | 0.0 | 0.0 | -1113.1 | 0.0 |
| html-compiler.typography.font-catalog-display | subtitle | 0.0 | 0.0 | -1086.3 | 0.0 |
| html-compiler.typography.font-catalog-display | grid | 0.0 | 0.0 | 0.0 | -368.0 |
| html-compiler.typography.font-catalog-display | grid::paint | 0.0 | 0.0 | 0.0 | -368.0 |
| html-compiler.typography.font-catalog-monospace | title | 0.0 | 0.0 | -1304.0 | 0.0 |
| html-compiler.typography.font-catalog-monospace | subtitle | 0.0 | 0.0 | -1346.9 | 0.0 |
| html-compiler.typography.font-catalog-monospace | grid | 0.0 | 0.0 | 0.0 | -368.0 |
| html-compiler.typography.font-catalog-monospace | grid::paint | 0.0 | 0.0 | 0.0 | -368.0 |
| html-compiler.typography.font-catalog-editorial | title | 0.0 | 0.0 | -1115.4 | 0.0 |
| html-compiler.typography.font-catalog-editorial | subtitle | 0.0 | 0.0 | -1331.2 | 0.0 |
| html-compiler.typography.font-catalog-editorial | grid | 0.0 | 0.0 | 0.0 | -346.0 |
| html-compiler.typography.font-catalog-editorial | grid::paint | 0.0 | 0.0 | 0.0 | -346.0 |
| html-compiler.layout.containing-block-edge-cases | cell-label-1 | 0.0 | 0.0 | 0.0 | -24.0 |
| html-compiler.layout.containing-block-edge-cases | edge-clip-wide | 0.0 | 0.0 | 300.0 | 0.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-a | 0.0 | 0.0 | 0.0 | 80.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-a::paint | 0.0 | 0.0 | 0.0 | 80.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-a | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-a::paint | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-b | 0.0 | 0.0 | 0.0 | 41.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-b::paint | 0.0 | 0.0 | 0.0 | 41.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-b | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-b::paint | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-c | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-c::paint | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-c | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-c::paint | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-d | 0.0 | 0.0 | 0.0 | 99.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-d::paint | 0.0 | 0.0 | 0.0 | 99.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-d | 0.0 | 0.0 | 0.0 | 39.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-d::paint | 0.0 | 0.0 | 0.0 | 39.0 |
| html-compiler.layout.block-flow-margin-collapsing | child-d | 0.0 | 0.0 | 0.0 | 39.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-e | 0.0 | 0.0 | 0.0 | 50.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-e::paint | 0.0 | 0.0 | 0.0 | 50.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-e | 0.0 | 0.0 | 0.0 | 50.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-e::paint | 0.0 | 0.0 | 0.0 | 50.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-f | 0.0 | 0.0 | 0.0 | 80.0 |
| html-compiler.layout.block-flow-margin-collapsing | case-f::paint | 0.0 | 0.0 | 0.0 | 80.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-f | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.layout.block-flow-margin-collapsing | margin-case-f::paint | 0.0 | 0.0 | 0.0 | 40.0 |
| html-compiler.motion.delay-fill-mode | cell-label-5 | 0.0 | 0.0 | 0.0 | -24.0 |
| html-compiler.motion.iteration-play-state | cell-label-4 | 0.0 | 0.0 | 0.0 | -26.8 |
| html-compiler.motion.easing | cell-label-3 | 0.0 | 0.0 | 0.0 | -24.0 |
| html-compiler.motion.animatable-properties | motion-frame | 0.0 | 0.0 | 2.3 | 1.4 |
| html-compiler.motion.animatable-properties | motion-frame::paint | 0.0 | 0.0 | 2.3 | 1.4 |
| html-compiler.motion.off-canvas-slide-in | cell-label-3 | 0.0 | 0.0 | 0.0 | -24.0 |
| html-compiler.perspective.atomic-transform-style | cell-label-2 | 0.0 | 0.0 | 0.0 | -26.8 |
| html-compiler.perspective.backface-visibility | cell-label-1 | 0.0 | 0.0 | 0.0 | -26.8 |
| html-compiler.perspective.mask-filter-near-plane | cell-label-3 | 0.0 | 0.0 | 0.0 | -24.0 |
