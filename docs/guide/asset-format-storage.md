# MotiClip — Asset Format & Storage

Module: `packages/motion-storage/` · Schema: `packages/motion-protocol/src/v1/assets.ts`

`motion-storage` là **vòng khép kín** cho binary: nhận asset → lưu object store → emit `AssetV1` → resolve URL ephemeral cho compiler/export. MCP và web chỉ gọi API này; không upload R2 trực tiếp, không nhét URL vào layer.

> **Contract:** All user-provided assets must be ingested through motion-storage before they can be referenced by `MotionProjectV1`. Compiler and clients never talk to object storage directly.

---

## 1. Vai trò trong pipeline

```mermaid
flowchart LR
  Client[MCP_or_web] -->|upload_API| Storage[motion-storage]
  Storage --> R2[R2_or_memory]
  Storage -->|AssetV1_assetId| Project[MotionProjectV1.assets]
  Project --> Layer[layer.payload.assetId]
  Project --> Compiler[motion-compiler]
  Compiler -->|download-url| Storage
  Compiler --> Runtime[Runtime_IR_ephemeral_uri]
```

| Thành phần | Việc được làm | Việc không được làm |
| --- | --- | --- |
| Layer payload | Chỉ `assetId` / `fontAssetId` | Không chứa URL |
| `project.assets[]` | Khai báo metadata + storage | Không phải nguồn bytes runtime |
| `motion-storage` | Ingest, lưu, validate, signed/ephemeral URL | — |
| Compiler | Resolve URI rồi emit runtime IR | Không đọc R2/key trực tiếp |

---

## 2. Hai chế độ asset trong `AssetV1`

### 2.1 Unmanaged (local / fixture)

Dùng cho test, fixture offline, path tương đối trong repo.

```jsonc
{
  "id": "logo",
  "uri": "./assets/logo.png",
  "assetType": "image",
  "mimeType": "image/png",
  "width": 512,
  "height": 512
}
```

- `uri` **bắt buộc**
- `storage` bỏ trống hoặc `{ "managed": false }`
- Compiler pass-through `uri` vào runtime IR

### 2.2 Managed (production)

Sau khi ingest qua Asset API:

```jsonc
{
  "id": "asset.image.9f3c…",
  "assetType": "image",
  "mimeType": "image/png",
  "width": 512,
  "height": 512,
  "integrity": "sha256:…",
  "sizeBytes": 20480,
  "name": "logo.png",
  "storage": {
    "managed": true,
    "provider": "r2",
    "key": "assets/temporary/asset.image.9f3c….png",
    "retention": "temporary"
  },
  "source": {
    "kind": "upload",
    "originalName": "logo.png",
    "importedAt": "2026-08-14T00:00:00.000Z"
  }
}
```

- **Cấm** `uri` trên project JSON
- **Bắt buộc** `integrity`, `sizeBytes`, `storage.managed: true`
- Compiler **bắt buộc** `assetUrlResolver` (map `assetId` → download URL từ storage)

---

## 3. Retention

Schema hỗ trợ 4 mode:

| Mode | Ý nghĩa | MVP runtime |
| --- | --- | --- |
| `temporary` | TTL 24h | **Implement** |
| `project` | Gắn vòng đời project | Schema only |
| `library` | Thư viện user | Schema only |
| `permanent` | Không GC tự động | Schema only |

Upload mặc định: `temporary`. Mode khác → API trả `400 retention_unsupported` cho đến phase sau.

---

## 4. Asset API (Express trong `motion-storage`)

Chạy:

```bash
pnpm --filter @motionvideo/motion-storage start
```

Base mặc định: `http://127.0.0.1:8787`

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/assets/uploads` | Tạo pending + `uploadUrl` (presign R2 hoặc local PUT) |
| `PUT` | `/assets/uploads/:id/bytes` | Upload bytes (provider `memory`) |
| `POST` | `/assets/uploads/:id/complete` | Hash/size → `AssetV1` managed |
| `GET` | `/assets/:id/download-url` | URL ephemeral ngắn hạn |
| `GET` | `/assets/objects/:token` | Serve bytes (memory provider) |
| `POST` | `/assets/validate` | `{ assets: AssetV1[] }` → missing/expired/integrity |
| `DELETE` | `/assets/:id` | Soft-delete + xóa object |

Auth optional: `Authorization: Bearer $MOTION_STORAGE_API_TOKEN`.

Provider:

- `MOTION_STORAGE_PROVIDER=memory` (default, CI/local closed-loop)
- `MOTION_STORAGE_PROVIDER=r2` + `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`

---

## 5. Client SDK

```ts
import { createAssetStorageClient } from "@motionvideo/motion-storage";

const client = createAssetStorageClient({
  baseUrl: process.env.ASSET_API_BASE_URL!,
  getAuthHeaders: () => ({
    Authorization: `Bearer ${process.env.MOTION_STORAGE_API_TOKEN}`,
  }),
});

const asset = await client.ingestBytes(
  {
    assetType: "image",
    mimeType: "image/png",
    name: "logo.png",
    width: 512,
    height: 512,
  },
  pngBytes,
);

// Gắn vào project: patchProject({ op: "addAsset", asset })
// Layer chỉ reference asset.id
```

Resolve cho compiler:

```ts
import {
  createMapAssetUrlResolver,
} from "@motionvideo/motion-storage";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";

const urls = new Map<string, string>();
for (const asset of project.assets) {
  if (asset.storage?.managed) {
    const { url } = await client.getDownloadUrl(asset.id);
    urls.set(asset.id, url);
  }
}

const result = compileMotionProjectV1(project, {
  assetUrlResolver: createMapAssetUrlResolver(urls),
});
```

Thiếu resolver với managed asset → diagnostic `CMP_ASSET_URI_UNRESOLVED`.

---

## 6. Package surface

| Export | Nội dung |
| --- | --- |
| `@motionvideo/motion-storage` | Client, resolve helpers, DTO types |
| `@motionvideo/motion-storage/server` | `AssetService`, Express router/app, memory + R2 providers |

`asset-registry` vẫn chỉ whitelist font / sanitize SVG — **không** chứa R2.

---

## 7. Out of scope (phase sau)

- Google Drive import (`source.kind: "googleDrive"`)
- Relink / replace bytes cùng `assetId`
- Retention `project` / `library` / `permanent`
- MCP tool wrappers (sẽ gọi cùng client này)

---

## 8. Liên quan

- Format tổng: [`v1-format-guide.md`](./v1-format-guide.md) (mục Assets)
- Timeline / layers: [`v1-timeline-guide.md`](./v1-timeline-guide.md)
- Component: [`v1-component-guide.md`](./v1-component-guide.md)
