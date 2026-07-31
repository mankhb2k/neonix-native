# Web desktop UI freeze notice

Vite desktop (`apps/desktop/renderer`) is the **default** desktop UI (`pnpm dev:desktop`).

`apps/web/components/desktop/**` is **frozen**:

- Do not add new desktop-only features on Next.
- Bugfixes on the legacy path only (`pnpm dev:desktop:legacy`).
- After soak + stable release, delete this tree.

See [`docs/migration/vite-ui/README.md`](../../docs/migration/vite-ui/README.md).
