# Web desktop UI freeze notice

Vite desktop (`apps/desktop/renderer`) is the source of truth for desktop UI going forward.

`apps/web/components/desktop/**` is **frozen** for new features:

- Do not add new desktop-only features on Next.
- Bugfixes on legacy path only until packaged cutover + soak complete.
- After a stable Vite release, delete this tree (see UI-8 checklist).

See [`docs/migration/vite-ui/README.md`](../../docs/migration/vite-ui/README.md).
