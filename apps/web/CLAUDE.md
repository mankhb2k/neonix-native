# CLAUDE.md

## Scope

`apps/web` is the Next.js frontend. It owns pages, browser components, editor UI, and typed browser-side API clients. It must not add API route handlers, database integrations, or job orchestration. New backend HTTP endpoints belong in `apps/api`.

The web clients in `lib/api` send requests to `NEXT_PUBLIC_API_URL`. Use `apiFetch` for backend requests so the configured API origin and credential behavior stay consistent. Direct storage uploads use signed URLs returned by the API.

## Commands

```bash
pnpm --filter @motionvideo/web dev
pnpm --filter @motionvideo/web typecheck
pnpm --filter @motionvideo/web typecheck:editor
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web build
pnpm --filter @motionvideo/web e2e
```

## Editor boundaries

- `MotionProtocolV2` is the single editor document model.
- Use `@motionvideo/editor-core` for document commands, interaction policy, and history behavior.
- Keep React state and browser DOM adapters in `apps/web`.
- Keep compile, playback, and renderer semantics in their owning packages.
- `lib/server/render/project-runtime.ts` remains a developer utility used by local render and benchmark scripts; it does not host an HTTP API.

See [`README.md`](README.md), [`lib/editor/README.md`](lib/editor/README.md), and the root [`ARCHITECHTURE.md`](../../ARCHITECHTURE.md).
