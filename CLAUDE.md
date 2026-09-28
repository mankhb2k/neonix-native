# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Neonix is an HTML/JSON-to-motion-video compiler, shipped as a pnpm monorepo (Node 22, pnpm 10). Users (or Claude via remote MCP) create a `MotionProtocolV2` project, preview it live in the browser, and export a deterministic MP4. The full pipeline, in one line:

```
Author (Editor / MCP / AI Agent) → MotionProtocolV2 → Compiler → RuntimeProjectV3
  → Playback (CanvasKit/Skia preview)  |  Export Renderer (native Skia + FFmpeg → MP4)
```

**Read [`ARCHITECHTURE.md`](ARCHITECHTURE.md) before making any cross-package change.** It is the authoritative, current description of the pipeline, every package's responsibility, and — critically — what each package must **not** own. It is kept in sync with the code; treat any mismatch you find between it and the code as a bug to fix, not a doc to ignore.

Both `README.md` and `apps/web/README.md` have been audited and cleaned up to match the current package layout; trust them again. `README.md`'s changelog-style commit history explains what used to exist (`packages/remotion-renderer`, `apps/remotion-site`, `packages/patterns`, the WebGPU/WebGL2 preview + Remotion/Lambda export path) if you need that context.

## Commands

```bash
pnpm install                              # workspace install (Node 22, pnpm 10)
pnpm --filter @motionvideo/web dev        # Next.js dev server → localhost:3000/dashboard

pnpm typecheck                            # every package's tsc --noEmit, in pipeline order
pnpm typecheck:editor                     # faster loop: web editor + protocol/compiler/runtime/skia/export
pnpm lint                                 # `lint` script in every workspace package (eslint)

pnpm test                                 # every package's vitest suite, in pipeline order
pnpm --filter @motionvideo/web test:editor            # certified V2 editor/doc tests only (vitest.editor.config.ts)
pnpm --filter @motionvideo/web exec vitest run <file>  # (broad app tests use vitest.config.ts by default)
pnpm --filter @motionvideo/web exec vitest run <file> --config vitest.editor.config.ts
pnpm --filter @motionvideo/<pkg> exec vitest run <file>   # single test file in any package
pnpm --filter @motionvideo/<pkg> exec vitest run <file> -t "<test name>"  # single test case
pnpm --filter @motionvideo/web e2e        # Playwright e2e (apps/web/playwright.config.ts)

pnpm --filter @motionvideo/render-native exec tsx ../../scripts/validate-arch-deps.ts
                                           # guards core packages (protocol/compiler/runtime/editor-core)
                                           # against depending on renderer or app packages
node scripts/validate-v2-boundary.mjs     # fails if motion-compiler/motion-runtime contain V1 markers
node scripts/validate-v2-consumers.mjs    # fails if the frozen legacy V1 editor surface is imported
                                           # from the certified V2 preview/export path
```

