# Kế hoạch refactor Desktop Editor sang React + Vite

> Trạng thái: Phase 12 MVP partial — default renderer = Vite (ADR-002); legacy opt-in rollback; web desktop cleanup deferred; Phase 5 interaction slices còn mở  
> Phạm vi: desktop editor, Electron main/preload, Vite renderer và các package trực tiếp phục vụ editor  
> Không thuộc phạm vi hiện tại: xây editor web mới, đồng bộ feature parity cho web, SEO/dashboard/marketplace

## 1. Quyết định kiến trúc

Desktop editor sẽ trở thành sản phẩm chính và source of truth. `apps/web` được giữ nguyên để làm baseline tham chiếu trong quá trình chuyển đổi, nhưng desktop mới không được import code trực tiếp từ `apps/web`.

Chiến lược triển khai là **hybrid migration**:

1. Tạo React + Vite renderer mới chạy song song với renderer Next.js hiện tại.
2. Copy có chọn lọc UI, CSS, Pixi primitives và logic thuần đã ổn định.
3. Viết lại các boundary đang gắn với Next.js, `localStorage`, HTTP export và global Electron API.
4. Tách document/command/timeline core thành package framework-independent.
5. Chuyển từng vertical slice sang renderer mới, khóa behavior bằng test và fixture.
6. Chỉ đổi renderer mặc định của Electron sau khi đạt các quality gate.
7. Xóa legacy desktop-in-web sau một giai đoạn ổn định và vẫn giữ khả năng rollback.

Không thực hiện big-bang rewrite toàn bộ editor. Không tạo nhiều package chỉ để mô phỏng kiến trúc tương lai của web.

## 2. Mục tiêu

### 2.1. Mục tiêu sản phẩm

- Desktop có renderer độc lập, không cần Next.js dev server hoặc Next.js production server.
- Project có thể mở, lưu, auto-save và recovery bằng native filesystem.
- Timeline, stage, playback, keyboard và export giữ nguyên behavior đang có.
- Inspector sau này dùng chung command/history boundary với timeline.
- Tác vụ nặng không khóa Electron main process hoặc renderer.
- Packaged application chạy offline với asset, font, worker và renderer bundle cục bộ.

### 2.2. Mục tiêu kiến trúc

- `apps/desktop` không import `apps/web`.
- Renderer không import `electron`, Node built-ins hoặc native modules.
- `editor-core` không import React, DOM, Electron, Next.js hoặc Zustand React hooks.
- Persistent document mutation đi qua một command boundary duy nhất.
- Document state, session state, playback runtime và resource cache có vòng đời riêng.
- IPC có contract, schema validation, typed error và ownership rõ ràng.
- Không cập nhật React tree hoặc Zustand document store mỗi animation frame.
- Có seam ổn định để thêm inspector, property editor, keyframe, effect, transition và clip type.

### 2.3. Ngoài phạm vi

- Viết lại editor web.
- Tạo abstraction chung cho mọi nền tảng chỉ vì có thể dùng trong tương lai.
- Xây plugin marketplace hoặc runtime plugin system.
- Đổi toàn bộ project schema trong cùng đợt migration.
- Thiết kế lại toàn bộ UI/UX khi đang port.
- Đổi công nghệ render khỏi PixiJS nếu chưa có benchmark chứng minh cần thiết.

## 3. Các nguyên tắc bắt buộc

1. **Desktop-first:** quyết định ưu tiên desktop, không chịu ràng buộc feature parity với web.
2. **Behavior trước, cải tiến sau:** phase port phải giữ behavior; redesign đi thành phase/PR riêng.
3. **Không import app-to-app:** desktop không dùng source file từ `apps/web`.
4. **Copy có chủ đích:** file được copy phải đổi namespace/import và có owner mới; không duy trì symlink hoặc alias ngược về web.
5. **Dependency đi vào trong:** UI phụ thuộc application/core; core không phụ thuộc UI hoặc infrastructure.
6. **Một đường mutation:** timeline và inspector cùng phát command, không tự mutate project.
7. **Preview rẻ, commit nguyên tử:** drag/resize cập nhật session preview; pointer-up commit một command/history entry.
8. **Native capability có cổng:** filesystem, shell, dialog và FFmpeg chỉ đi qua preload/IPC.
9. **Đo trước khi tối ưu:** mọi thay đổi memo, virtualization hoặc cache phải gắn với profile/benchmark.
10. **Mỗi phase có rollback:** Electron legacy renderer vẫn chạy được cho tới khi cutover hoàn tất.

## 4. Kiến trúc đích

```text
apps/
  web/                              # Giữ nguyên trong giai đoạn desktop-first

  desktop/
    package.json
    vite.config.ts
    tsconfig.main.json
    tsconfig.preload.json
    tsconfig.renderer.json

    src/
      main/
        index.ts
        windows/
          create-main-window.ts
          navigation-policy.ts
        ipc/
          register-ipc-handlers.ts
          validate-sender.ts
        services/
          project-file-service.ts
          asset-file-service.ts
          recent-project-service.ts
          export-service.ts
          app-settings-service.ts
        utility-processes/
          export-process-manager.ts
        protocol/
          register-app-protocol.ts

      preload/
        index.ts
        desktop-api.ts

      shared/
        ipc/
          channels.ts
          contracts.ts
          schemas.ts
          errors.ts

    renderer/
      index.html
      src/
        main.tsx
        vite-env.d.ts

        app/
          DesktopApp.tsx
          bootstrap.ts
          providers/
          error-boundary/
          theme/

        editor/
          EditorApp.tsx
          EditorWorkspace.tsx

          timeline/
            components/
            hooks/
            interactions/
            view-models/

          stage/
            components/
            pixi/
            interactions/

          inspector/
            components/
            property-editors/
            registry/

          panels/
          toolbar/
          shortcuts/

        infrastructure/
          desktop-api-client.ts
          repositories/
          export/
          assets/

        styles/

  render-worker/

packages/
  editor-core/                      # Package mới ưu tiên tạo
    src/
      project/
      document/
      selection/
      commands/
      history/
      timeline/
        model/
        commands/
        policies/
        selectors/
        geometry/
        migrations/
      properties/
      playback/
      ports/
      testing/

  motion-schema/                    # Giữ package hiện có
  motion-runtime/
  motion-compiler/
  asset-registry/
  shared/
```

