# Real Media Preview Audit

This audit records the current MVP baseline for the poster-first media preview
work. It is implementation-focused so later phases can remove each temporary
path without introducing a second source of truth.

## Current ownership map

| Concern | Current owner | Current state | Phase target |
| --- | --- | --- | --- |
| Browser asset upload | `apps/web/components/hub/AssetsWorkspace.tsx`, `apps/web/lib/api/assets.ts` | Generates a capped first-frame poster, then PUTs source + poster directly to R2 | Keep source and poster completion idempotent |
| Upload session | `apps/web/app/api/assets/route.ts` | Creates one source object, one poster key, and one `assets` row | Keep keys server-derived |
| Upload completion | `apps/web/app/api/assets/upload/complete/route.ts` | Verifies source + poster with `HeadObject`, marks preview ready/failed | Add production media probe in Lambda adapter |
| R2 signing | `apps/web/lib/server/r2.ts`, `packages/motion-storage/src/server/providers/r2.ts` | Private presigned PUT/GET | Sign preview GET separately; never expose credentials |
| Local editor media import | `apps/web/components/editor/sidebar/Sidebar.tsx:fileToAsset` | Reads image/video/audio metadata from object URLs | Add first-frame poster and clean up object URLs |
| Asset library preview | `apps/web/components/hub/AssetsWorkspace.tsx:AssetPreview` | Images use source URL; videos use a native video preview | Prefer signed poster URL |
| Timeline video visuals | `apps/web/components/editor/timeline/clips/ClipStrip.tsx` | Signed `poster.webp` with pending/failed/unsupported states | One real poster image stretched to the clip |
| Timeline audio visuals | `apps/web/components/editor/timeline/clips/ClipStrip.tsx` | Thin deterministic linked-audio status rail; no amplitude data | Never generate or persist peak data in MVP |
| Video duration metadata | `Sidebar.tsx:fileToAsset` and V2 asset `duration` | Browser metadata exists for local imports; persisted assets do not expose it | Persist milliseconds in `assets`, convert to Protocol seconds |
| Timeline duration guard | `packages/editor-core/src/interactions/timeline/clip-trim.ts` plus callers | Guard exists in one interaction path | One editor-core limit for every write path |

## Duration write-path inventory

Phase 2 covers pointer updates, inspector fields, editor-core commands, project
import/migration, MCP validation, Supabase saves, compiler/runtime/Remotion
diagnostics, and export preflight validation.

Canonical units:

```text
Supabase asset metadata: milliseconds (integer)
Protocol V2 and editor timeline: seconds (finite number)
Conversion: only at typed API boundaries
```

## Fixture matrix

| Fixture | Expected metadata | Expected preview | Duration rule |
| --- | --- | --- | --- |
| 30-second H.264 video with audio | video + audio streams, 30 s | first decoded frame | cannot exceed 30 s |
| 4:20 H.264 video with audio | video + audio streams, 260 s | first decoded frame | cannot exceed 260 s |
| 5-minute video | video + audio streams, 300 s | first decoded frame | cannot exceed 300 s |
| Silent video | video stream, no audio stream | first decoded frame | cannot exceed source duration |
| Independent audio | audio stream, duration | icon/metadata only | independent audio rules |
| PNG/JPG with alpha | image dimensions | original or canvas poster | not a timed video clip |
| Unsupported/corrupt media | invalid/unsupported | no fabricated preview | upload or preview reports failure |
| Project timeline loop | no media mutation | no poster mutation | transport resets after final layer |

## Known MVP boundaries

- R2 does not inspect or decode objects. Poster creation happens from the local
  `File` in the browser before upload.
- No FFmpeg, SQS, media-analysis Lambda, peak-data JSON, or full filmstrip is
  required for the poster-first MVP.
- Browser duration is suitable for editor UX but not trusted for export;
  export validates the selected source range and the production Lambda adapter
  must add an independent byte-level probe before spending render credits.
- Embedded video audio remains a logical linked component in Protocol V2 and is
  routed through `PlaybackEngineV2`; the MP4 is not physically split.
