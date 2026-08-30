# Bức tranh toàn cảnh Neonix

## Phạm vi của tài liệu này

Đây là bản đồ kiến trúc cấp hệ thống của Neonix. Tài liệu này chỉ dùng để
thảo luận và thống nhất:

- các tầng và luồng dữ liệu;
- ranh giới trách nhiệm giữa các thành phần;
- các nguyên tắc bất biến của hệ thống;
- các quyết định giúp kiến trúc đơn giản và nhất quán.

Tài liệu này không mô tả code, API cụ thể, câu lệnh chạy, cấu hình deploy,
chi tiết database, test implementation, tối ưu hiệu năng hoặc kế hoạch thực
thi. Những nội dung đó chỉ được viết sau khi bản đồ kiến trúc đã được thống
nhất.

Neonix là một hệ thống tạo, chỉnh sửa và render video. Toàn bộ đường đi của
một project được rút gọn thành:

> **Author → Protocol → Compile → Runtime → Render**

```text
                    ┌─────────────────────┐
                    │       USER / AI     │
                    └──────────┬──────────┘
                               │
                 tạo / sửa / điều khiển video
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
              ▼                ▼                 ▼
           Editor             MCP             AI Agent
              │                │                 │
              └────────────────┼─────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ MotionProtocolV2    │
                    │   Project JSON      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      COMPILER       │
                    │      V2 → V3        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   RuntimeProjectV3  │
                    └──────────┬──────────┘
                               │
                    Runtime outputs
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
             ┌──────────────┐      ┌──────────────┐
             │   PLAYBACK   │      │    EXPORT    │
             │              │      │   Renderer   │
             └──────┬───────┘      └──────┬───────┘
                    │                     │
                    ▼                     ▼
             ┌──────────────┐        Native
             │    PREVIEW   │        Renderer
             │   Renderer   │           │
             └──────┬───────┘           ▼
                    │                 FFmpeg
                 WebGPU/                │
                 WebGL2                 ▼
                    │                  MP4
                    └──────────┬────────┘
                               ▼
                              USER
```

## Luồng Media Ingest và Audio

Media Ingest là luồng chuẩn bị asset nằm trước authoring và chạy xuyên qua
Protocol, Compiler, Runtime đến Render. Đây không phải là một tầng semantics
mới: nó chỉ biến file upload thành resource và metadata mà các tầng sau có thể
tham chiếu ổn định.

```text
USER
  │
  │ upload MP4
  ▼
WEB APP
  │
  ├── lưu original video asset
  └── tạo media preparation job
  │
  ▼
MEDIA INGEST WORKER
  │
  ├── ffprobe
  │     └── duration, fps, dimensions, streams, codec, audio metadata
  │
  ├── video source
  │     └── dùng để đọc frame hình ảnh
  │
  └── audio derivative
        └── dùng cho audio timeline và mixing
  │
  ▼
ASSET CATALOG
  │
  │ asset đã probe và sẵn sàng
  ▼
MotionProtocolV2
  │
  │ video.payload.audio + video timing/trim
  ▼
Compiler
  │
  ├── Visual Video Layer
  └── Audio Clip / Audio Timeline
  │
  ▼
RuntimeProjectV3
  │
  ├── PaintCommandBuffer
  └── AudioMixPlanV3
  │
  ├── Preview Renderer + Audio Backend
  └── Export Renderer + FFmpeg
```

### Ranh giới của Media Ingest

1. Web API nhận upload, xác thực quyền sở hữu và lưu original asset.
2. Media Ingest Worker dùng `ffprobe` để đọc metadata thực tế của file.
3. Nếu video có audio, Worker tạo một audio-only derivative có thể seek và
   ghi nhận derivative đó vào asset catalog.
4. Original MP4 không cần bị ghi đè hoặc tách thành các ảnh PNG.
5. Preview và Export dùng video source cho hình ảnh; audio derivative là nguồn
   audio riêng.
6. Nếu audio derivative chưa sẵn sàng, asset chưa được coi là sẵn sàng cho
   audio render.

### Audio đi qua các tầng

```text
video.payload.audio
  → authoring audio controls
  → Compiler tạo audio clip độc lập
  → Runtime tạo AudioMixPlanV3
  → Audio Backend / FFmpeg decode và mix
  → MP4 mux audio + video
```

`video.payload.audio` mô tả ý định audio của video layer: bật/tắt, gain,
pan và fade. Timing và trim mặc định lấy từ video layer; Compiler chuyển các
giá trị đó thành timing/trim của audio clip runtime. Vì vậy video và audio
được tách để xử lý, nhưng vẫn giữ cùng một timeline authoring.