`apps/desktop/renderer` thuộc cùng package `apps/desktop`; không cần tạo package lồng nhau. `pnpm-workspace.yaml` hiện nhận `apps/*`, vì vậy cách này tránh phải thay workspace glob và tránh thêm một package chỉ để build renderer.

### 4.1. Dependency graph

```text
Electron main ───────┐
                     ├── desktop/shared/ipc
Electron preload ────┤
                     │
Vite renderer ───────┘
       │
       ├── renderer/editor UI
       ├── renderer/infrastructure
       └── packages/editor-core
                 │
                 ├── motion-schema
                 ├── motion-runtime
                 ├── motion-compiler
                 └── asset-registry
```

Quy tắc chiều phụ thuộc:

- `editor-core` không được import từ `apps/*`.
- `main` và `preload` không import React renderer.
- Feature UI không gọi `window.motionvideoDesktop` trực tiếp.
- Renderer infrastructure là nơi duy nhất chuyển `DesktopAPI` thành repository/service cho editor.
- IPC contracts không được phụ thuộc Electron runtime để có thể typecheck/test độc lập.

## 5. Process boundary và ownership

### 5.1. Electron main

Main process sở hữu:

- Window lifecycle và native menus.
- Đăng ký secure custom protocol cho renderer production.
- File picker và filesystem permissions.
- Open/save/save-as project.
- Recent project metadata.
- App settings nằm ngoài project document.
- Asset import, copy, relink và path validation.
- Điều phối export/FFmpeg qua utility process hoặc render worker.
- Auto-update và OS integrations.
- Kiểm tra IPC sender và validate payload.

Main process không sở hữu:

- React state.
- Timeline layout/geometry.
- Clip selection.
- Inspector state.
- Playback UI state.
- Pixi display objects.
- Business rule của move/resize/split clip.

### 5.2. Preload

Preload expose API hẹp, type-safe và theo use case:

```ts
export interface DesktopAPI {
  project: {
    open(): Promise<ProjectOpenResult | null>;
    save(input: SaveProjectInput): Promise<SaveProjectResult>;
    saveAs(input: SaveProjectAsInput): Promise<SaveProjectResult>;
    getRecent(): Promise<RecentProject[]>;
  };

  assets: {
    importFiles(input: ImportFilesInput): Promise<ImportedAsset[]>;
    resolveUrl(input: ResolveAssetInput): Promise<ResolvedAsset>;
    relink(input: RelinkAssetInput): Promise<RelinkAssetResult>;
  };

  export: {
    start(input: StartExportInput): Promise<ExportJob>;
    cancel(input: CancelExportInput): Promise<void>;
    subscribe(listener: (event: ExportEvent) => void): () => void;
  };

  window: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
  };
}
```

Không expose trực tiếp:

- `ipcRenderer`.
- `fs`, `path`, `shell` hoặc `child_process`.
- API nhận channel string tùy ý.
- Hàm `openExternal(url)` không có allowlist.
- Generic `invoke(name, payload)`.

### 5.3. Vite renderer

Renderer sở hữu:

- React UI và editor composition.
- Timeline/stage/inspector presentation.
- Pointer/keyboard gesture sessions.
- Session state và view state.
- Document command dispatch.
- Playback display và Pixi runtime integration.
- Gọi native use case qua injected repositories/services.

Renderer không được import Node/Electron. `window.motionvideoDesktop` chỉ được đọc một lần tại composition root:

```ts
const services = createDesktopEditorServices(window.motionvideoDesktop);

createRoot(rootElement).render(
  <DesktopApp services={services} />,
);
```

## 6. Editor state architecture

### 6.1. Project document

Project document là dữ liệu serializable và có version:

- Project metadata.
- Tracks/lanes.
- Clips/scenes.
- Keyframes.
- Effects/transitions khi được bổ sung.
- Asset references, không chứa binary object.
- Canvas/document settings.

Không lưu vào document:

- Selection/hover.
- Open panel.
- Context menu.
- Drag preview.
- Pixi object.
- DOM node.
- `HTMLMediaElement`, `Blob`, `ImageBitmap` hoặc decoded media.
- Export progress.

### 6.2. Command và history

Mọi persistent mutation đi qua command/application boundary:

```ts
interface EditorCommand<TType extends string = string, TPayload = unknown> {
  id: string;
  type: TType;
  payload: TPayload;
  timestamp: number;
}

interface EditorCommandBus {
  execute(command: EditorCommand): CommandResult;
  undo(): CommandResult;
  redo(): CommandResult;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

Các operation ban đầu cần đi qua command:

- Create/delete/duplicate clip.
- Move clip giữa lane và đổi start frame.
- Resize/trim/split clip.
- Reorder/rename/lock/mute lane.
- Update project metadata.
- Update selected object properties.
- Add/remove/update keyframe sau này.

Command phải deterministic. Không đọc DOM, current time hoặc random ID bên trong handler; các giá trị đó phải được resolve trước và đưa vào command payload.

### 6.3. Session state

Session store chứa state ngắn hạn:

- Selection.
- Hover/focus.
- Active tool.
- Timeline viewport, scroll và zoom.
- Drag/resize/marquee preview.
- Playhead UI position.
- Open panel/tab.
- Context menu.
- Keyboard modifier state nếu thực sự cần lưu.

Session store có thể dùng Zustand nhưng phải khởi tạo theo từng editor instance, không dùng singleton module toàn cục.

### 6.4. Playback runtime

Playback runtime không cập nhật React/Zustand document state mỗi frame:

```text
requestAnimationFrame
        ↓
