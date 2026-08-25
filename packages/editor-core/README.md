# `@motionvideo/editor-core`

Pure, framework-independent editor primitives for the Neonix Protocol V2
document. The package owns immutable document commands, timeline projection,
selection values, and pointer/timeline/stage interaction algorithms. React,
DOM measurement, persistence, preview, and export remain host concerns.

## Public surface

```ts
import { applyEditorCommand, type EditorCommand } from
  "@motionvideo/editor-core/document/commands";
import { projectLayersToTimeline, type TimelineEdit } from
  "@motionvideo/editor-core/timeline";
import { createStageSession } from
  "@motionvideo/editor-core/interactions/stage";
```

`TimelineEdit` is a small UI intent. The timeline adapter translates it to an
`EditorCommand`; the document command reducer validates the resulting
Protocol V2 document and returns an inverse command for undo.

## Layout

| Path | Responsibility |
| --- | --- |
| `document/commands/` | Atomic Protocol V2 mutation and validation |
| `selection/` | Stable clip selection value object |
| `timeline/model/` | Timeline view-model types |
| `timeline/selectors/` | Protocol V2 projection and visible-range queries |
| `timeline/geometry/` | Pure viewport and lane layout calculations |
| `timeline/policies/` | Drop, snap, zoom, and ruler policies |
| `timeline/edit-intents.ts` | Versionless timeline UI intents |
| `timeline/commands/to-document-command.ts` | Single intent-to-command boundary |
| `interactions/` | Pure pointer, timeline, marquee, and stage sessions |

There is no V1 editor implementation, `/v2` facade, timeline-runtime barrel,
legacy command runner, property/history/export compatibility layer, or V1
fixture surface in this package.
