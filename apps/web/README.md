# Neonix Web

`apps/web` is the Next.js frontend for the Neonix website, docs, playground, dashboard shell, and editor UI. Backend behavior and HTTP endpoints live in `apps/api`.

## Frontend and API boundary

The browser calls typed clients from `lib/api`. Those clients use `NEXT_PUBLIC_API_URL` to talk directly to `apps/api`; Next.js does not host API route handlers. Direct browser uploads use signed URLs returned by the API.

The editor uses `MotionProtocolV2` from `@motionvideo/motion-protocol/v2`. Commands and history policy live in `@motionvideo/editor-core`; React session state lives in `components/editor/EditorProviders`.

The canonical editor library is `lib/editor`:

- `document/` contains document fixtures and browser-side loading helpers.
- `commands/`, `library/`, `inspector/`, and `stage/` contain UI adapters around editor-core behavior.
- `timeline/` and `interaction-host/` adapt browser DOM events to editor-core policies.
- `preview/` contains browser-neutral frame and time calculations.

## Local development

```bash
pnpm install
pnpm --filter @motionvideo/web dev
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to the running `apps/api` origin.

Useful commands:

```bash
pnpm --filter @motionvideo/web typecheck
pnpm --filter @motionvideo/web typecheck:editor
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web build
pnpm --filter @motionvideo/web e2e
```

See [`lib/editor/README.md`](./lib/editor/README.md) for the editor library contract.
