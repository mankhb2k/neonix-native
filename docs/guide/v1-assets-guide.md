# NeonVideo V1 Assets

> Trạng thái: v1
>
> Mục tiêu: một contract duy nhất cho asset — external URL, managed R2, và quy tắc metadata bắt buộc.

---

## Khái niệm

`assets[]` là danh sách asset mà project tham chiếu. Một asset là **metadata về một tài nguyên media**
(image / svg / video / audio / font), không phải chính nội dung nhị phân.

Asset có **hai chế độ nguồn**, không trộn lẫn:

| Chế độ                   | `storage.managed`     | `uri`        | Cần thêm                     |
| ------------------------ | --------------------- | ------------ | ---------------------------- |
| **Unmanaged** (external) | `false` hoặc không có | **Bắt buộc** | metadata đủ để layout/render |
| **Managed** (R2)         | `true`                | **Cấm**      | `integrity` + `sizeBytes`    |

Layer **chỉ giữ `payload.assetId`**. Layer không bao giờ nhét URL hay object asset trực tiếp.

---

## Contract chốt

- External media MVP: `assets[].uri = "https://..."` (hoặc data URI / fixture path).
- Managed media: **không có `uri`** trong project JSON; có `integrity`, `sizeBytes`, `storage`.
- Compiler resolve managed asset qua `assetUrlResolver` lúc compile.
- `crop` **chỉ có ở image**. Video **cố ý không có** `crop`.
- URL tự nó **không đủ**. Muốn fit/crop/trim đúng, asset vẫn phải khai metadata:
  - image/svg → `width`, `height`
  - video → `width`, `height`, `duration`, `fps`
  - audio → `duration`

---

## Field base (chung mọi assetType)

| Field       | Bắt buộc        | Ý nghĩa                                                                       |
| ----------- | --------------- | ----------------------------------------------------------------------------- |
| `id`        | ✔               | Định danh asset trong project; layer tham chiếu bằng `assetId`                |
| `assetType` | ✔               | `image` \| `svg` \| `video` \| `audio` \| `font`                              |
| `mimeType`  | ✔               | MIME theo từng loại                                                           |
| `uri`       | tùy theo chế độ | External URL / data URI / fixture path. **Cấm khi managed**                   |
| `integrity` | ✔ khi managed   | `sha256:...`                                                                  |
| `sizeBytes` | ✔ khi managed   | Kích thước bytes                                                              |
| `storage`   | tùy chọn        | `{ managed: true, provider: "r2", key, retention }` hoặc `{ managed: false }` |
| `source`    | tùy chọn        | Metadata ingest, chỉ `{ kind: "upload" }`                                     |
| `name`      | tùy chọn        | Tên hiển thị                                                                  |

---

## Quy tắc storage (superRefine)

| Điều kiện                                  | Rule                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `storage.managed === true`                 | cấm `uri`; **bắt buộc** `integrity` + `sizeBytes` |
| `storage.managed !== true` (hoặc không có) | **bắt buộc** `uri`                                |

`source.kind` chỉ nhận giá trị `"upload"` — đây là metadata ingest, **không phải chỗ nhét URL**.

---

## 4 ví dụ canonical

### 1. Image external URL (unmanaged)

```json
{
  "id": "poster",
  "uri": "https://cdn.example.com/poster.webp",
  "assetType": "image",
  "mimeType": "image/webp",
  "width": 1920,
  "height": 1080
}
```

Hợp lệ vì đủ `width` + `height` và có `uri`.

### 2. Video external URL (unmanaged)

```json
{
  "id": "intro",
  "uri": "https://cdn.example.com/intro.mp4",
  "assetType": "video",
  "mimeType": "video/mp4",
  "width": 1920,
  "height": 1080,
  "duration": 8.5,
  "fps": 30
}
```

Hợp lệ vì đủ `width`, `height`, `duration`, `fps` và có `uri`.

### 3. Managed R2 (không uri)

```json
{
  "id": "logo",
  "assetType": "image",
  "mimeType": "image/png",
  "width": 100,
  "height": 100,
  "integrity": "sha256:abc123",
  "sizeBytes": 2048,
  "storage": {
    "managed": true,
    "provider": "r2",
    "key": "tmp/logo.png",
    "retention": "temporary"
  },
  "source": { "kind": "upload", "originalName": "logo.png" }
}
```

Không có `uri`. Compiler gọi `assetUrlResolver("logo")` để lấy signed URL lúc compile.

### 4. Invalid metadata (bị reject)

```json
{
  "id": "intro",
  "uri": "https://cdn.example.com/intro.mp4",
  "assetType": "video",
  "mimeType": "video/mp4",
  "width": 1920,
  "height": 1080
}
```

Bị reject vì video **thiếu `duration` / `fps`**. URL tự nó không đủ để trim/fit đúng.

---

## Metadata bắt buộc theo assetType

| `assetType` | `mimeType`                                                | Bắt buộc                             |
| ----------- | --------------------------------------------------------- | ------------------------------------ |
| `image`     | `image/png` \| `image/jpeg` \| `image/webp`               | `width`, `height`                    |
| `svg`       | `image/svg+xml`                                           | `width`, `height`                    |
| `video`     | `video/mp4` \| `video/webm`                               | `width`, `height`, `duration`, `fps` |
| `audio`     | `audio/mpeg` \| `audio/wav` \| `audio/aac` \| `audio/ogg` | `duration`                           |
| `font`      | `font/ttf` \| `font/otf` \| `font/woff` \| `font/woff2`   | `family`                             |

---

## Layer → asset (chỉ `assetId`)

Layer media tham chiếu asset bằng `payload.assetId`, không nhúng asset:

```json
{
  "id": "img_1",
  "type": "image",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 400, "height": 300 },
  "transform": {
    "translate": { "x": 0, "y": 0 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "payload": { "assetId": "poster", "fit": "cover" }
}
```

`assetId` phải tồn tại trong `assets[]` và `assetType` phải khớp với `type` của layer.

---

## Compiler resolve

- **Unmanaged**: `uri` đi thẳng qua, không cần resolver.
- **Managed**: không có `uri` → compiler cần `assetUrlResolver`:

```ts
compileMotionProjectV1(project, {
  assetUrlResolver: (id) =>
    id === "logo" ? "https://signed.example/logo.png" : undefined,
});
```

Thiếu resolver cho managed asset → diagnostic `CMP_ASSET_URI_UNRESOLVED`.

---

## Câu chốt

Layer giữ `payload.assetId`. External asset có `uri` + metadata đủ. Managed asset không `uri`, có `integrity` + `sizeBytes` + `storage`, compiler resolve sau. `crop` chỉ image. URL tự nó không đủ — metadata quyết định fit/crop/trim.

---

## Xem thêm

- [v1-image-guide.md](./v1-image-guide.md)
- [v1-video-guide.md](./v1-video-guide.md)
- [v1-audio-guide.md](./v1-audio-guide.md)
- [v1-svg-guide.md](./v1-svg-guide.md)
- [v1-compiler-runtime-guide.md](./v1-compiler-runtime-guide.md)
- [asset-format-storage.md](./asset-format-storage.md)
