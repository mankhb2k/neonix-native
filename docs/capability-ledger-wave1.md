# Capability ledger (wave-1 + wave-2)

Source of truth: `packages/motion-runtime/src/capability-ledger.ts`.

Only capabilities with **yes** on schema, command, compiler, evaluator, pixi, and worker may enter the AI manifest.

## Wave-1

| id | schema | command | compiler | evaluator | pixi | worker | parity | editor |
|----|--------|---------|----------|-----------|------|--------|--------|--------|
| primitive.group | yes | yes | yes | yes | partial | partial | planned | yes |
| primitive.text | yes | yes | yes | yes | partial | partial | planned | yes |
| primitive.shape | yes | yes | yes | yes | partial | partial | planned | yes |
| primitive.image | yes | yes | yes | yes | partial | partial | planned | yes |
| anim.transform | yes | yes | yes | yes | partial | partial | planned | yes |
| anim.opacity | yes | yes | yes | yes | partial | partial | planned | yes |

## Wave-2

| id | schema | command | compiler | evaluator | pixi | worker | parity | editor |
|----|--------|---------|----------|-----------|------|--------|--------|--------|
| primitive.path | yes | yes | yes | yes | partial | yes | planned | partial |
| style.gradient | yes | partial | yes | yes | partial | yes | planned | partial |
| primitive.svg | yes | yes | yes | yes | partial | yes | planned | yes |
| style.blend | yes | partial | yes | yes | partial | yes | planned | partial |
| effect.blur | yes | yes | yes | yes | partial | yes | planned | partial |
| primitive.video | yes | no | yes | partial | partial | yes | planned | partial |
| camera.orthographic | yes | yes | yes | yes | partial | yes | planned | yes |
| camera.parallax | yes | partial | yes | yes | partial | yes | planned | partial |

Unsupported capabilities must emit `RenderDiagnostic` — never silently skip.

Manifest version: `wave2.0`.
