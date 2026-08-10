# Capability Ledger

> Manifest version: **wave2.1**
> Generated: 2026-08-09T18:35:06.478Z
> Columns: schema → compiler → evaluator → pixi → remotion → worker → parity → editor

## Capability Matrix

| Capability ID | Label | Schema | Command | Compiler | Evaluator | Pixi | Remotion | Worker | Parity | Editor | Notes |
|---|---|--- | --- | --- | --- | --- | --- | --- | --- | ---|---|
| primitive.group | Group | ✅ yes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | 📋 planned | ✅ yes | Pixi paints EvaluatedFrame.paint (no authoring compile) |
| primitive.text | Text | ✅ yes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | 📋 planned | ✅ yes | Pixi paints EvaluatedFrame.paint (no authoring compile) |
| primitive.shape | Shape (rect/ellipse) | ✅ yes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | 📋 planned | ✅ yes | Pixi paints EvaluatedFrame.paint (no authoring compile) |
| primitive.image | Image | ✅ yes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | 📋 planned | ✅ yes | URI must resolve; missing URI → diagnostic placeholder; Pixi paints EvaluatedFrame.paint |
| anim.transform | Transform keyframes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | 📋 planned | ✅ yes | Pixi paints EvaluatedFrame.paint (no authoring compile) |
| anim.opacity | Opacity keyframes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | 📋 planned | ✅ yes | Pixi paints EvaluatedFrame.paint (no authoring compile) |
| primitive.path | Path + stroke + trim | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | 🟡 partial | paintContours after morph/bend/trim; drawPath paint op |
| style.gradient | Linear/radial gradient fill | ✅ yes | 🟡 partial | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | 🟡 partial | — |
| primitive.svg | SVG asset (as fitted image) | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | ✅ yes | — |
| style.blend | Blend mode | ✅ yes | 🟡 partial | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | 🟡 partial | — |
| effect.blur | Blur / shadow / glow / color-adjust | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | 🟡 partial | Pixi: blur + drop-shadow first; glow/color-adjust follow |
| primitive.video | Video texture | ✅ yes | ❌ no | ✅ yes | 🟡 partial | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | 🟡 partial | drawVideo placeholder until browser/worker frame decode shares paint |
| camera.orthographic | Camera zoom/pan/rotation view | ✅ yes | ✅ yes | ✅ yes | ✅ yes | 🟡 partial | 🟡 partial | ✅ yes | 📋 planned | ✅ yes | View matrix baked into RenderSnapshot items |
| camera.parallax | Layered 2.5D parallax | ✅ yes | 🟡 partial | ✅ yes | ✅ yes | 🟡 partial | 📋 planned | 🟡 partial | 📋 planned | 🟡 partial | — |
| audio.render-plan | AudioRenderPlan (trim/offset/gain/fade/rate) | ✅ yes | 🟡 partial | ✅ yes | ✅ yes | 📋 planned | 🟡 partial | 🟡 partial | 📋 planned | 🟡 partial | Shared AudioRenderPlan in motion-runtime; Remotion adapter + Web Audio planned |

## Known Gaps

- ❌ Pixi video texture: static-texture only, no HTMLVideoElement/rVFC seek/decode
- ❌ Pixi mask/offscreen: no RenderTexture compositing pipeline
- ❌ Remotion audio: AudioRenderPlan exists, <Audio> wiring not connected
- ❌ Prepared indexes: compiler builds Map locally, not exported in artifact
- ❌ Structured diagnostics: compiler throws strings, no path/sourceRef diagnostics
- ❌ Compile cache: no memoization or invalidation
- ❌ Playback engine: RAF-based clock in editor-core, no AudioContext master clock
- ❌ Projection union: no 2D/2.5D/3D geometry abstraction seam

## Legend

- ✅ `yes` — fully implemented and tested
- 🟡 `partial` — partial support, no production guarantee
- ❌ `no` — not implemented
- 📋 `planned` — on roadmap, not started
