# MotiClip V1 Timeline

Module protocol tại `packages/motion-protocol/src/v1/timeline/`.

Timeline là **đồng hồ (clock) và source of truth** cho độ dài MP4, thứ tự phát scene, audio và caption. Mọi consumer (compiler, runtime, render-worker) phải đọc timing từ timeline — không tự dựng lại bằng cursor hay fallback từ `project.scenes`.

---

## 1. Timeline là gì?

Timeline V1 mô tả **khi nào** nội dung xuất hiện trên trục thời gian toàn cục (giây, bắt đầu từ `0`), không mô tả **cây node bên trong scene**.

| Khái niệm              | Vai trò                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `timeline.duration`    | Độ dài MP4 cuối cùng (giây) — clock / source of truth                   |
| `visualTracks`         | Lane hình ảnh (AE layer stack); `order >= 0` sparse, unique toàn timeline |
| `audioTracks`          | Lane âm thanh với `clips[]` + fadeIn/fadeOut; `order < 0` sparse, unique  |
| `captionTracks`        | Lane phụ đề                                                             |
| `workArea` / `markers` | Optional project helpers (vùng làm việc / mốc); vẫn phải nằm trong `duration` |

```mermaid
flowchart TB
    subgraph Project["MotionProjectV1"]
        scenes["scenes[] — nội dung đồ họa"]
        components["components[] — sealed units"]
        assets["assets[] — media"]
        timeline["timeline — đồng hồ phát"]
    end

    subgraph Timeline["ProjectTimelineV1"]
        duration["duration — độ dài MP4"]
        VT["visualTracks"]
        AT["audioTracks[].clips"]
        CT["captionTracks"]
    end

    scenes -.->|"source.scene"| VT
    assets -.->|"clip.assetId"| AT
    Project --> Timeline
    Timeline --> duration
    Timeline --> VT
    Timeline --> AT
    Timeline --> CT
```

### Tại sao timeline phải là source of truth?

| Vấn đề cũ                                                         | Giải pháp V1                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Compiler tự xếp scene theo declaration order khi thiếu visual clip | Hard error `CMP_TIMELINE_VISUAL_EMPTY` — không silent fallback             |
| Duration MP4 suy từ clip cuối, bỏ empty tail                      | `timeline.duration` tường minh (canonical)                                |
| `start` bị rebuild bằng cursor → mất gap thật | `clip.start` / audio clip `start` là **absolute global time** |
| Schema đúng nhưng render sai (audio kéo theo asset)               | Audio/visual timing theo track/clip; asset chỉ phục vụ trim/loop          |
| Float lệch frame (`1.001` @ `1fps`) → MP4 lệch 1 frame            | Frame-grid: snap + validate theo `composition.fps`                        |

---

## 2. Cấu trúc một Timeline

Mỗi project có đúng một `timeline`:

```jsonc
{
  "timeline": {
    // ═══ Clock ═══
    "duration": 10, // optional lúc authoring; bắt buộc ở canonical/export

    // ═══ Optional project helpers (not UI session) ═══
    "workArea": { "start": 0, "end": 8 },
    "markers": [{ "id": "beat-1", "t": 2.5 /* ... */ }],

    // ═══ Nội dung phát ═══
    "visualTracks": [
      /* VisualTrackV1[] */
    ],
    "audioTracks": [
      /* AudioTrackV1[] — default [] */
    ],
    "captionTracks": [
      /* CaptionTrackV1[] — default [] */
    ],
  },
}
```

> **Source layout**: Schema/utilities nằm tại `packages/motion-protocol/src/v1/timeline/` (`schema.ts`, `duration.ts`, `canonicalize.ts`, `validation.ts`, `frame-grid.ts`, `index.ts`). Import qua `./timeline` hoặc public export của `@motionvideo/motion-protocol`.

---

## 3. Khái niệm cốt lõi

### 3.1 Absolute global time

`start` trên visual clip / audio track là thời điểm **tuyệt đối** trên trục project (giây), **không** phải offset tương đối so với phần tử trước.

```
0s -------- 2s -------- 5s -------- 8s -------- 10s
|--- clip A ---|         |--- clip B ---|        |
                         ^ start = 5 (tuyệt đối)
                                      duration=10 (empty tail 8→10)
```

Compiler / runtime / render **không** được tái dựng `start` bằng cursor. Gap giữa clip là hợp lệ; empty tail (`duration` > content end) cũng hợp lệ.

### 3.2 Visual clip source

`VisualClipSourceV1` chỉ cho phép `{ kind: "scene", sceneId }`.

Component **không** là visual-clip source. Đặt component như **scene layer** (`type: "component"`) bên trong scene, rồi clip timeline tham chiếu scene đó. Compiler expand component layer → wrapper group.

