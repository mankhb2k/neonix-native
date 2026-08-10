# `@motionvideo/editor-react`

React hooks bọc `@motionvideo/editor-interactions` (+ types từ `editor-core`). Dùng chung bởi `apps/web` và `apps/desktop` để host gesture timeline/stage mà **không** nhúng Zustand vào package.

## Vai trò

```text
Pointer events (DOM)
        ↓
  usePointerSessionHost / useClipMove / useTimelineMarquee / …
        ↓
  Callbacks: onSelect · onSeek · onExecute(command)  →  app store
```

- **Pointer host:** một gesture active mỗi surface (`usePointerSessionHost`).
- **Timeline:** seek, marquee, clip move/trim, layer move/trim, visible window, hotkeys.
- **Stage:** pointer session, node transform, selection, hotkeys.

Host truyền refs (scroll), selection hiện tại, và callbacks — package không biết store của app.

## API chính

```ts
import {
  usePointerSessionHost,
  useTimelineSeek,
  useTimelineMarquee,
  useClipMove,
  useClipTrim,
  useStagePointerSession,
} from "@motionvideo/editor-react";
```

| Nhóm | Chức năng |
|---|---|
| `pointer/` | Host session + pointer capture helpers |
| `timeline/use-*` | Seek, marquee, move/trim, visible lanes, hotkeys |
| `stage/use-*` | Stage pointer, transform, selection, hotkeys |

## Không làm

- **Không Zustand / Redux / store riêng** — không `create` store; app giữ `useEditorStore` / desktop session.
- **Không UI layout / CSS / design tokens** — không `TimelineShell`, playhead, inspector; chỉ logic hook.
- **Không persistence / network / Next.js** — không localStorage, Remotion jobs, API routes.
- **Không domain commands thuần** — gọi `editor-core` / `editor-interactions`; không duplicate command-runner.
- **Không renderer** — không Pixi/Remotion; stage hooks chỉ điều phối hit/transform với host.

## Peer dependencies

- `react` / `react-dom` ^19

## Phụ thuộc

- `@motionvideo/editor-core`
- `@motionvideo/editor-interactions`
- `@motionvideo/motion-runtime` (stage timing khi cần)
