# MotionVideo Motion Format (`.mt`)

Định dạng dự án chính thức của MotionVideo. Đây **không** phải API nội bộ của một render engine — đây là **project format** (IR) của toàn bộ sản phẩm.

```text
Editor / AI / Template
        ↓
   Motion JSON (.mt)
        ↓
   Compiler
        ↓
   Renderer (tham chiếu / Motion Canvas / …)
        ↓
      MP4
```

## Tên & đuôi file

| | |
|---|---|
| Tên | MotionVideo Motion Format |
| Đuôi | `.mt` |
| MIME (gợi ý) | `application/vnd.motionvideo.mt+json` |
| Encoding | UTF-8 JSON |

Nội dung là JSON. Đuôi `.mt` chỉ gắn nghĩa sản phẩm (mở bằng MotionVideo / validate bằng schema).

## Version

Mỗi project có field bắt buộc:

```json
{ "version": 1, "id": "…", "brand": { "name": "…" }, "scenes": [ … ] }
```

- Hằng số: `MOTION_FORMAT_VERSION` trong `@motionvideo/motion-schema`
- Parse từ chối version không khớp (`MotionFormatVersionError`)
- Bump version khi thay đổi **cấu trúc** (breaking). Thêm preset mới **không** cần bump — preset là string + registry.

## Ai đọc / ghi

| Actor | Vai trò |
|---|---|
| Editor | Đọc/ghi `.mt` (localStorage / file) |
| AI Planner | Sinh / patch `.mt` (Zod validate) |
| Template library | Seed `.mt` + đăng ký preset |
| Compiler | `.mt` → instruction engine-agnostic |
| Renderer | Instruction → frames / video |

## Cấu trúc (v1)

```text
MotionProject
├── version          // literal 1
├── id
├── locale           // "vi-VN"
├── aspectRatio      // "9:16" | "16:9" | "1:1"
├── industry?
├── brand            // name, colors, logo, font
├── scenes[]
│   ├── id, role?, duration
│   └── layers[]
│       ├── id, type, content?, assetId?, x, y
│       └── animations[]
│           ├── preset     // string — registry quyết định có support không
│           ├── start, duration
│           ├── delay?, easing?
│           └── params?    // bag mở theo preset (chưa dùng MVP)
├── voiceoverUrl?
└── musicAssetId?
```

## Hai lớp validate

1. **Structural** (`@motionvideo/motion-schema`): Zod — shape đúng, version đúng, `preset` là string không rỗng.
2. **Semantic / product** (`@motionvideo/template-library`): `validateMotionProjectPresets` — mọi `preset` phải có trong block registry.

Thêm preset mới = thêm block trong `template-library`, **không** sửa contract schema.

## `params`

Field mở trên mỗi animation:

```json
{
  "preset": "camera-focus-target",
  "start": 0,
  "duration": 1,
  "params": { "targetLayerId": "hero-logo" }
}
```

Compiler / renderer diễn giải theo từng preset. Schema không liệt kê keys — tránh breaking change mỗi lần thêm knob.

## Liên quan

- Schema: [`packages/motion-schema`](../packages/motion-schema)
- Registry preset: [`packages/template-library/src/blocks`](../packages/template-library/src/blocks)
- Kế hoạch block: [`docs/blocks-plan.md`](./blocks-plan.md)