Chi tiết về upload và R2 orchestration nằm trong `apps/web/lib/server/r2.ts`.
Chi tiết về probe, derivative và media worker nằm trong
[`export-renderer README`](packages/export-renderer/README.md). Chi tiết về
audio contract nằm trong [`motion-protocol README`](packages/motion-protocol/README.md).

## Năm tầng cốt lõi

### 1. Author

#### Vai trò

Editor, MCP và AI Agent tạo hoặc thay đổi authoring intent của người dùng.

#### Luồng dữ liệu

```text
USER / AI
    │
    │ authoring intent
    ▼
┌─────────────────────────┐
│          AUTHOR         │
│                         │
│  Create project         │
│  Edit project           │
│  Control project        │
└────────────┬────────────┘
             │
             ▼
          Protocol
```

#### Trách nhiệm

1. Tiếp nhận ý định tạo video từ người dùng hoặc AI.
2. Tạo và chỉnh sửa project theo ý định đó.
3. Chuyển authoring intent vào Protocol.

#### Điểm bàn giao

Author bàn giao authoring intent cho Protocol.

### 2. Protocol

#### Vai trò

Protocol chuẩn hóa authoring intent thành một project hợp lệ và canonical.

#### Luồng dữ liệu

```text
                 USER / AI / EDITOR / MCP
                           │
                           │ authoring intent
                           ▼
                 ┌─────────────────────────┐
                 │      PROTOCOL GATE      │
                 │                         │
                 │  Parse                  │
                 │  Migrate → V2           │
                 │  Validate               │
                 └────────────┬────────────┘
                              │
                              ▼
                    MotionProtocolV2
```

#### Trách nhiệm

Protocol cung cấp một JSON project canonical duy nhất. Với video có audio,
Protocol lưu cả liên kết audio của video layer và audio derivative metadata
trong asset; Protocol không chứa decoded audio hoặc frame data.

```text
MotionProtocolV2
├── format
├── formatVersion
├── id
├── composition
├── assets[]
├── layers[]
└── audio
```

JSON tối thiểu:

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "id": "project-001",
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "background": "#000000",
    "colorSpace": "srgb",
    "view": {
      "projection": {
        "kind": "orthographic",
        "zoom": 1,
        "near": 0.1,
        "far": 1000
      },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "assets": [],
  "layers": [],
  "audio": {
    "sampleRate": 48000,
    "tracks": []
  }
}
```

#### Điểm bàn giao

Protocol bàn giao `MotionProtocolV2` canonical cho Compiler. Chi tiết JSON
được mô tả trong [`motion-protocol README`](packages/motion-protocol/README.md).

### 3. Compiler

#### Vai trò

Compiler là điểm chuyển đổi duy nhất từ authoring model sang runtime model.

#### Luồng dữ liệu

```text
                    MotionProtocolV2
                    canonical project
                            │
                            ▼
                 ┌────────────────────────┐
                 │        COMPILER        │
                 │                        │
                 │  Check supported       │
                 │  features              │
                 │  Normalize data        │
                 │  Lower composition     │
                 │  Lower layers          │
                 │  Lower media           │
                 │  Lower audio           │
                 │  Build runtime         │
                 └───────────┬────────────┘
                             │
                             ▼
                         Runtime
```

#### Trách nhiệm

1. Kiểm tra feature trong project có được Compiler hỗ trợ hay không.
2. Chuẩn hóa các giá trị mặc định và semantics cần thiết cho runtime.
3. Hạ composition, layers, media và audio thành runtime model.
4. Phân loại descriptor semantic có thể tái sử dụng và state cần evaluate theo
   frame/time; không tạo GPU/CPU resource thật.
5. Tạo `RuntimeProjectV3` deterministic.
6. Trả diagnostic rõ ràng khi project chưa thể compile.

#### Điểm bàn giao

Compiler bàn giao `RuntimeProjectV3` cho Runtime. Embedded audio của video
layer trở thành một audio clip độc lập trong audio timeline.

Chi tiết trách nhiệm, luồng compile và capability được mô tả trong
[`motion-compiler README`](packages/motion-compiler/README.md).

### 4. Runtime

#### Vai trò

Runtime là nguồn semantics chung cho Preview và Export.

#### Luồng dữ liệu

```text
RuntimeProjectV3
        │
        │ evaluate(frame, time)
        ▼