`kind: "node"` / `kind: "component"` trên timeline = không hợp lệ. Canonical parse **reject** — không rewrite.

UI có thể gọi track `order === 0` là “main” và track cao hơn là “overlay” — **đó không phải field JSON**.

### 3.2b Track order (sparse)

Track `order` is a **sparse integer ordering key**.

- Audio tracks must use **negative** order values (`order < 0`).
- Visual tracks must use **zero or positive** order values (`order >= 0`).
- All track order values in one project must be **unique** (visual + audio share one namespace).
- Order values **do not need to be contiguous**. Valid: `-20, -10, 0, 10, 20`.
- Lower order is earlier/lower in the global timeline ordering.
- **Nuance:** “lower order renders under” applies to **visual** only. For audio, lower order is deterministic listing/mix ordering — not a render stack.

### 3.3 Visual track = AE layer stack

| Field | Rule |
| --- | --- |
| `id` | Unique track id |
| `order` | Sparse `>= 0`; unique across all timeline tracks; thấp render dưới, cao trên |
| `muted` | Optional |
| `clips` | Occupancy theo thời gian |

**Lane exclusive (visual):** trong cùng track, clips **không** overlap. Gap là gap thật. Khác track được trùng thời gian.

**Không** có `role`, `transitionIn` / `transitionOut`, boundary, hay suy luận effect từ khoảng cách giữa clips.

Tại thời điểm `t`:

```
active = clips where start <= t < start + duration
sort by track.order ascending
render low → high
```

Nếu không có layer nào active → empty (background/transparent theo export setting).

### 3.3b Audio ≠ visual

Audio giữ DSP playback primitives trên **clip**:

```ts
audioTracks: Array<{
  id: string;
  order: number; // required; must be < 0; unique across timeline
  muted?: boolean;
  clips: Array<{
    id: string;
    assetId: string;
    start: number;
    duration: number;
    volume?: number;   // default 1
    fadeIn?: number;   // default 0 — 0→volume ở đầu clip
    fadeOut?: number;  // default 0 — volume→0 ở cuối clip
    // trimStart, playbackRate, loop, muted…
  }>;
}>;
```

- `fadeIn + fadeOut ≤ duration`.
- Same-track audio **được overlap** (mix). Không suy luận crossfade giữa hai clip.
- Muốn “crossfade”: overlap thời gian + `fadeOut` / `fadeIn` trên từng clip (thường hai lane).

### 3.3c Duplicate = editor command

JSON **không** mô tả operation duplicate. Editor tạo clip/node mới (`id` mới), chọn lane/zIndex hợp lệ, rồi ghi state sạch. Chi tiết command: [v1-format-guide.md §14.1](v1-format-guide.md).

### 3.4 Composition window vs media local time

Với visual clip:

- **Cửa sổ phát (composition)**: clip active khi `globalTime ∈ [start, start + duration)`.
- **Đồng hồ scene (media local)**:  
  `effectiveLocalTime = trimStart + (globalTime - start) * playbackRate`  
  (có rule `loop` qua `resolveMediaTiming`).

Opacity / transform của layer đánh giá theo **media local time** bên trong scene. Timeline không ramp effect giữa clips.

### 3.5 Empty timeline

Không có visual clip → **compile fail** (`CMP_TIMELINE_VISUAL_EMPTY`). Không dựng lại timeline từ `project.scenes`.

---

## 4. Thiết kế từng schema

### 4.1 Không còn effect primitive trên timeline

Timeline **không** có `transitionIn` / `transitionOut` / crossfade. Hiệu ứng = layer/component animation trong scene.

### 4.2 `VisualClipV1Schema`

```jsonc
{
  "id": "clip-intro",
  "source": { "kind": "scene", "sceneId": "intro" },
  "start": 0, // absolute global time
  "duration": 5,
  "trimStart": 0.5,
  "playbackRate": 1,
  "loop": false,
  "opacity": 1
}
```

Thiết kế:

- `.strict()` — từ chối field lạ (`role`, `transitionIn`, `source.kind: "component"`, …).
- `superRefine` bắt `playbackRate > 0`.
- Timing media (`trimStart` / `playbackRate` / `loop`) **không** đổi cửa sổ active; chỉ đổi local time khi evaluate.

### 4.3 `VisualTrackV1Schema`

```jsonc
{
  "id": "visual-0",
  "order": 0, // sparse >= 0; unique across timeline
  "muted": false,
  "clips": [
    /* tối thiểu 1 clip */
  ]
}
```

Track rỗng không hợp lệ ở schema track (`clips.min(1)`). Timeline có thể có `visualTracks: []` lúc draft — nhưng compile sẽ fail nếu không có clip nào.

### 4.4 `AudioTrackV1Schema`

