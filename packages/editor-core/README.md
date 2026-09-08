# `@motionvideo/editor-core`

Pure, framework-independent editor primitives for the Neonix Protocol V2
document. The package owns immutable document commands, timeline projection,
selection values, and pointer/timeline/stage interaction algorithms. React,
DOM measurement, persistence, preview, and export remain host concerns.

## Public surface

```ts
import { applyEditorCommand, type EditorCommand } from
  "@motionvideo/editor-core";
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
| `history/` | Atomic command transactions, inverse history entries, coalescing, and history memory policy |
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

## Playback boundary

`editor-core` owns timeline projection, seek geometry, and interaction intent;
it does not own a transport clock and must not import
`@motionvideo/playback-engine`. The web adapter translates those intents into
playback commands. Current time and playback state come back from the engine as
a host-provided snapshot.

## Responsibility contract

| Package | Owns | Must not own |
| --- | --- | --- |
| `editor-core` | Protocol V2 document commands, schema validation, inverse commands, atomic transactions, history policy, selection, timeline projection/geometry, edit intents, and pure pointer/stage interaction math | Runtime compilation/evaluation, playback clock, media elements, canvas, React, persistence, or compiler capability checks |
| `motion-compiler` | Lowering a valid Protocol V2 document into `RuntimeProjectV3` | Editor commands, selection, UI geometry, transport, or DOM state |
| `motion-runtime` | Deterministic timing, duration, layer evaluation, paint commands, and audio/video plans for `RuntimeProjectV3` | Authoring mutations, undo/redo, pointer gestures, React, and browser media lifecycle |
| `playback-engine` | Realtime transport, clock, seek/play/pause, readiness, scheduling, and audio/video backend delivery | Document editing, timeline layout, compiler policy, or rendering pixels |
| `apps/web` | React/UI, DOM/canvas adapters, stores, persistence, compiler/runtime orchestration, and host diagnostics | Reimplementing document, timeline, runtime, or transport semantics already owned by the packages above |

The command reducer commits only structurally valid Protocol V2 documents. A
compiler or runtime failure is reported by the host adapter after the document
commit; it is not an `editor-core` validation rule.