┌──────────────────────────┐
│          RUNTIME         │
│                          │
│  Timeline evaluation     │
│  Hierarchy resolution    │
│  Matrix calculation      │
│  Opacity/compositing     │
│  Media-time resolution   │
│  Paint command creation  │
│  Audio mix plan creation │
└────────────┬─────────────┘
             │
             ├── PaintCommandBuffer
             └── AudioMixPlanV3
```

#### Trách nhiệm

Runtime thực hiện sáu công việc cốt lõi cho visual frame:

1. Evaluate timeline theo `frame` hoặc `time`.
2. Resolve hierarchy và thứ tự layer.
3. Tính matrix transform từ local space đến composition space.
4. Resolve opacity và compositing/isolation của layer hoặc group.
5. Resolve media time cho video và media đang hiển thị tại thời điểm đó.
6. Tạo `PaintCommandBuffer` backend-neutral cho Preview và Export.

Song song với visual evaluation, Runtime tạo `AudioMixPlanV3` cho khoảng
sample được yêu cầu để audio pipeline có thể mix đúng timeline.

Audio plan giữ các đặc tính đã được Compiler hạ xuống: source derivative,
composition range, source trim, playback rate, enabled/mute, gain, pan và fade
envelope. Runtime không decode audio và không tạo audio device.

#### Điểm bàn giao

Runtime bàn giao `PaintCommandBuffer` và `AudioMixPlanV3` cho Playback & Render.

Chi tiết trách nhiệm, boundary và output contract được mô tả trong
[`motion-runtime README`](packages/motion-runtime/README.md).

### 5. Playback & Render

Playback và Render là các lớp tiêu thụ output của Runtime. Chúng không tạo
semantics mới cho project; chúng điều phối thời gian, vẽ frame hoặc đóng frame
và audio thành media cuối cùng.

Playback chỉ tồn tại trong Editor để phục vụ thao tác realtime của người dùng.
`docs/preview` và Export Renderer không đi qua Playback; chúng gọi Runtime với
`frame/time` xác định để kiểm chứng hoặc render deterministically.

#### 5.1 Playback

##### Vai trò

Playback điều phối việc phát lại project trong Editor và kết nối clock của
người dùng với Runtime.

##### Luồng dữ liệu

```text
USER / EDITOR CONTROLS
        │
        │ play / pause / seek / loop / speed
        ▼
┌─────────────────────────┐
│        PLAYBACK         │
│                         │
│  Playback state         │
│  Playback clock         │
│  Playhead position      │
│  Frame/time mapping     │
│  Seek / loop control    │
│  Buffer / resource load │
└────────────┬────────────┘
             │
             ├── evaluate(frame/time)
             ▼
      RuntimeProjectV3
             │
             ├── PaintCommandBuffer
             │         ▼
             │   Preview Renderer
             │         ▼
             │      Canvas
             │
             └── AudioMixPlanV3
                       ▼
                Audio Playback Backend
                       ▼
                    Speakers
```

##### Trách nhiệm

1. Quản lý trạng thái phát lại: `idle`, `playing`, `paused`, `seeking` và
   `ended`.
2. Duy trì playback clock realtime và tiến playhead theo tốc độ phát.
3. Quản lý vị trí playhead theo cả composition seconds và frame number.
4. Xử lý play, pause, stop, seek, loop, in/out range và playback speed.
5. Chuyển đổi clock thành `frame/time` hợp lệ trước mỗi lần yêu cầu Runtime.
6. Yêu cầu Runtime đánh giá `RuntimeProjectV3` tại frame/time hiện tại.
7. Chuyển `PaintCommandBuffer` tới Preview Renderer để vẽ lên Canvas.
8. Chuyển `AudioMixPlanV3` tới Audio Playback Backend để phát qua Speakers.
9. Điều phối tải, seek, readiness, buffering và cache các media resource cần
   cho realtime playback.
10. Phát sự kiện trạng thái, xử lý lỗi và điều chỉnh việc request frame khi
    realtime bị trễ; không thay đổi semantics của Runtime.

##### Điểm bàn giao

Playback bàn giao `PaintCommandBuffer` cho Preview Renderer và
`AudioMixPlanV3` cho Audio Playback Backend.

Playback chỉ quản lý transport và realtime delivery. Timeline semantics,
layer timing, video trim, audio gain/fade/pan và media-time mapping vẫn thuộc
Protocol, Compiler và Runtime tương ứng.

Playback không phải là một bước trong visual test của `docs/preview` và không
được cung cấp frame hoặc audio cho Export Renderer.

#### 5.2 Preview Renderer

##### Vai trò

Preview Renderer vẽ realtime trạng thái do Runtime trả về trong Editor.

##### Luồng dữ liệu

```text
RuntimeProjectV3
        │
        │ evaluate(frame/time)
        ▼
