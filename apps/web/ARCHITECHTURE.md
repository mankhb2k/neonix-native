# Web Control Plane

Web là **Control Plane** của Neonix. Web sở hữu luật sản phẩm, dữ liệu bền
vững và điều phối job; không render video, probe media hoặc encode MP4.

```text
USER / AI / MCP / EDITOR
             │
             ▼
╔══════════════════════════════════╗
║        WEB / CONTROL PLANE       ║
║                                  ║
║  Auth            Workspace       ║
║  Project         Revision        ║
║  Asset metadata  Export job      ║
║  Usage           Billing         ║
║  Dashboard       Worker control  ║
╚═════════════════╤════════════════╝
                  │
                  │ ports / adapters
      ┌───────────┼───────────┬────────────┐
      ▼           ▼           ▼            ▼
    Auth      Persistence   Storage       Queue
      │           │           │            │
      ▼           ▼           ▼            ▼
 Supabase Auth  Supabase      R2      Postgres polling
                                  (Redis may replace later)
                  │
                  │ claim job / progress / complete
                  ▼
        ┌──────────────────────────┐
        │  EXPORT / MEDIA WORKER   │
        │          Docker          │
        └────────────┬─────────────┘
                     ▼
              Media Engine → MP4 → R2
```

## Luồng production export render

Web là control plane; request export không truyền toàn bộ MP4 qua Web và Web
không tự render video. Cả UI API và MCP `create_export` đều đi qua cùng một
pipeline:

```text
Editor / MCP
    │
    ├─ POST /api/v1/renders hoặc create_export
    │
    ├─ xác thực Supabase, kiểm tra ownership
    ├─ compile Protocol V2 → RuntimeProjectV3
    ├─ ghi render_jobs (runtime manifest bất biến)
    └─ gửi PGMQ message { jobId }
             │
             ▼
      render-queue-worker
             │
             ├─ RENDER_DISPATCH_MODE=cloud-run-job
             └─ POST /v1/render-job-executions tới Cloud Run control service
                              │
                              ▼
                    Cloud Run Job (RENDER_JOB_ID)
                              │
                              ├─ claim lease và đọc manifest từ Supabase
                              ├─ Native Skia CPU render → libyuv → libx264/MP4
                              ├─ ffprobe/checksum verify
                              ├─ upload artifact vào R2
                              └─ cập nhật render_jobs = done/failed
                                      │
                                      ▼
                         get_export / download route
                         → signed R2 URL có thời hạn
```

Trong production, queue message chỉ là tín hiệu đánh thức; Supabase
`render_jobs` mới là source of truth cho manifest, lease, progress và trạng
thái. Cloud Run control service dùng `CLOUD_RUN_PROJECT_ID`, region và tên Job
để gọi Cloud Run Jobs API; web chỉ cần biết `EXPORT_RENDERER_URL` và không
chọn trực tiếp project Cloud Run.

Luồng mặc định là một sequential Job. Chỉ khi bật
`RENDER_CHUNK_EXECUTION_ENABLED=true` mới dùng thêm Chunk Job và Finalizer Job.
Queue worker phải chạy liên tục; nếu không, API có thể tạo job ở trạng thái
`queued` nhưng chưa có Cloud Run execution.

## Dữ liệu Web sở hữu

| Domain | Dữ liệu và trách nhiệm |
| --- | --- |
| Auth | Identity, session và quyền truy cập hiện tại |
| Workspace | Ranh giới ownership cho user, project, asset và export |
| Project | Project canonical hiện tại và metadata sản phẩm |
| Revision | Phiên bản bất biến dùng cho lịch sử, preview và export reproducible |
| Asset | Metadata, ownership, trạng thái ingest và R2 resource reference; không lưu bytes trong database |
| Export Job | Manifest bất biến, preset, trạng thái, progress, diagnostic, artifact reference và worker lease |
| Usage / Billing | Quota reservation, usage đã ghi nhận và chi phí export |

## Nhiệm vụ của Web