```jsonc
{
  "id": "audio--1",
  "order": -1, // required; sparse < 0; unique across timeline
  "muted": false,
  "clips": [
    {
      "id": "clip.bgm",
      "assetId": "asset.bgm",
      "start": 1,
      "duration": 3,
      "trimStart": 0.5,
      "volume": 0.8,
      "fadeIn": 0.5,
      "fadeOut": 1,
      "loop": false,
      "muted": false,
      "playbackRate": 1
    }
  ]
}
```

Audio `fadeIn`/`fadeOut` là DSP trên chính clip (`fadeIn + fadeOut ≤ duration`). Không suy luận crossfade giữa clips.

Thiết kế:

- Clip `duration` là **source of truth** cho cửa sổ phát trong composition.
- Asset length chỉ phục vụ trim/loop — `buildAudioRenderPlan` không kéo dài hơn clip.duration.
- Track/clip `muted` → envelope volume 0 (vẫn giữ timing).
- `fadeIn + fadeOut ≤ duration`; `trimEnd ≤ duration`.

### 4.5 `ProjectTimelineV1Schema` vs canonical

| Schema                              | `duration`     | Dùng khi                         |
| ----------------------------------- | -------------- | -------------------------------- |
| `ProjectTimelineV1Schema`           | optional       | Authoring / parse draft          |
| `CanonicalProjectTimelineV1Schema`  | **bắt buộc**   | Export / save / biên canonical   |

Khi `duration` đã khai báo, `superRefine` kiểm tra mọi clip/audio/caption/workArea/marker **không vượt** `duration`.

Ngoài ra, `CanonicalMotionProjectV1Schema` (ở `project.ts`) còn reject timing **lệch frame-grid** theo `composition.fps`.

---

## 5. Các module logic trong thư mục

```
packages/motion-protocol/src/v1/timeline/
  index.ts          — barrel export
  schema.ts         — Zod schemas + types
  duration.ts       — derive duration từ content ends
  canonicalize.ts   — điền duration + snap frame-grid
  validation.ts     — integrity (unique order, lane exclusive, clip ids)
  frame-grid.ts     — snap / isOnGrid / collectFrameGridIssues
```

Tài liệu timeline: `docs/guide/v1-timeline-guide.md` (file này).

### 5.1 Derive duration — `duration.ts`

```
derivedDuration = max(
  visual:  max(clip.start + clip.duration),
  audio:   max(track.start + track.duration),
  caption: max(token.end),
)
```

Không có nội dung → `0`. Giá trị được `roundTimelineValue` (làm tròn nanosecond) để giảm nhiễu float.

| Trường hợp                         | Kết quả                                              |
| ---------------------------------- | ---------------------------------------------------- |
| Thiếu `duration`                   | Canonicalize điền = `derivedDuration` (đã snap)      |
| `duration` > derived               | Hợp lệ — **empty tail**                              |
| `duration` < derived               | Lỗi validation biên timeline                         |
| Derived = `0`                      | Export MP4 bị chặn (blank video)                     |

### 5.2 Integrity — `validation.ts`

`collectTimelineIntegrityIssues(timeline)`:

1. **Duplicate visual clip id** / **duplicate audio clip id**.
2. **Unique track `order`** across visual + audio — reject trùng order.
3. **Visual lane exclusive** trên mọi track — overlap cùng track → reject.
4. Audio overlap trong cùng track **được phép** (mix).

### 5.3 Frame-grid — `frame-grid.ts`

Policy (half-up):

```
frames = Math.round(seconds * fps)
canonicalSeconds = frames / fps
onGrid ⇔ |seconds * fps - round(seconds * fps)| ≤ 1e-9
```

Áp dụng cho: `duration`, clip `start`/`duration`/`trimStart`, audio timing, caption `start`/`end`, workArea, markers.

Ví dụ: `fps = 1`, `1.001` → snap thành `1`; canonical schema reject nếu vẫn còn `1.001`.

### 5.4 Canonicalize — `canonicalize.ts`

`canonicalizeTimelineDurationV1(project)` — **không mutate** input:

```mermaid
flowchart LR
  A["Deep clone project"] --> B["Snap timing lên composition.fps"]
  B --> C{"duration đã có?"}
  C -->|Không| D["Derive từ content đã snap"]
  D --> E["Snap duration"]
  C -->|Có| F["Giữ duration đã snap"]
  E --> G["Trả project + issues info"]
  F --> G
```

Compiler gọi bước này trước khi emit runtime IR, nên runtime luôn có `timeline.duration` on-grid.

---

## 6. Luồng end-to-end

