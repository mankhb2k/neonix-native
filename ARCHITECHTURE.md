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
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
             ┌──────────────┐      ┌──────────────┐
             │    PREVIEW   │      │    EXPORT    │
             │   Renderer   │      │    Engine    │
             └──────┬───────┘      └──────┬───────┘
                    │                     │
                 WebGPU/                 Native
                 WebGL2                 Renderer
                    │                     │
                    │                     ▼
                    │                  FFmpeg
                    │                     │
                    │                     ▼
                    │                    MP4
                    │                     │
                    └──────────┐   ┌──────┘
                               ▼   ▼
                              USER
```

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

Protocol cung cấp một JSON project canonical duy nhất:

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
4. Tạo `RuntimeProjectV3` deterministic.
5. Trả diagnostic rõ ràng khi project chưa thể compile.

#### Điểm bàn giao

Compiler bàn giao `RuntimeProjectV3` cho Runtime.

### 4. Runtime

#### Vai trò

Runtime là nguồn semantics chung cho Preview và Export.

#### Luồng dữ liệu

```text
                 RuntimeProjectV3
                         │
                         ▼
              ┌──────────────────────┐
              │        RUNTIME       │
              │                      │
              │  Evaluate timeline   │
              │  Resolve frame state │
              │  Create paint output │
              └──────────┬───────────┘
                         │
                         ▼
                  Paint commands
```

#### Trách nhiệm

1. Evaluate timeline theo frame hoặc time.
2. Tạo frame state từ `RuntimeProjectV3`.
3. Tạo paint commands cho backend Render.

#### Điểm bàn giao

Runtime bàn giao paint commands cho Render.

### 5. Render

#### Vai trò

Render chuyển runtime output thành preview hoặc media cuối cùng.

#### Luồng dữ liệu

```text
                  Paint commands
                         │
                         ▼
              ┌──────────────────────┐
              │        RENDER        │
              │                      │
              │  Preview backend     │
              │  Native export       │
              │  Media encoding      │
              └──────────┬───────────┘
                         │
                         ▼
                          User
```

#### Trách nhiệm

1. Render preview tương tác trong browser.
2. Render offline bằng native renderer trên VPS.
3. Chuyển frame và audio thành media cuối cùng.

#### Điểm bàn giao

Render bàn giao preview hoặc media cuối cùng cho User.

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

## Luồng dữ liệu chuẩn

```text
User / AI input
      ↓
MotionProtocolV2
      ↓
Compiler
      ↓
RuntimeProjectV3
      ├── Preview Renderer → WebGPU/WebGL2 → user preview
      └── Export Renderer  → Native frames → FFmpeg → MP4 → user download
```

## Ranh giới trách nhiệm

| Thành phần | Trách nhiệm chính |
| --- | --- |
| Editor / MCP / AI Agent | Tạo và sửa authoring intent |
| MotionProtocolV2 | Project JSON contract |
| Compiler | Hạ V2 thành RuntimeProjectV3 |
| Motion Runtime | Evaluate timeline và tạo paint commands |
| Preview Renderer | Render realtime trong browser |
| Export Renderer | Render offline native trên VPS |
| FFmpeg | Encode frame/audio thành MP4 |
| Web API | Auth, ownership, job state, artifact metadata |
| Storage | Lưu asset và export artifact |

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