1. Xác thực user và kiểm tra workspace ownership.
2. Lưu project, revision và authoring commands qua Protocol Gate.
3. Tạo runtime snapshot/manifest bất biến trước Preview hoặc Export.
4. Điều phối R2: signed upload/download URL, object key và asset metadata.
5. Tạo export job sau khi kiểm tra quota, preset và capability cần thiết.
6. Cung cấp durable queue bằng `export_jobs` và `media_jobs`; export dùng
   `queued → claimed → rendering → uploading → completed/failed`, còn media
   dùng `queued → processing → ready/partial/failed`.
7. Cấp job cho worker, xác thực callback, lease/heartbeat và retry policy.
8. Cập nhật Dashboard bằng progress, diagnostics, artifact URL và trạng thái cuối.
9. Ghi usage/billing chỉ từ kết quả job đã được xác thực.

## Ports cần giữ ổn định

| Port | Application cần biết | Adapter hiện tại |
| --- | --- | --- |
| Auth | current identity, session, authorization | Supabase Auth |
| Persistence | project, revision, asset, export job, usage repositories | Supabase/Postgres |
| Storage | put/get/delete/presign resource bytes | R2 |
| Queue | enqueue, claim, heartbeat, complete, fail | Postgres `export_jobs` + `media_jobs` polling |

Port là seam, không phải lý do để tạo nhiều interface trừu tượng. Chỉ tạo hoặc
mở rộng một port khi application thực sự cần gọi dependency đó.

## Luồng Media Ingest và chuẩn bị video

Media ingest là luồng bất đồng bộ. Web chỉ hoàn tất việc nhận `origin` trước;
`@motionvideo/export-renderer` chạy trong Docker và chuẩn bị poster/audio sau
đó. Cùng một image được dùng cho local test và VPS production. Web vẫn là
control plane sở hữu ownership, job state và asset metadata.

### Storage contract

Mọi asset dùng cùng một namespace trong R2:

```text
{assetId}/origin.png
{assetId}/origin.svg
{assetId}/origin.mp3
{assetId}/origin.mp4

{assetId}/poster.webp
{assetId}/audio.m4a
```

`assets.r2_key` trỏ tới `origin.*`. Poster được tạo và upload một lần ở browser;
worker chỉ verify poster đó. Derivative key và metadata được lưu trong
asset catalog; bytes luôn nằm trong R2, không nằm trong Supabase.

### Video upload flow

```text
Browser
  │
  ├─ POST /api/v1/assets
  │    └─ Web tạo asset + upload session, preview_key = {assetId}/poster.webp
  │
  ├─ PUT origin.mp4 → R2/{assetId}/origin.mp4
  │
  ├─ PUT poster.webp → R2/{assetId}/poster.webp (browser-generated)
  │
  └─ POST /api/v1/assets/upload/complete
       │
       ├─ Web verify size, MIME và source integrity
       ├─ tạo media_jobs với status = queued
       └─ asset status = ready, preview_status = pending
                    │
                    ▼
             @motionvideo/export-renderer
             Docker worker trên local/VPS
                    │
                    ├─ claim job, status = processing
                    ├─ đọc origin từ R2
                    ├─ ffprobe stream metadata
                    ├─ verify poster.webp đã có từ browser
                    ├─ poster.webp phải tồn tại từ browser; worker không tạo poster
                    ├─ nếu có audio: tạo và upload audio.m4a
                    └─ callback Web API
                              │
                              ▼
                       Web API complete
                              │
                              ├─ verify derivative objects trên R2
                              ├─ lưu probe metadata
                              ├─ upsert asset variants
                              └─ status = ready / partial / failed
```

Web API không chờ VPS xử lý xong trong request upload. UI đọc `status` và
`last_error` từ asset/job để hiển thị `Đang chuẩn bị media`, `Sẵn sàng` hoặc
`Không thể xử lý`. `failed` chỉ được dùng khi worker trả lỗi hoặc job timeout;
asset mới upload không được đánh dấu `failed` trong thời gian chờ xử lý.

Media preparation dùng worker handler riêng, tách khỏi export render
semantics:

