# Vite Phase 0 — Baseline & migration governance

> Status: complete  
> Source plan: [`REFACTOR-VITE.md`](../../../REFACTOR-VITE.md) §Phase 0

## Mục tiêu

Khóa behavior của **legacy** desktop editor (Electron + Next trong `apps/web`) trước khi scaffold Vite renderer (Phase 1). Phase 0 không port UI và không di chuyển timeline.

## Artifacts

| File / folder | Vai trò |
|---|---|
| [`feature-inventory.md`](./feature-inventory.md) | Feature desktop hiện có |
| [`parity-checklist.md`](./parity-checklist.md) | So sánh Legacy vs Vite (cột Vite điền dần từ Phase 5+) |
| [`keyboard-shortcut-matrix.md`](./keyboard-shortcut-matrix.md) | Hotkey matrix từ implementation |
| [`performance-baseline.md`](./performance-baseline.md) | Quy trình đo + số baseline |
| [`fixtures/`](./fixtures/) | `small` / `medium` / `large` project envelopes |
| [`goldens/`](./goldens/) | Serialized document sau các op chính |
| [`screenshots/`](./screenshots/) | Baseline UI (workspace / timeline / stage) |

## Renderer flag

```bash
# Default — legacy Next URL
MOTIONVIDEO_RENDERER=legacy pnpm dev:desktop

# Vite (Phase 1+) — requires MOTIONVIDEO_VITE_URL
MOTIONVIDEO_RENDERER=vite MOTIONVIDEO_VITE_URL=http://localhost:5173 pnpm dev:desktop
```

Default luôn là `legacy`. Rollback = giữ hoặc set `MOTIONVIDEO_RENDERER=legacy`.

## Governance

**Không** di chuyển / rename file dưới `apps/web/components/desktop/editor/timeline` và **không** extract `packages/editor-core` cho đến khi:

1. `pnpm --filter @motionvideo/web test` xanh
2. Artifacts Phase 0 trong thư mục này đã merge

## Regenerate fixtures & goldens

```bash
pnpm --filter @motionvideo/web generate:vite-phase0
pnpm --filter @motionvideo/web test -- lib/editor/__tests__/vite-phase0-goldens.test.ts
```

## Capture screenshots

```bash
pnpm --filter @motionvideo/web e2e -- e2e/vite-phase0-screenshots.spec.ts
```

Xem [`screenshots/README.md`](./screenshots/README.md).

## Exit criteria

- [x] Legacy editor vẫn build/test được
- [x] Ít nhất ba project fixtures (`small` / `medium` / `large`)
- [x] Parity checklist trong repo
- [x] Electron chọn renderer qua `MOTIONVIDEO_RENDERER` (default `legacy`)
- [x] Shortcut matrix, performance baseline doc, screenshot baselines
