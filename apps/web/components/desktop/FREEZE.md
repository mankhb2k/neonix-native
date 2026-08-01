# Web desktop UI freeze notice

Vite desktop (`apps/desktop/renderer`) is the **default** desktop UI (`pnpm dev:desktop`).

`apps/web/components/desktop/**` is **frozen**:

- Do not add new desktop-only features on Next.
- Bugfixes on the legacy path only (`pnpm dev:desktop:legacy`).
- After soak + stable release (see [`docs/migration/vite-ui/N8_QA_CUTOVER.md`](../../docs/migration/vite-ui/N8_QA_CUTOVER.md)), delete this tree.
- Packaged smoke uses `pnpm --filter @motionvideo/desktop pack` (not `package`).

See [`docs/migration/vite-ui/README.md`](../../docs/migration/vite-ui/README.md).