```text
packages/export-renderer
├─ /v1/renders              → export RuntimeProjectV3 thành MP4
├─ /v1/media/prepare        → probe origin + tạo derivatives
└─ /health /readyz          → container health/readiness
```

Docker local phải chạy cùng image, port, FFmpeg và environment contract như VPS.
Web local gọi container qua `EXPORT_RENDERER_URL`/`MEDIA_WORKER_URL`; container
đọc/ghi R2, gọi internal Web API callback và không nhận video bytes qua Web API.

### Ownership và callback

Worker không ghi trực tiếp vào Supabase bằng quyền service role. Worker chỉ đọc/ghi
binary derivative trên R2 và gọi internal Web API callback có xác thực.
Callback gửi `jobId`, `assetId`, source integrity, pipeline version, stream
metadata và danh sách derivative keys.

Web API xác thực job, kiểm tra R2, sau đó ghi metadata, variant keys và trạng
thái trong một thao tác hoàn tất có tính idempotent. Job được deduplicate theo:

```text
(assetId, sourceIntegrity, pipelineVersion)
```

Nếu worker chết, lease/timeout chuyển job sang `failed` với diagnostic rõ ràng;
origin vẫn được giữ để retry. Không tạo `audio.m4a` rỗng khi video không có
audio stream.

### Readiness rules

```text
uploading → queued → processing → ready
                              ├→ partial
                              └→ failed
```

- `ready`: origin đã verify và các derivative bắt buộc đã sẵn sàng.
- `partial`: origin/probe dùng được nhưng một derivative không tạo được.
- `failed`: ingest thất bại hoặc timeout sau retry.
- Export audio phải fail closed nếu audio derivative bắt buộc chưa `ready`.

### System asset fallback và xóa user asset

System placeholder nằm trong bucket R2 riêng `neonix-system-assets`; font hệ thống nằm trong bucket
riêng `neonix-system-fonts`. Cả hai bucket đều private và được
đăng ký trong bảng `system_catalog.system_assets`. Catalog dùng một bảng self-reference cho cả
asset gốc và derivative:

```text
system:image-placeholder       -> placeholder/image.webp
system:svg-placeholder         -> placeholder/svg-placeholder.svg
system:video-placeholder       -> placeholder/video.mp4
system:video-placeholder:poster -> placeholder/video-poster.webp
system:audio-silence           -> placeholder/silence.m4a
```

Project chỉ lưu system asset ID ổn định. Khi load project, Web resolve ID thành
URL same-origin `/api/v1/system-assets/:id`; bucket vẫn private.

Khi user xóa asset, Web kiểm tra `project_assets` trước và hiển thị các project
đang sử dụng. Nếu user xác nhận, RPC `delete_asset_with_system_fallback` chạy
transaction:

```text
lock asset
  -> tạo revision mới với fallback cùng loại
  -> cập nhật document asset/layer/audio references
  -> xóa project_assets của user asset
  -> đánh dấu asset deleted + deleted_at
  -> đánh dấu media job đang chạy failed nếu có
```

Image/SVG, video và audio lần lượt được thay bằng placeholder tương thích;
không thay video/audio bằng image vì sẽ làm sai loại layer. Revision cũ vẫn
được giữ bất biến.

## Luồng export

```text
User requests export
        │
        ▼
Web validates ownership + quota + project revision
        │
        ▼
Web creates immutable export manifest
        │
        ▼
export_jobs: queued
        │
        ▼
Worker claims one job
        │
        ▼
Media Engine renders and writes artifact to R2
        │
        ▼
Worker reports progress / completed / failed
        │
        ▼
Web validates result, records usage, updates Dashboard
```

## Ranh giới

```text
Control Plane quyết định ai được làm gì và job nào được chạy.
Media Engine quyết định cách project trở thành MP4.
Infrastructure cung cấp implementation có thể thay thế.
```

Web không biết cách vẽ Matrix4, decode frame, mix audio hoặc gọi FFmpeg.
Worker không biết user, subscription, workspace hay luật billing.
