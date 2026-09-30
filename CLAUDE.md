# CLAUDE.md

This file gives repository guidance for coding agents.

## Product and architecture

Neonix is an HTML-to-motion-video editor and compiler. Read [`ARCHITECHTURE.md`](ARCHITECHTURE.md) before cross-package changes; it describes the document, compiler, runtime, preview, and export boundaries.

The repository is a pnpm monorepo:

- `apps/web` is the Next.js frontend. It must not define API route handlers or own persistence and job orchestration.
- `apps/api` is the only backend application. Add new HTTP endpoints there.
- `packages/motion-protocol`, `html-compiler`, `motion-compiler`, and `motion-runtime` define document processing.
- `packages/editor-core` and `editor-runtime` own framework-independent editing behavior.
- `packages/canvaskit-preview` is for browser preview; `packages/render-native` is the production native render path.

Web browser requests go through typed clients in `apps/web/lib/api`, which target `NEXT_PUBLIC_API_URL`. Keep raw HTTP calls out of UI components except for direct uploads to signed storage URLs.

## Commands

```bash
pnpm install
pnpm --filter @motionvideo/web dev
pnpm --filter @motionvideo/api dev
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @motionvideo/web typecheck:editor
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web e2e
```

`pnpm-workspace.yaml` pins native dependency architectures for Windows and Linux. Check both environments before changing those settings.

## Editor rules

- `MotionProtocolV2` is the editor document model.
- Document mutations use `@motionvideo/editor-core` commands.
- Keep compiler, playback, and renderer semantics in their corresponding packages, not in React UI.
- `skill-mcp/` and `plugins/` contain Neonix's product skills and plugins.

## Visual comparison notes

`apps/web/app/debug/native-stage` (route `/debug/native-stage`) compares browser output with CanvasKit preview. Round fractional panel coordinates before pixel-level screenshot comparisons. Use the composition dimensions declared in `ComparePreviewLab.tsx` for fixtures, and compare both renderers at the same frame-aligned time.
