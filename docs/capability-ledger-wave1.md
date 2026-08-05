# Wave-1 capability ledger

Source of truth: `packages/motion-runtime/src/capability-ledger.ts`.

Only capabilities with **yes** on schema, command, compiler, evaluator, pixi, and worker may enter the AI manifest.

| id | schema | command | compiler | evaluator | pixi | worker | parity | editor |
|----|--------|---------|----------|-----------|------|--------|--------|--------|
| primitive.group | yes | yes | yes | yes | partial | partial | planned | yes |
| primitive.text | yes | yes | yes | yes | partial | partial | planned | yes |
| primitive.shape | yes | yes | yes | yes | partial | partial | planned | yes |
| primitive.image | yes | yes | yes | yes | partial | partial | planned | yes |
| anim.transform | yes | yes | yes | yes | partial | partial | planned | yes |
| anim.opacity | yes | yes | yes | yes | partial | partial | planned | yes |

Unsupported capabilities must emit `RenderDiagnostic` — never silently skip.
