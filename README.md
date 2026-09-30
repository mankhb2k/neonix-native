# Neonix

Neonix is an HTML-to-motion-video editor and compiler. The repository is a pnpm monorepo with a Next.js frontend in `apps/web`, a backend API in `apps/api`, and reusable compiler, editor, playback, and rendering packages.

## Application boundaries

- `apps/web` owns the website and browser UI. It has no API route handlers or database integrations. Its typed browser clients call `apps/api` using `NEXT_PUBLIC_API_URL`.
- `apps/api` is the only application backend. New HTTP APIs belong there.
- `packages/motion-protocol`, `packages/html-compiler`, `packages/motion-compiler`, and `packages/motion-runtime` define the document and render pipeline.
- `packages/editor-core` and `packages/editor-runtime` provide framework-independent editor logic.
- `packages/canvaskit-preview` and `packages/render-native` provide browser preview and native video rendering.

## Local development

Requirements: Node.js 22 and pnpm 10.

```powershell
pnpm install
pnpm --filter @motionvideo/web dev
pnpm --filter @motionvideo/api dev
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL` to the API server. The API has its own environment example at `apps/api/.env.example`.

## Useful checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @motionvideo/web typecheck:editor
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web e2e
```

See [`ARCHITECHTURE.md`](ARCHITECHTURE.md) for the compiler, runtime, preview, and rendering contracts.