PlaybackClock
        ↓
Animation evaluator
        ↓
Pixi scene adapter
```

React chỉ nhận state tần suất thấp hoặc event có ý nghĩa:

- `playing/paused`.
- Display time đã throttle.
- Playback ended.
- Buffering/error.

### 6.5. Resource/cache state

Tách riêng:

- Asset registry.
- Resolved URL lifecycle.
- Thumbnail cache.
- Waveform cache.
- Font registry.
- Decoded media cache.
- Cleanup/ref-count khi đóng project.

## 7. Seam cho timeline và inspector

Timeline và inspector phải là hai input khác nhau vào cùng document command layer:

```text
Timeline gesture ────┐
                     ├── Command bus → Document → History
Inspector edit ──────┘
```

Inspector không mutate Zustand hoặc object trực tiếp. Chuẩn bị property registry:

```ts
interface PropertyDefinition<T = unknown> {
  id: string;
  label: string;
  group: string;
  editor: PropertyEditorKind;
  isVisible(context: PropertyContext): boolean;
  read(context: PropertyContext): T | MixedValue;
  createCommand(value: T, context: PropertyContext): EditorCommand;
  validate?(value: T, context: PropertyContext): ValidationResult;
}
```

Registry nội bộ có thể mở rộng sau này:

- Property definition.
- Property editor component.
- Clip type definition.
- Lane policy.
- Timeline tool.
- Effect definition.
- Export preset.

Không xây runtime plugin loader ở phase này. Registry chỉ là seam compile-time giúp thêm tính năng mà không sửa switch/conditional khổng lồ.

## 8. Copy, extract và rewrite

### 8.1. Copy hoặc extract có chọn lọc

Ưu tiên tái sử dụng những phần có behavior tốt và ít coupling:

- Timeline visual components.
- Ruler, lanes, clip item, playhead.
- Timeline geometry, selectors và policies thuần.
- Pointer session đã tách khỏi React lifecycle.
- Command/history sau khi không còn import `store/internal`.
- Project migrations và validators.
- Pixi primitives và animation evaluator.
- CSS/theme/icon assets.
- Keyboard command mapping thuần.
- Unit tests, fixtures và interaction scenarios.

Khi copy file UI:

1. Copy vào namespace desktop mới.
2. Thay `@/` bằng relative import hoặc workspace package import.
3. Loại `next/*`, web API và desktop detection khỏi component.
4. Thêm test hoặc parity checklist cho behavior được copy.
5. Không sửa file web chỉ để desktop compile.

### 8.2. Bắt buộc viết lại

- Next page/app router integration.
- `EditorShell` và `DesktopEditorShell` hiện tại.
- `AppLink`, Next navigation và route-dependent UI.
- Title bar đang trộn web export, project modal và desktop detection.
- Project persistence dựa trên `localStorage`.
- Export qua HTTP endpoint dành cho web.
- `useIsDesktop` và feature branch web/desktop.
- Truy cập `window.motionvideoDesktop` rải rác trong feature components.
- Store composition nếu còn singleton hoặc duplicate source of truth.
- Asset URL resolution dựa trên web path.
- Production boot đang `loadURL()` đến Next.

### 8.3. Không tạo lại package đã có

Không tạo package trùng trách nhiệm:

| Tên đề xuất chung | Package hiện có cần ưu tiên |
|---|---|
| Project schema | `motion-schema` |
| Animation/runtime engine | `motion-runtime`, `motion-compiler` |
| Asset manager foundation | `asset-registry` |
| Export/render process | `render-worker` |

Chỉ tách package mới khi có dependency boundary rõ ràng và ít nhất một lý do kỹ thuật như test isolation, process reuse hoặc tránh renderer dependency.

## 9. Kế hoạch triển khai theo phase

## Phase 0 — Khóa baseline và quản trị migration

### Mục tiêu

Biết chính xác behavior nào phải giữ và có khả năng so sánh legacy với Vite.

### Công việc

- [x] Ghi lại danh sách feature desktop hiện có → `docs/migration/vite-phase-0/feature-inventory.md`
- [x] Tạo fixture project nhỏ, trung bình và lớn → `docs/migration/vite-phase-0/fixtures/`
- [x] Chốt serialized output cho các operation chính → `docs/migration/vite-phase-0/goldens/`
- [x] Ghi lại keyboard shortcut matrix → `docs/migration/vite-phase-0/keyboard-shortcut-matrix.md`
- [x] Chụp screenshot baseline cho workspace, timeline và stage → `docs/migration/vite-phase-0/screenshots/`
- [x] Ghi performance baseline → `docs/migration/vite-phase-0/performance-baseline.md`
- [x] Tạo feature flag renderer:

```text
MOTIONVIDEO_RENDERER=legacy
MOTIONVIDEO_RENDERER=vite
```

- [x] Không di chuyển file timeline đang refactor dở cho tới khi test xanh (governance trong Phase 0 README).

### Exit criteria

- [x] Legacy editor vẫn build/test được.
- [x] Có ít nhất ba project fixtures.
- [x] Có checklist parity được lưu trong repo.
- [x] Electron có thể chọn legacy renderer bằng config rõ ràng.

### Rollback

Giữ renderer mặc định là `legacy`.

## Phase 1 — Tạo Vite renderer skeleton

### Mục tiêu

Electron mở được Vite renderer trong development và packaged production mà chưa cần editor.

### Công việc

- [x] Thêm `renderer/index.html` và `renderer/src/main.tsx`.
- [x] Thêm `vite.config.ts`.
- [x] Tách tsconfig cho main/preload/renderer.
- [x] Thêm script: `dev:renderer`, `dev:electron`, `dev:vite`, `build:renderer`, `build:main`, `build:preload`, `build:desktop`, `start:vite:prod`.
- [x] Development load Vite dev server URL (`http://127.0.0.1:5173/`).
- [x] Production đăng ký secure custom protocol `app://bundle/`.
- [x] Production load renderer bundle cục bộ (`MOTIONVIDEO_VITE_PROD=1` hoặc packaged).
- [x] Cấu hình CSP.
- [x] Chặn navigation ngoài app.
- [x] Allowlist protocol/domain trước khi `shell.openExternal`.
- [x] Thêm basic error boundary và diagnostics screen.

### Exit criteria

- [x] `pnpm` script khởi động Electron + Vite ổn định (`dev:vite` / `dev:desktop:vite`).
- [x] Packaged/simulated production mở được renderer khi không có network/dev server (`start:vite:prod`).
- [x] Reload không trắng màn hình (`base: './'` + `app://` assets).
- [x] Font, CSS và static asset load được qua custom protocol.
- [x] Renderer không có Node globals (`sandbox` + `contextIsolation` + leak warn).

### Rollback

Giữ renderer mặc định là `legacy`; không xóa đường load Next cũ.

## Phase 2 — Chuẩn hóa IPC và desktop services

### Mục tiêu

Renderer có typed API ổn định trước khi port editor.

### Công việc

- [x] Tạo `shared/ipc/contracts.ts` và `schemas.ts` (+ `channels.ts`, `errors.ts`).
- [x] Dùng schema runtime (zod) cho mọi payload đi vào main.
- [x] Tạo typed error codes (`VALIDATION`, `UNAUTHORIZED_SENDER`, `NOT_IMPLEMENTED`, `INTERNAL`).
- [x] Tạo `validateSender(event)` cho handler.
- [x] Đăng ký handler tập trung, cleanup `dispose()` khi `before-quit`.
- [x] Tạo renderer `desktop-api-client`.
- [x] Unsubscribe cho IPC event subscription (`onRequestCloseSave`, `export.subscribe`).
- [x] Thiết kế progress/cancel protocol cho export job (types + stub handlers).
- [x] Viết contract test (vitest) cho schema / sender / preload shape / dispose.

### Exit criteria

- [x] Không feature nào expose raw `ipcRenderer`.
- [x] Invalid payload bị reject có typed error.
- [x] External URL allowlist (navigation) + sender URL check; FS path schemas sẵn cho Phase 4.
- [x] Subscribe/unsubscribe không leak listener sau remount.

### Rollback

Typed API mới tồn tại song song với flat shim trên `window.motionvideoDesktop`; chưa chuyển editor web.

## Phase 3 — Tạo `packages/editor-core`

### Mục tiêu

Tách document/timeline behavior khỏi React, Zustand UI và Next.js.

### Công việc

- [x] Tạo package source-first `@motionvideo/editor-core` (vitest node + eslint ban).
- [x] Di chuyển model, commands, history, selectors, policies, geometry và migrations.
- [x] Loại import ngược từ command runner vào `store/internal` (helpers trong `timeline/internal/`).
- [x] Inject `createId` qua `CommandContext` (default random; tests deterministic).
- [x] Giữ `validateTimelineDocument` ở command boundary (`finish`).
- [x] `createEditorStore` (Zustand) ở lại web — gọi core qua package.
- [x] Compatibility re-export ở `apps/web/lib/editor/*` + `timeline/index.ts`.
- [x] Lint boundary cấm React/Zustand/Next/Electron/`apps/*`/`@/` trong core.

### Exit criteria

- [x] Core unit test chạy trong Node (`pnpm --filter @motionvideo/editor-core test`).
- [x] Không import từ `apps/web` hoặc `apps/desktop`.
- [x] Move/trim/split/delete/undo/redo có deterministic `createId` fixtures.
- [x] Web typecheck + tests xanh với re-export layer.

### Rollback

Giữ source legacy và compatibility layer cho tới khi Vite sử dụng core ổn định. Không xóa implementation cũ trong cùng PR extract.

### Ghi chú hoàn thành

Zustand store, pointer sessions, persistence/localStorage, export HTTP và DOM adapters vẫn ở web. `FrameDraft` / `DEFAULT_FRAME_DURATION` sống trong core; `frame-library` localStorage helpers ở web.

## Phase 4 — Desktop shell và project lifecycle

### Mục tiêu

Vite app mở được workspace desktop, tạo/mở/lưu project mà chưa cần đầy đủ timeline.

### Công việc

- [x] Xây `DesktopApp` và app-level state machine (`booting → home → opening → editing → saving → error`).
- [x] Title bar + window controls (frameless drag region).
- [x] Recent projects screen (userData JSON, không localStorage).
- [x] `ProjectRepository` qua IPC (`create` / `open` / `openPath` / `save` / `saveAs` / `getRecent`).
- [x] On-disk format = `.mt` envelope (`motion-editor-project` v1) trong `shared/project-file`.
- [x] Atomic save (temp + rename) + `.bak` trước overwrite.
- [x] Journal skeleton (disabled) — recovery tối thiểu qua `.bak`.
- [x] Dirty document vs clean; unsaved-close confirm.
- [x] Typed errors: `CORRUPT_FILE`, `UNSUPPORTED_VERSION`, `SAVE_FAILED`, `CANCELLED`.

### Exit criteria

- [x] Create/open/save/save-as hoạt động (handlers không còn `NOT_IMPLEMENTED`).
- [x] App cảnh báo unsaved changes khi đóng.
- [x] File hỏng / version không hỗ trợ → typed error, không crash renderer.
- [x] Save failure không làm mất file trước đó (atomic + test).
- [x] Recovery scenario có test tối thiểu (`.bak` + reopen).

### Rollback

Project fixture vẫn mở được bằng legacy hoặc có bản backup trước migration schema. Default renderer vẫn `legacy`.

### Ghi chú hoàn thành

Editing screen là placeholder (JSON + rename) — chưa port timeline. Assets/export IPC vẫn stub. API `project.create` (tránh TS construct signature `new()`).

## Phase 5 — Port timeline vertical slices

### Mục tiêu

Port timeline theo từng behavior thay vì copy nguyên folder một lần.

### Thứ tự vertical slice

1. [x] Timeline viewport, scroll, zoom và ruler — Vite `TimelineViewport` + session hydrate (`docs/migration/vite-phase-5/slice-01-viewport.md`).
2. [ ] Lane rendering và lane flags.
3. [ ] Clip rendering và visible-range selector.
4. [ ] Selection, multi-selection và marquee.
5. [ ] Playhead seek/scrub.
6. [ ] Drag clip trong/cross-lane.
7. [ ] Resize/trim/split.
8. [ ] Clipboard, duplicate và delete.
9. [ ] Undo/redo.
10. [ ] Keyboard shortcuts và context menus.
11. [ ] Timeline-to-stage synchronization.

### Quy tắc interaction

- Pointer-down tạo session.
- Pointer-move cập nhật preview, coalesce bằng RAF.
- Preview không ghi history.
- Pointer-up tạo đúng một command.
- Pointer-cancel, blur và unmount cleanup session/listener.
- Domain intent không phụ thuộc DOM event object.

### Exit criteria

- Mỗi slice có parity checklist và test. *(slice 1: checklist + unit tests)*
- Không có render loop hoặc `getSnapshot` trả object mới liên tục.
- Không subscribe toàn bộ mega-store ở từng clip. *(slice 1: per-instance reducer, no mega-store)*
- Timeline lớn chỉ mount/render visible range theo budget đã đặt. *(ruler tick culling; clip virtualization = slice 3)*
- Một drag gesture tạo tối đa một history entry. *(chưa áp dụng — chưa có drag)*

### Rollback

Feature flag theo slice hoặc giữ Vite renderer chưa public cho tới khi toàn bộ timeline gate đạt.

### Ghi chú slice 1

Desktop phụ thuộc `@motionvideo/editor-core`. Không import `apps/web`. Editing shell hiển thị viewport + zoom; JSON debug trong `<details>`. Zoom không dirty document.

## Phase 6 — Port Pixi stage và playback

### Mục tiêu

Stage nhận cùng editor document nhưng không ép React render mỗi frame.

### Ghi chú thực tế

Monorepo **không có PixiJS**. Stage legacy/Vite là **DOM/CSS PreviewStage** + `motion-compiler` / `motion-runtime`. Checklist: [`docs/migration/vite-phase-6/stage-playback.md`](docs/migration/vite-phase-6/stage-playback.md).

### Công việc

- [x] Reuse DOM preview primitives / evaluator (`preview-evaluate`, `compose-layers`).
- [x] Document → compose layers tại thời gian clock (không set document store mỗi frame).
- [ ] Incremental display-object updates theo changed IDs *(N/A Pixi; DOM recompose theo frame leaf)*.
- [x] Playback clock tách khỏi document session (`createPlaybackClockStore` per instance).
- [x] Cleanup RAF/driver khi unmount / leave project.
- [x] ResizeObserver scale stage host (DPR-ish fit).
- [x] Test seek / pause / resume / end-of-playback (driver unit).
- [ ] Đo memory qua nhiều lần open/close project (manual/follow-up).

### Exit criteria

- [x] Playback không set React document state mỗi frame (leaf clock bridge).
- [ ] Timeline playhead và stage đồng bộ — **deferred** tới Phase 5 slice 5 (chưa có playhead UI).
- [x] Driver dispose không leak RAF listener (unit).
- [ ] Visual parity fixtures đầy đủ — follow-up.

### Rollback

Giữ stage legacy làm reference; không đổi schema để phục vụ riêng renderer mới trong phase này.

## Phase 7 — Asset pipeline desktop

### Mục tiêu

Asset được import, resolve, relink và cleanup theo desktop lifecycle.

### Status (MVP)

Checklist: [`docs/migration/vite-phase-7/assets.md`](docs/migration/vite-phase-7/assets.md).

**Done:** copy-on-import vào `<projectDir>/assets/`, relative `uri`, `resolveContainedPath` + `PATH_DENIED` / `MISSING_ASSET`, `mvmedia://` protocol, IPC `importFiles` / `resolveUrl` / `relink` / `listMissing`, renderer AssetPanel + document merge (dirty). Import yêu cầu project đã Save.

**Deferred:** thumbnail/waveform disk cache, link-without-copy UI, timeline media drop, ffprobe metadata, command-runner asset transactions.

### Công việc

- [x] Asset repository client trên desktop IPC (không phụ thuộc `apps/web`; `asset-registry` vẫn chỉ fonts/SVG sanitize).
- [x] Chuẩn hóa asset ID + project-relative path (không absolute identity).
- [x] Import/copy policy rõ ràng (Save first).
- [x] Phát hiện missing asset khi mở / scan.
- [x] Relink một asset (dialog + copy).
- [ ] Cache metadata, thumbnail và waveform.
- [ ] Revocation/cleanup object URL đúng lifecycle (MVP dùng protocol URL, không blob URL).
- [x] Validate mọi path nhận từ renderer (`resolveContainedPath`).

### Exit criteria

- [x] Di chuyển project folder không làm mất asset đã đóng gói cùng project (relative uri).
- [x] Missing assets không làm crash timeline/stage.
- [ ] Relink cập nhật document bằng command/transaction — MVP ghi dirty `documentJson` trực tiếp.
- [ ] Cache có giới hạn và cleanup.

### Rollback

Giữ original path/metadata trong migration backup; không xóa asset gốc tự động.

## Phase 8 — Inspector foundation

### Mục tiêu

Thêm inspector trên seam đã chuẩn bị, không tạo mutation path thứ hai.

### Status (MVP)

Checklist: [`docs/migration/vite-phase-8/inspector.md`](docs/migration/vite-phase-8/inspector.md).

**Done:** `editor-core` property registry + `executePropertyCommand` (transform / opacity / metadata), history coalesce, desktop session selection + undo/redo, Inspector panel (clip/node stub selection), feature flag `INSPECTOR_ENABLED`.

**Deferred:** Phase 5 timeline hit-testing selection; text/media/animation groups; full CapCut inspector tabs.

### Công việc

- [x] Tạo property registry và property editor registry (compile-time; editor kind → component).
- [x] Hỗ trợ single selection và mixed value cho multi-selection (stub chips).
- [x] Property edit phát command (`DocumentPropertyCommand`).
- [x] Numeric scrub dùng coalesce history (`replaceOrPushHistory`).
- [x] Validation ở property/command boundary (`motionPropertyCapability` + `validate`).
- [x] Bắt đầu với transform, opacity và common metadata.
- [ ] Sau đó thêm text/media/animation groups.

### Exit criteria

- [x] Timeline và inspector phản ánh cùng document source of truth (session → envelope JSON).
- [x] Undo/redo property edit hoạt động.
- [x] Numeric scrubbing không tạo hàng trăm history entries.
- [x] Thêm property mới không cần sửa component inspector tổng bằng switch lớn (registry + editor kind).

### Rollback

Inspector có thể feature-flag (`INSPECTOR_ENABLED`) mà không ảnh hưởng timeline/document command core.

## Phase 9 — Export và long-running jobs

### Mục tiêu

Export không block renderer hoặc Electron main process.

### Status (MVP)

Checklist: [`docs/migration/vite-phase-9/export.md`](docs/migration/vite-phase-9/export.md).

**Done:** `export-service` + `export-process-manager` (spawn `cli-export`), sequenced progress/cancel/complete events, temp cleanup, overwrite policy, desktop bake + Export UI (`EXPORT_ENABLED`). CLI env for outDir/assetBase/mp4Path.

**Deferred:** Electron `utilityProcess`, BullMQ/cloud upload, frame-level IPC progress.

### Công việc

- [x] Main tạo job ID và điều phối child process / render-worker CLI.
- [x] Renderer chỉ gửi immutable export request (`projectJson`).
- [x] Progress event có sequence/status rõ ràng.
- [x] Hỗ trợ cancel, timeout và worker crash (failed event).
- [x] Không gửi raw frame qua IPC.
- [x] Validate output path và overwrite intent.
- [x] Cleanup temp directory khi success/failure/cancel.
- [ ] Golden test cho output metadata/frame ở fixture nhỏ (manual / existing acceptance scripts).

### Exit criteria

- [x] UI vẫn responsive khi export (async job + events).
- [x] Đóng window / dispose IPC không để orphan process ngoài policy (`dispose` kills jobs).
- [x] Cancel kết thúc job và cleanup temp files.
- [x] Failure được map thành typed events / `EXPORT_FAILED` / `OUTPUT_DENIED`.

### Rollback

Giữ export pipeline web HTTP sau feature flag trong ít nhất một chu kỳ release nội bộ. Desktop: `EXPORT_ENABLED = false`.

## Phase 10 — Performance hardening

### Mục tiêu

Đạt performance budget bằng profile thực tế, không memo hóa đại trà.

### Status (MVP)

Checklist: [`docs/migration/vite-phase-10/performance.md`](docs/migration/vite-phase-10/performance.md).

**Done:** TransportBar frame-index leaf isolation; `useVisibleTimeline` + display-only `ClipStrip` cull; dense-fixture mount budget tests.

**Deferred:** drag/scrub long-task budgets (Phase 5 interactions); playhead sync; vertical lane windowing; manual wall-clock table fill on Vite.

### Công việc

- [ ] React Profiler cho timeline interactions (manual when drag lands).
- [ ] Chrome Performance profile cho playback/drag.
- [x] Đo / giảm subscription fan-out playback (`currentTime` → frame index).
- [x] Virtualize/cull clips theo viewport (display-only strips).
- [x] Stable selector outputs cho transport leaf.
- [ ] Chỉ dùng `memo` khi props ổn định và profile cho thấy có lợi.
- [x] Tránh hot-path float clock trên shell/timeline viewport.
- [ ] Batch document notifications sau một transaction.
- [x] Tách high-frequency playback display khỏi React float ticks.
- [x] Thiết lập performance regression fixture (DOM-count).

### Performance budget ban đầu

| Scenario | Budget ban đầu | MVP |
|---|---:|---|
| App shell interactive | ≤ 2 giây trên máy dev chuẩn | manual |
| Open project trung bình | ≤ 1 giây sau khi đọc file | manual |
| Pointer drag update | ≤ 16,7 ms/frame ở 60 Hz | deferred |
| Timeline scrub | Không có task renderer > 50 ms lặp lại | deferred |
| Playback | Không re-render toàn bộ timeline mỗi frame | done (shell/viewport) |
| 2.000 clips | Không mount toàn bộ clip ngoài visible range | done (cull + test) |
| Open/close project lặp lại | Không tăng listener/RAF/resource tuyến tính | partial (driver dispose) |

### Exit criteria

- [x] Có checklist trước/sau cho optimization MVP (playback leaf + cull).
- [ ] Không có long task lặp lại trong drag/playback chuẩn (drag deferred).
- [ ] Memory ổn định sau nhiều vòng open/close fixture (manual follow-up).

## Phase 11 — Security, packaging và release readiness

### Status (MVP partial — 2026-07)

- Packager: electron-builder Windows `dir` / NSIS (`pack` / `dist`)
- Artifact harden: release sourcemaps off, prod HTML/session CSP, `app://` refuses `.map`, packaged → Vite (`app://bundle`)
- Checklist + smoke: [docs/migration/vite-phase-11/security-packaging.md](docs/migration/vite-phase-11/security-packaging.md)
- **Deferred / later:** unpackaged already cut over (Phase 12); auto-update, OS deep-links / `.mt` association, packaged export worker, multi-OS matrix, code signing

### Mục tiêu

Renderer Vite an toàn và hoạt động đúng trong artifact đóng gói.

### Công việc

- `contextIsolation: true`.
- `nodeIntegration: false`.
- Sandbox renderer.
- CSP không dùng `unsafe-eval` trong production.
- Validate IPC sender.
- Deny/allowlist navigation và new window.
- Allowlist external protocols/domains.
- Custom protocol xử lý path traversal an toàn.
- Không load remote code trong privileged renderer.
- Kiểm tra source map/secrets trong artifact.
- Smoke test installer/package trên OS mục tiêu.
- Kiểm tra auto-update compatibility nếu có.

### Exit criteria

- Security checklist được review.
- Packaged app chạy offline.
- Không phụ thuộc Vite/Next dev server.
- Không có Node API trong renderer bundle.
- Deep link/open project file hoạt động theo scope release.

## Phase 12 — Cutover và dọn legacy

### Status (MVP partial — 2026-07)

- Default renderer = **Vite** ([ADR-002](docs/ADR/002-vite-renderer-source-of-truth.md)); rollback `MOTIONVIDEO_RENDERER=legacy`
- Scripts: `dev:desktop` → Vite; `dev:desktop:legacy` → Next-in-Electron
- Checklist: [docs/migration/vite-phase-12/cutover.md](docs/migration/vite-phase-12/cutover.md)
- **Deferred:** delete `apps/web` desktop-only components (separate PR); full interaction parity; packaged export worker

### Mục tiêu

Vite trở thành renderer mặc định mà vẫn có rollback release-level.

### Công việc

- Chạy parity test cuối với fixture và workflow thật.
- Chuyển default `MOTIONVIDEO_RENDERER` sang `vite`.
- Giữ opt-in legacy trong một giai đoạn nội bộ/canary.
- Theo dõi crash, save failure, export failure và startup time.
- Đóng băng desktop feature mới trên editor Next.
- Sau khi ổn định, xóa desktop-only components khỏi `apps/web` bằng PR riêng.
- Không xóa web editor nếu vẫn cần tham chiếu hoặc sản phẩm web hiện hữu.
- Viết ADR ghi nhận Vite renderer là source of truth.

### Exit criteria

- Không còn production path yêu cầu Next cho desktop.
- Không còn desktop feature import từ `apps/web`.
- Migration/rollback của project file đã được kiểm tra.
- Support/debug workflow có log và version information cần thiết.

### Rollback

- Release trước vẫn cài/khởi động được.
- Project migration không phá backward data do luôn có backup.
- Trong thời gian canary có thể đổi renderer flag về legacy.

## 10. Đề xuất chia PR

Mỗi PR phải nhỏ hơn một phase nếu phase quá lớn. Thứ tự đề xuất:

| PR | Nội dung | Rủi ro |
|---:|---|---:|
| 1 | Baseline fixtures, parity checklist, renderer flag | Thấp |
| 2 | Vite skeleton và development bootstrap | Thấp |
| 3 | Production custom protocol, CSP, navigation policy | Trung bình |
| 4 | IPC contracts, schemas, sender validation | Trung bình |
| 5 | `editor-core` package scaffold và boundary lint | Thấp |
| 6 | Extract document/model/migrations | Trung bình |
| 7 | Extract command/history/timeline policies | Cao |
| 8 | Desktop shell, recent projects, native title bar | Trung bình |
| 9 | Project open/save/atomic write/recovery | Cao |
| 10 | Timeline read-only viewport/ruler/lane/clip | Trung bình |
| 11 | Selection, playhead và keyboard | Trung bình |
| 12 | Drag/resize/split và history parity | Cao |
| 13 | Pixi stage read-only document adapter | Trung bình |
| 14 | Playback runtime synchronization | Cao |
| 15 | Asset import/resolve/relink/cache | Cao |
| 16 | Inspector registry foundation | Trung bình |
| 17 | Export utility process pipeline | Cao |
| 18 | Performance hardening | Trung bình |
| 19 | Packaging/security/release smoke tests | Cao |
| 20 | Vite default cutover | Cao |
| 21 | Legacy desktop cleanup trong web | Trung bình |

Không gộp các việc sau trong cùng PR:

- Đổi project schema và port UI.
- Di chuyển file và redesign behavior.
- Đổi store model và đổi IPC.
- Đổi playback runtime và export pipeline.
- Cutover production và xóa legacy.

## 11. Test strategy

### 11.1. Unit tests

Tập trung trong `editor-core`:

- Command apply/undo/redo.
- Timeline placement/collision/snapping.
- Resize/trim/split boundary.
- Multi-selection property changes.
- Migration và invariant validation.
- Playback time mapping.
- Property registry read/write command creation.

### 11.2. Contract tests

- Renderer repository ↔ preload API.
- Preload API ↔ IPC handler.
- Payload schema success/failure.
- Typed error serialization.
- Subscription cleanup.
- Export progress ordering và cancel.

### 11.3. Component/interaction tests

- Timeline pointer gesture.
- Keyboard focus ownership.
- Marquee và selection modifiers.
- Inspector mixed values.
- Dirty state và close confirmation.
- Error boundary/recovery UI.

### 11.4. End-to-end tests

- Launch packaged/simulated production app.
- Create/open/edit/save/reopen project.
- Import and relink assets.
- Timeline edit + undo/redo.
- Playback and seek.
- Export success/cancel/failure.
- Crash/recovery scenario.
- Open project through OS integration nếu hỗ trợ.

### 11.5. Golden/parity tests

- Serialized project document.
- Migration round-trip.
- Selected exported frames hoặc metadata.
- Screenshot fixtures cho timeline/stage.
- Keyboard command outcome.

## 12. Performance và React guidelines

### Hooks

- Effect phải có cleanup rõ ràng cho listener, RAF, observer, timer và IPC subscription.
- Không dùng effect để đồng bộ hai source of truth nếu có thể derive selector.
- Không set state trong effect chỉ để mirror prop/store value.
- Event handler cần latest state có thể dùng ref/event callback thay vì resubscribe mỗi render.
- Pointer session phải xử lý `pointercancel`, blur và unmount.

### Zustand/selectors

- Component chỉ subscribe field/read model cần thiết.
- Selector không trả array/object mới vô điều kiện.
- Dùng shallow/equality có chủ đích, không che mutation bug.
- Store phải tạo theo editor instance.
- Không để actions vừa mutate document vừa tự đồng bộ nhiều bản sao timeline/project.

### Memoization

- `memo` dành cho component hot list có props ổn định.
- `useMemo` không dùng để sửa correctness hoặc che selector bất ổn.
- Không memo phép tính rẻ chỉ vì thói quen.
- Callback memo chỉ có giá trị khi consumer dựa vào identity.
- Profile trước/sau với project fixture lớn.

### Render loop safeguards

- `useSyncExternalStore` snapshot phải referentially stable khi state không đổi.
- Playback clock không tạo object snapshot mới mỗi `getSnapshot()`.
- Effect dependency không chứa object/function được tạo lại nếu effect set state.
- IPC/event listener không được đăng ký lại mà thiếu cleanup.
- Không set React state từ Pixi ticker mỗi frame.

## 13. Project persistence và data safety

Format cuối cùng cần ADR riêng. Tối thiểu project data phải có:

```ts
interface ProjectEnvelope {
  format: "moticlip-project";
  schemaVersion: number;
  appVersion: string;
  savedAt: string;
  document: EditorDocument;
}
```

Yêu cầu:

- Atomic write.
- Backup trước migration.
- Không overwrite file gốc nếu serialize/validate thất bại.
- Validate document trước và sau migration.
- Asset reference không phụ thuộc duy nhất vào absolute path.
- Recovery journal có giới hạn và cleanup.
- Unknown/newer schema báo lỗi rõ, không âm thầm drop field.
- Save result trả revision/hash để phát hiện stale write nếu cần.

Không tự động xóa asset hoặc project backup trong các phase đầu.

## 14. Rủi ro và biện pháp giảm thiểu

| Rủi ro | Mức | Biện pháp |
|---|---:|---|
| Copy toàn bộ kéo theo coupling Next | Cao | Copy theo vertical slice, grep cấm `next/*` và `apps/web` |
| Hai editor lệch behavior | Cao | Legacy chỉ là baseline tạm thời; fixture/parity test; desktop là source of truth sau cutover |
| Project data mất khi đổi persistence | Rất cao | Atomic save, backup, migration fixtures, không xóa bản cũ |
| Command core vẫn phụ thuộc store internal | Cao | Invert dependency trước khi extract, boundary lint |
| IPC trở thành API generic thiếu an toàn | Cao | Per-use-case API, schema validation, sender validation |
| FFmpeg làm treo app | Cao | Utility process/render worker, progress/cancel protocol |
| Playback gây render storm | Cao | Clock ngoài React, imperative Pixi/playhead update, throttle display state |
| Virtualization làm sai interaction | Trung bình | Port behavior trước, virtualize sau với E2E hit-test/scroll tests |
| Asset URL lỗi trong packaged build | Cao | Custom protocol smoke test, asset repository, packaged E2E |
| Package hóa quá sớm | Trung bình | Chỉ thêm `editor-core`; tách tiếp khi có consumer/boundary thực |
| Xóa legacy quá sớm | Cao | Cutover và cleanup ở hai PR/release khác nhau |

## 15. Automation và enforcement

Thêm lint/import rules hoặc CI checks:

- Cấm `apps/desktop/**` import `apps/web/**`.
- Cấm renderer import `electron`, `fs`, `path`, `child_process`.
- Cấm `packages/editor-core` import React/DOM/Next/Electron.
- Cấm feature components đọc `window.motionvideoDesktop`.
- Cấm IPC channel literal ngoài `shared/ipc/channels.ts`.
- Typecheck main, preload và renderer bằng tsconfig riêng.
- Build Vite production trong CI.
- Chạy packaged/simulated production smoke test.
- Chạy core tests và migration fixtures trước merge.

Kiểm tra grep đơn giản có thể dùng ban đầu, sau đó nâng thành ESLint boundaries khi folder ổn định.

## 16. Definition of Done cho migration

Migration chỉ được xem là hoàn thành khi:

- Electron production load Vite bundle cục bộ.
- Desktop không cần Next dev/prod server.
- Desktop không import `apps/web`.
- Open/save/save-as/recovery hoạt động an toàn.
- Timeline edit chính đạt parity và có undo/redo.
- Pixi stage/playback không tạo React render storm.
- Asset import/relink hoạt động trong packaged app.
- Export chạy ngoài renderer/main thread và hỗ trợ cancel/error.
- Inspector foundation dùng property command boundary.
- IPC được type, validate và kiểm tra sender.
- Performance budget được đo và đạt trên máy chuẩn.
- Packaged smoke test xanh.
- Có rollback release/data rõ ràng.
- Legacy desktop-in-web chỉ được xóa sau giai đoạn ổn định.

## 17. Việc nên làm ngay

Thứ tự thực thi ngắn hạn:

1. Chốt test và fixture của timeline refactor hiện tại.
2. Thêm renderer flag nhưng chưa đổi default.
3. Tạo Vite renderer skeleton trong `apps/desktop/renderer`.
4. Chuyển production boot từ khái niệm Next URL sang custom app protocol phía sau flag.
5. Chuẩn hóa typed IPC và security boundary.
6. Tạo `packages/editor-core` và tháo import từ command runner vào `store/internal`.
7. Xây desktop shell/project lifecycle.
8. Port timeline theo vertical slice.
9. Port Pixi/playback.
10. Chuyển asset/persistence/export sang native services.
11. Xây inspector trên property registry/command seam.
12. Performance hardening, packaging, cutover và cuối cùng mới cleanup legacy.

Nếu trong quá trình triển khai xuất hiện xung đột giữa tốc độ port và kiến trúc, ưu tiên giữ ba invariant: **không import từ web, persistent mutation qua command, native access qua typed IPC**. Đây là ba seam quyết định khả năng maintain desktop editor về sau.
