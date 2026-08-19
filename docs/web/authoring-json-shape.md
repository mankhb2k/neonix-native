# Authoring JSON shape (atomic render core)

> Quy ước JSON **core** của `MotionProjectV1` cho người đọc / AI.
>
> Hai tầng dữ liệu:
>
> - **Core JSON** — chỉ field ảnh hưởng frame render + identity tối thiểu. Lưu disk, compile, export, JSON panel (expanded).
> - **Envelope / session** — sugar editor (tokens, variables, bindings, layout, metadata extras, audit) — **không** nằm trong core JSON.
>
> Hai serializer cho core:
>
> - **Canonical** — `serializeMotionProjectV1` (`packages/motion-protocol/src/v1/parse.ts`): sort key alphabet. Dùng cho **hash / compare / artifact gate**.
> - **Authoring** — `serializeMotionProjectV1Authoring` (`packages/motion-protocol/src/v1/normalize-authoring.ts`): thứ tự field semantic + prune rỗng. Dùng cho **save file / docs / AI output**.

---

## 0. Core vs envelope

| Tầng | Chứa | Lưu disk? |
| ---- | ---- | --------- |
| **Core** | `format`, `formatVersion`, `metadata` (id/name/locale), `composition`, `layers`, `assets`, `components` | Có |
| **Envelope** | `metadataExtras`, `tokens`, `variables`, `bindings`, `capabilities`, `dependencies`, `provenance`, `extensions`, `layerDisplayNames`, prop semantics, UI locks | Sidecar (web localStorage) |

Trước save / compile / export: `expandAuthoringToCore(project, sugar)` — resolve bindings, layout → frame, prop keyframes → `layer.animations`, `appearance` → `opacity`, strip audit + sugar.

Schema core `.strict()` reject mọi field không thuộc core (kể cả `timeline`, `tokens`, `provenance`, …).

---

## 1. Timing and animation

Authoring core **không có** `project.timeline`.

1. `layer.timing.start` + `layer.timing.duration` là nguồn thời gian duy nhất.
2. Project length = `max(root.timing.start + root.timing.duration)` trên layer `parentLayerId === null`.
3. `layer.animations[]` là nơi duy nhất cho layer property animation trên core JSON.
4. Component prop keyframes: sugar trong session → **expand** thành `layer.animations[]` trước save (core không giữ `payload.props` keyframes).

Local time: `animations[].keys[].t` ∈ `0 .. layer.timing.duration`.

Mỗi animation core: `{ property, keys }`. `property` unique trong một layer. Session editor có thể giữ `id`/`kind` tạm — bị strip khi normalize/save.

UI timeline (lanes, clips, playhead) là session-only.

---

## 2. Root key order (core)

1. `format`
2. `formatVersion`
3. `metadata`
4. `composition`
5. `layers`
6. `assets`
7. `components`

Không còn: `variables`, `bindings`, `tokens`, `capabilities`, `dependencies`, `provenance`, `extensions`.

### Metadata core

Chỉ ba field:

```json
"metadata": { "id": "p1", "name": "Demo", "locale": "vi-VN" }
```

`description`, `industry`, `tags`, `createdAt`, `updatedAt` → envelope `metadataExtras`.

### Ví dụ project tối giản

```json
{
  "format": "motion-project",
  "formatVersion": 1,
  "metadata": { "id": "p1", "name": "Demo", "locale": "vi-VN" },
  "composition": { "width": 1080, "height": 1920, "fps": 30 },
  "layers": []
}
```

---

## 3. Layer core

Visual layer giữ: `id`, `type`, `parentLayerId`, `zIndex`, `timing`, `frame`, `transform`, **`opacity`** (0..100, root), `compositing` (chỉ `blend-mode`, `mask`), `effects`, `payload`, `animations[]`.

Bỏ khỏi core: `appearance`, `visible`, `layout`, `layoutItem`, `inheritFlags`, `semantic`, `name` (display name → envelope).

Hide layer: `opacity: 0` (expand từ session `visible: false`).

---

## 4. Component core

Giữ: `id`, `version`, `integrity`, `props[]` (gồm **`name`**, `kind`, `default`, …), `variants[]` (gồm **`name`**, `props`), `propBindings`, `layers`.

`props[].semantic` → envelope.

---

## 5. Layer array order

1. `zIndex` giảm dần
2. `timing.start` tăng dần
3. `id` tăng dần

---

## 6. Ranh giới trách nhiệm

- **Session store** giữ core + envelope sugar (rich editing).
- **Prune + reorder** ở serialization boundary sau `expandAuthoringToCore`.
- JSON panel hiển thị **expanded core** (strict round-trip).
- Hash / canonical flow chỉ trên core.

---

## 7. Định nghĩa xong

- Core JSON không có sugar / audit.
- Metadata = id + name + locale.
- Opacity ở layer root; không `appearance` wrapper.
- Animation một cửa trên `layer.animations[]`.
- Project length derived; runtime IR vẫn có `timeline.duration` sau compile.