Supabase (schema/migrations, needed for any web app work touching persistence):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push       # migrations are the source of truth — never hand-edit schema in the Dashboard
```

## Architecture

The render pipeline (`Author → Protocol → Compiler → Runtime → Playback & Render`) is documented package-by-package in `ARCHITECHTURE.md`. A few things that aren't obvious from any single file:

- **Two independent render backends consume the same `PaintCommandBuffer`.** `canvaskit-preview` replays it via CanvasKit/Skia for the live browser preview only; `render-native` replays it via native Skia + FFmpeg for the only production MP4 path. These two packages must stay decoupled from each other — `render-native` should never depend on `canvaskit-preview` (they previously did, via a stray `SkiaAsset` type import; that type now lives in `motion-runtime`, which both depend on).
- **Boundaries are enforced by scripts and tests, not just convention.** Before assuming a cross-package import is fine, check `scripts/validate-arch-deps.ts` (package.json dependency direction) and `apps/web/lib/editor/__tests__/architecture-boundary.test.ts` (regex-based import guard for `components/editor`/`hooks/editor`). If you add a legitimate new cross-package dependency, update these guards' allow-lists rather than letting them silently miss it — several packages (`canvaskit-preview`, `playback-engine`, `editor-runtime`, `html-compiler`, `motion-mcp`, `asset-registry`, `audio-analysis`) are not classified in `validate-arch-deps.ts` at all, so it does not check them.
- **`motion-mcp` reuses `computeProjectHash`/`computeRuntimeHash` from `@motionvideo/render-native/contracts`** for project/runtime identity — the only sanctioned dependency an authoring-side package has on the export renderer; it must not reach for anything else in that package (no native rendering).
- **Protocol V1 is fully retired.** `scripts/validate-v2-boundary.mjs` fails the build if V1 markers (`formatVersion: 1`, `motion-protocol/v1` imports, etc.) reappear in `motion-compiler`/`motion-runtime`. Do not add V1 compatibility code.
- **`pnpm-workspace.yaml` pins `onlyBuiltDependencies: [electron, sharp]` and `supportedArchitectures: {os: [win32, linux], cpu: [x64]}`** — this exists so `sharp`'s native binary is present for both Windows dev machines and the Linux Cloud Run/Cloud Build export workers; don't narrow it without checking both platforms still build.

### Web app (`apps/web`)

- Server routes live under `apps/web/app/api` (MCP endpoint at `/api/mcp`, project BFF at `/api/v1/editor/projects/[projectId]`, render jobs at `/api/v1/renders`).
- The editor has exactly one document model, `MotionProtocolV2`. UI components call typed clients in `apps/web/lib/api`; they must not make raw `fetch` calls for project persistence, and must not reimplement compile/evaluate/duration/transport/renderer semantics that belong to `motion-compiler`/`motion-runtime`.
- Supabase Postgres (RLS-protected) owns identity, workspaces, projects, and immutable `project_revisions`; R2 stores asset/media bytes, referenced by metadata only. See `supabase/README.md`.
- `skill-mcp/` and `plugins/` hold Neonix's own packaged MCP skills/plugins (e.g. `neonix-video-export`, `neonix-html-authoring`) — unrelated to Claude Code's own skill system, don't confuse the two.

## Debugging visual fidelity (CanvasKit vs Chrome)

`apps/web/playground/native-stage` (`ComparePreviewLab.tsx`) renders a fixture through both the real browser (iframe) and CanvasKit (canvas) side by side/stacked for pixel comparison; `apps/web/public/docs/html-compiler/fixtures/debug/` holds one-variable-at-a-time repro fixtures for active investigations, registered in `apps/web/lib/playground/html-playground-cases.ts`.

- **In "stacked" layout, the iframe and canvas panels sit at different *fractional* page Y offsets** (cumulative height of whatever renders above each one is rarely an integer number of CSS px). Cropping a full-page or per-locator screenshot with `Math.floor()`/`Math.ceil()` on that fractional bounding box rounds the two panels' offsets down/up asymmetrically and introduces a **spurious ~1px row/column shift** between the two crops that has nothing to do with the actual rendered output. Always `Math.round()` a locator's `getBoundingClientRect()` before cropping for pixel-row/column-level analysis; whole-panel aggregate metrics (mean delta, changed-pixel ratio over the *entire* panel) aren't affected by this and remain trustworthy on their own. Verify a suspected 1px-scale discrepancy by re-cropping the same screenshot with `floor`/`round`/`ceil` and checking whether the offset survives `round()` — if it vanishes, it was this artifact, not a render bug.
- Fixtures registered for this tool must be exactly 1920×1080 (or match whatever WIDTH/HEIGHT `ComparePreviewLab.tsx` currently hardcodes) — a fixture with any other composition size gets silently letterboxed/scaled in one panel but not the other, producing a *different* false mismatch.
- **The same "verify before trusting a mismatch" discipline applies to *timing*, not just pixels.** `evaluateRuntimeProjectV3`'s `options.time` snaps to the nearest exact frame of the composition's own fps (`frameIndexAtTime`/`roundTimeToFrame` in `motion-runtime/src/foundation/clock.ts`) — intentional, matching how an exported video only has discrete frames. A real browser's `document.getAnimations()[i].currentTime` has no such snapping. Requesting an arbitrary non-frame-aligned millisecond (e.g. `250ms` at 30fps, which is frame 7.5) from both sides and diffing the result compares two *different instants* (250ms continuous vs. 233.3ms snapped) and can look exactly like a wrong-easing/wrong-timing bug when the formulas are actually identical. `apps/web/scripts/debug-act-timing-probe.mts` (a local Playwright/CDP tool that seeks real-browser animations to a requested time and diffs against our own evaluated frame) now snaps every requested time to the fps grid before comparing, after this exact mistake produced a false "ease-in-out gives 0.443 instead of 0.500" report — see debt-technical.md's "[KHÔNG PHẢI BUG]" entry. Before trusting any suspected timing mismatch, confirm it survives comparing the two sides at the *identical* instant.