```mermaid
flowchart TD
  author["Authoring JSON\n(duration optional, float gần grid)"]
  parse["MotionProjectV1Schema.parse\n+ integrity validation"]
  canon["canonicalizeTimelineDurationV1\nsnap + derive duration"]
  compile["compileMotionProjectV1\nvisualTracks → runtime\nCMP_TIMELINE_VISUAL_EMPTY nếu rỗng"]
  runtime["MotionRuntimeProject\nduration bắt buộc, on-grid"]
  preview["Preview / resolveTimelineAtTime\nempty tail → null"]
  export["Render-worker / audio plan\nframeCount = round(duration * fps)"]

  author --> parse --> canon --> compile --> runtime
  runtime --> preview
  runtime --> export
```

### 6.1 Compile visual

- Có visual clip → map từng clip (`start`, `trimStart`, `playbackRate`, `loop`) sang runtime theo `order`.
- Không có visual clip → **error**, không synthesize từ scenes.

### 6.2 Resolve timeline time

`resolveTimelineAtTime(runtime, timelineTime)` — contract dùng **`timelineTime` / `t`** (giây trên trục project), không dùng từ “playhead”.

- Active clips tại `timelineTime` xếp theo **`order` tăng dần** (thấp vẽ dưới, cao vẽ trên). Không ưu tiên label UI main/overlay.
- `timelineTime` trong empty tail hoặc `timelineTime ≥ duration` → `null` (không clamp scene cuối).

> **UI session ≠ project:** `playhead` / `currentTime` / `selection` / `zoom` / `scroll` chỉ thuộc editor UI session — **không** được nằm trong `MotionProjectV1`.

### 6.3 Audio render plan

`buildAudioRenderPlan`:

- `fromFrame = round(track.start * fps)`
- `durationInFrames = round(track.duration * fps)` ← SoT
- Không `min(remaining, assetDuration)` để kéo dài clip

### 6.4 Frame plan (MP4)

Sau canonicalize, `duration` đã on-grid →  
`frameCount = round(duration * fps)` khớp clock → độ dài file = `frameCount / fps`.

---

## 7. Ví dụ nhanh

### Authoring thiếu duration

```jsonc
{
  "composition": { "width": 1920, "height": 1080, "fps": 30 },
  "timeline": {
    "visualTracks": [
      {
        "id": "visual-0",
        "order": 0,
        "clips": [
          { "id": "c1", "source": { "kind": "scene", "sceneId": "intro" }, "start": 0, "duration": 5 },
          { "id": "c2", "source": { "kind": "scene", "sceneId": "outro" }, "start": 5, "duration": 3 }
        ]
      },
    ],
  },
}
```

Sau canonicalize → `timeline.duration = 8` (đã on-grid @ 30fps).

### Concurrent scenes = khác `order`

```jsonc
{
  "visualTracks": [
    {
      "id": "visual-0",
      "order": 0,
      "clips": [
        { "id": "a", "source": { "kind": "scene", "sceneId": "intro" }, "start": 0, "duration": 3 }
      ]
    },
    {
      "id": "visual-10",
      "order": 10,
      "clips": [
        { "id": "fx", "source": { "kind": "scene", "sceneId": "fx-scene" }, "start": 0, "duration": 3 }
      ]
    }
  ]
}
```

Cùng track + overlap thời gian → **reject** integrity. Scene `fx-scene` chứa component/layer animation — không phải timeline effect primitive.

### Empty tail

```jsonc
{
  "timeline": {
    "duration": 10, // content kết thúc 8s → 2s trống cuối
    "visualTracks": [
      /* clips end at 8s */
    ],
  },
}
```

`timelineTime = 9` → không có layer / `resolveTimelineAtTime` = `null`.

---

## 8. Checklist khi sửa timeline

1. Timing mới có nằm trên frame-grid sau canonicalize không?
2. `start` có absolute không — có đang rebuild bằng cursor không?
3. Cùng visual lane có overlap không? (phải reject — tách track `order`)
4. Scene trùng timing đã nằm khác `order` chưa? Visual `order` unique chưa?
5. Audio tôn trọng clip duration + fadeIn/fadeOut ≤ duration chưa?
6. Visual local time có đi qua trim/rate/loop không?
7. Empty visual clips có fail rõ ràng (không silent fallback) không?
8. Empty tail có trả “không scene” thay vì clamp scene cuối không?
9. Sibling layers có `zIndex` unique trong cùng `parentLayerId` không?

---

## 9. Tham chiếu

| Tài liệu / file                                      | Nội dung                          |
| ---------------------------------------------------- | --------------------------------- |
| [v1-format-guide.md](v1-format-guide.md) §3 | Timeline model trong format guide |
| [v1-component-guide.md](v1-component-guide.md) | Component definition / instance / props |
| `packages/motion-protocol/src/v1/timeline/schema.ts` | Zod schemas                       |
| `duration.ts` / `canonicalize.ts`                    | Derive + snap                     |
| `validation.ts` / `frame-grid.ts`                    | Integrity + frame-grid            |
