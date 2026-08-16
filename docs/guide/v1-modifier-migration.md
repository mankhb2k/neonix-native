# MotiClip V1 — migration: không còn `modifier`

> Không phải guide production. AI viết JSON mới **không** đọc file này trừ khi migrate artifact cũ.

V1 production (authoring JSON và runtime IR) **không có** `modifiers` / generic modifier stack.

Hành vi nằm trên object sở hữu nó:

| Cũ (modifier / bucket) | V1 |
| --- | --- |
| Layout modifier | `group.layout` + child `layoutItem` |
| Transform modifier / flip | `transform` (scale âm = lật) |
| Motion-path, path-morph, path-bend, trim-path, constraint, secondary-motion, parallax-as-modifier | Không thuộc V1. Morph/bend/trim nếu làm sau: field canonical trên payload, không modifier |
| `modifiers.*` propertyAnimations | Compiler không emit |

Schema file `modifiers.ts` (nếu còn trong tree) không thuộc contract V1.
