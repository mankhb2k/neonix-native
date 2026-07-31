# Screenshot baselines

Viewport: **1440×900** (matches Electron default and Playwright editor fixture).

| File | Subject |
|---|---|
| `workspace.png` | Full editor chrome (sidebar + stage + timeline) |
| `timeline.png` | Timeline tracks scroll region |
| `stage.png` | Preview stage |

Captured from seeded `fixtures/small.project.json` on legacy Next.

## Regenerate

```bash
pnpm --filter @motionvideo/web e2e -- e2e/vite-phase0-screenshots.spec.ts
```

Requires Playwright Chromium (`pnpm --filter @motionvideo/web e2e:install`).

Compare visually (or image-diff tools) after Vite port — no CI visual regression gate in Phase 0.