PaintCommandBuffer
        │
        ▼
┌─────────────────────────┐
│    PREVIEW RENDERER     │
│                         │
│  Chọn backend            │
│  Quản lý canvas/context  │
│  Quản lý GPU resources   │
│  Replay paint commands   │
│  Render media            │
│  Resize / device scale   │
│  Diagnostic / lifecycle  │
└────────────┬────────────┘
             │
             ├── WebGPU API → GPU → Canvas
             └── WebGL2 API → GPU → Canvas
```

##### Trách nhiệm

1. Nhận `PaintCommandBuffer` từ Runtime.
2. Chọn WebGPU hoặc WebGL2 theo khả năng của browser.
3. Tạo và quản lý canvas, context, buffers, textures, surfaces và GPU
   resources.
4. Replay command theo đúng thứ tự layer, transform, opacity và compositing.
5. Upload và vẽ image, video frame, path, text hoặc shape.
6. Quản lý resize, pixel ratio, canvas lifecycle và resource disposal.
7. Trả diagnostic khi backend hoặc capability chưa được hỗ trợ.
8. Vẽ kết quả thật lên Canvas để Editor hoặc `docs/preview` quan sát, chụp ảnh
   và so sánh parity.

Preview Renderer không tự đánh giá timeline, không compile Protocol và không
tạo semantics thay Runtime. WebGPU và WebGL2 chỉ là hai backend thực thi cùng
một `PaintCommandBuffer`.

##### Điểm bàn giao

Preview Renderer bàn giao hình ảnh realtime cho User trong Editor.

Chi tiết về backend WebGPU/WebGL2, GPU resources và lifecycle được mô tả trong
[`preview-renderer README`](packages/preview-renderer/README.md).

#### 5.3 Export Renderer

##### Vai trò

Export Renderer render project offline bằng native backend và tạo output video.

##### Luồng dữ liệu

```text
RuntimeProjectV3
        │
        ├── static semantic descriptors
        └── dynamic frame state
        │
        ▼
┌────────────────────────────────┐
│       EXPORT RENDERER WORKER   │
│                                │
│  Preflight / capability check  │
│  Export session                │
│  Render scheduler              │
│  Resource and render cache     │
│  Native rendering              │
│  Audio pipeline                │
│  Progress / metrics            │
└───────────────┬────────────────┘
                │
                ├── evaluate(frame/time) → PaintCommandBuffer
                │         │
                │         ▼
                │   Static cache / Dynamic pass / Media pass
                │         │
                │         ▼
                │     Compositor → RGBA frame buffer
                │
                └── resolve audio → AudioMixPlanV3
                          │
                          ▼
                   Offline Audio Backend
                │
                ▼
              FFmpeg encode / mux
                │
                ▼
              MP4 artifact
```

##### Trách nhiệm

1. Nhận export job và `RuntimeProjectV3` đã được Compiler tạo.
2. Kiểm tra preset, capability, media resource và fail rõ ràng khi chưa thể
   export đúng semantics.
3. Tạo export session cố định theo resolution, FPS, duration và quality.
4. Nhận static semantic descriptors và dynamic frame state từ Runtime; không
   parse Protocol JSON hoặc dựng lại scene/DOM ở từng frame.
5. Sở hữu Render Scheduler, resource cache và render cache; GPU texture,
   tessellation, glyph atlas hoặc decoded media frame không thuộc Runtime.
6. Duyệt toàn bộ frame deterministically theo composition FPS và duration.
7. Replay `PaintCommandBuffer` bằng native renderer, điều phối static cache,
   dynamic pass, media pass và compositing để tạo RGBA frame buffer.
8. Đọc video/image/font resources khi cần và đồng bộ đúng media time Runtime
   đã resolve.
9. Đọc audio derivative, xử lý `AudioMixPlanV3` và đồng bộ audio với video.
10. Gửi RGBA frame buffer và mixed audio cho FFmpeg để encode/mux MP4.
11. Ghi progress, thời gian, diagnostics, artifact metadata và render metrics
    cho Web API.

Export Renderer không sử dụng clock, frame buffer hoặc audio playback state của
Playback.

Compiler có thể phân loại dữ liệu static và dynamic, nhưng chỉ Renderer được
phép biến static descriptor thành GPU/CPU resource thật. Cache chỉ tái sử dụng
công việc không đổi; nó không được chứa hoặc thay đổi timeline semantics.

Trong luồng export, audio nhúng trong original MP4 bị vô hiệu hóa ở đầu vào
video. Audio được decode từ derivative, mix theo `AudioMixPlanV3`, sau đó
FFmpeg mux video stream và audio stream thành MP4 cuối cùng.

FFmpeg là media backend: nhận RGBA frame buffer và mixed audio để encode/mux.
Nó không sở hữu Matrix4, hierarchy, timing, compositing, mask, effects hay
quy tắc render của Neonix.

##### Điểm bàn giao

Export Renderer bàn giao MP4, artifact metadata và render metrics cho Web API.

Chi tiết pipeline native, audio separation và ranh giới FFmpeg được mô tả
trong [`export-renderer README`](packages/export-renderer/README.md).

## Quy tắc đơn giản hóa kiến trúc

1. Một project chỉ có một Protocol authoring format.
2. Một compiler là nguồn chuyển đổi duy nhất từ V2 sang V3.
3. Một RuntimeProjectV3 là nguồn semantics duy nhất cho preview và export.
4. Preview và export chỉ khác backend render, không khác logic timeline.
5. Native VPS export là đường export chính; không có adapter bên thứ ba trong
   đường chính.
6. FFmpeg chỉ encode media; không được trở thành nơi chứa semantics của Neonix.
7. Web API quản lý authentication, ownership, job lifecycle và artifact
   metadata; export worker chỉ nhận runtime project, render và trả artifact.
8. Unsupported capability phải fail closed và trả diagnostic rõ ràng.
9. Tối ưu chỉ được thêm sau khi có test chứng minh output vẫn đúng hình ảnh.
10. Playback chỉ phục vụ Editor và không phải là nguồn frame/audio cho export.
11. `docs/preview` phải kiểm tra trực tiếp Runtime và Preview Renderer bằng
    frame/time xác định, không phụ thuộc clock realtime của Playback.

## Luồng dữ liệu chuẩn

```text
User / AI input
      ↓
Upload MP4 → Web App R2 orchestration → Media Ingest → Asset Catalog
      ↓
MotionProtocolV2
      ↓
Compiler
      ↓
RuntimeProjectV3
      └── Runtime evaluator
            ├── Editor Playback → Preview Renderer → WebGPU/WebGL2 → user preview
            ├── docs/preview → Preview Renderer → visual test output
            └── Export Renderer → Native frames + audio mix → FFmpeg → MP4 → user download
```

## Ranh giới trách nhiệm

| Thành phần              | Trách nhiệm chính                             |
| ----------------------- | --------------------------------------------- |
| Editor / MCP / AI Agent | Tạo và sửa authoring intent                   |
| MotionProtocolV2        | Project JSON contract                         |
| Compiler                | Hạ V2 thành RuntimeProjectV3                  |
| Motion Runtime          | Evaluate frame/time và tạo visual/audio plans |
| Playback                | Điều phối clock, controls và phát lại          |
| Preview Renderer        | Render realtime trong browser                 |
| Export Renderer         | Render offline native trên VPS                |
| FFmpeg                  | Encode frame/audio thành MP4                  |
| Web API                 | Auth, ownership, job state, artifact metadata |
| Web App storage         | Điều phối R2, upload, signed URL và metadata |
| Media Ingest Worker     | Probe media và tạo audio derivative           |

## Tiêu chuẩn quyết định

Khi thêm một capability mới, kiểm tra theo thứ tự:

```text
Protocol
  → Compiler
  → Runtime evaluator
  → Preview
  → Native export
  → parity test
```

Nếu capability chưa được hỗ trợ ở native export, export phải báo lỗi rõ ràng;
không được âm thầm tạo một video sai semantics.

## Kết luận ngắn gọn

- Editor/MCP/AI Agent trả lời: **người dùng muốn tạo hoặc thay đổi project như thế nào?**
- Protocol trả lời: **ý định đó được biểu diễn thành project canonical nào?**
- Compiler trả lời: **project này có thể chạy như thế nào?**
- Runtime trả lời: **ở frame/time này, project đang ở trạng thái nào?**
- Renderer trả lời: **dùng công nghệ nào để vẽ trạng thái đó?**
- FFmpeg trả lời: **đóng các frame/audio thành MP4 như thế nào?**
