# MCP-first HTML Authoring Implementation Plan

Kế hoạch này triển khai hosted MCP trước khi làm playground public hoặc anonymous
draft. MCP sẽ là lớp authoring cho AI, còn Protocol V2 JSON vẫn là source of
truth cho runtime, preview và export.

## 1. Mục tiêu kiến trúc

```text
create_project(Protocol V2 JSON)
        ↓
projects + project_revisions
        ↓
AI đọc/sửa HTML authoring
        ↓
validate_html / compile_html
        ↓
update_project_html
        ↓
project_html_revisions + project_revisions
        ↓
Runtime / Preview / Export
```

Quy tắc bắt buộc:

- `create_project` là JSON-first và tiếp tục nhận Protocol V2 JSON.
- HTML không tạo một loại project riêng.
- HTML revision luôn thuộc về một project hiện có.
- Mỗi lần lưu HTML thành công phải tạo một Protocol V2 revision mới.
- Runtime, preview và export chỉ đọc Protocol V2 JSON.
- Không xây reverse compiler JSON → HTML.
- AI ưu tiên sửa HTML; JSON patch chỉ là escape hatch cho các thay đổi HTML
  compiler chưa biểu diễn được.
- Chưa triển khai anonymous draft, playground persistence hoặc landing playground
  trong kế hoạch này.

## 2. Hiện trạng

### Đã có

- `@motionvideo/motion-mcp` có JSON project operations:
  `create_project`, `get_project`, `update_project`, `apply_patch` và các tool
  inspect/compile Protocol V2.
- Hosted MCP transport tại `/api/mcp`.
- Supabase OAuth/Bearer authentication cho MCP.
- `neonix_validate_document` và `neonix_compile_document` nhận một HTML document,
  nhưng hiện chỉ trả kết quả stateless.
- API HTML v1:

  ```text
  POST /api/v1/documents/validate
  POST /api/v1/documents/compile
  POST /api/v1/projects
  GET  /api/v1/projects/:projectId
  PUT  /api/v1/projects/:projectId
  GET  /api/v1/projects/:projectId/document
  GET  /api/v1/projects/:projectId/revisions
  GET  /api/v1/projects/:projectId/revisions/:revisionNo
  GET  /api/v1/projects/:projectId/revisions/:revisionNo/json
  ```

- Database đã có:

  ```text
  projects
  project_revisions
  project_html_revisions
  ```

- `project_html_revisions.protocol_revision_id` đã có composite foreign key để
  đảm bảo HTML và JSON thuộc cùng một project.

### Còn thiếu

- Hosted MCP chưa có tool đọc HTML revision của một project.
- Hosted MCP chưa có tool lưu HTML vào một project hiện có.
- MCP persistence adapter hiện đang tập trung vào `project_revisions` JSON.
- HTML repository đang dùng server-session authentication, chưa được tái sử dụng
  trực tiếp với `McpPrincipal` và access token.
- Chưa có JSON patch persistence rõ ràng cho hosted MCP.
- Chưa có asset tools cho MCP.
- Render/export qua MCP chưa được nối với project revision đã lưu.

## 3. API contract của MCP

### 3.1 Project JSON tools

Giữ lại và chuẩn hóa các tool hiện có:

```text
list_workspaces
create_project
list_projects
get_project
update_project
delete_project
open_editor
```

`create_project`:

```json
{
  "workspace_id": "uuid",
  "title": "Motion title",
  "document": {
    "format": "motion-protocol",
    "formatVersion": 2,
    "id": "project-id",
    "composition": {},
    "assets": [],
    "layers": [],
    "audio": {}
  }
}
```

Kết quả phải trả về:

- `project_id`;
- `public_ref`;
- `protocol_revision_id`;
- `protocol_revision_no`;
- `document_hash`;
- workspace và quyền hiện tại.

`update_project` tiếp tục là JSON update cho các client Protocol V2 trực tiếp.
Tool này không được dùng trong HTML authoring flow.

### 3.2 HTML authoring tools

Tên tool không có prefix thừa:

```text
get_capabilities
validate_html
compile_html
get_project_html
update_project_html
list_html_revisions
get_html_revision
```

`get_capabilities` trả về:

- HTML tags được hỗ trợ;
- CSS properties và values được hỗ trợ;
- metadata contract `meta[name="neonix-document"]`;
- Protocol V2 version;
- composition rules;
- các diagnostic code có thể xuất hiện.

`validate_html` là stateless:

```json
{
  "html": "<!doctype html>..."
}
```

Kết quả gồm:

- `valid`;
- composition;
- diagnostics;
- layer count;
- document hash.

`compile_html` là stateless và không ghi database:

```json
{
  "html": "<!doctype html>..."
}
```

Kết quả gồm:

- Protocol V2 JSON candidate;
- composition;
- diagnostics;
- document hash;
- compiler version.

`get_project_html` nhận `project_id` hoặc `public_ref` và trả về:

- project metadata;
- HTML mới nhất;
- `html_revision_no`;
- `html_revision_id`;
- `protocol_revision_id` mà HTML đã sinh ra;
- `protocol_revision_no`;
- `html_sync_status`.

`update_project_html` là operation ghi dữ liệu chính:

```json
{
  "project_id": "uuid",
  "html": "<!doctype html>...",
  "expected_html_revision_no": 3,
  "expected_protocol_revision_no": 5
}
```

Server phải xử lý atomic theo thứ tự:

1. Xác thực MCP principal và workspace role.
2. Đọc project hiện tại.
3. Kiểm tra optimistic concurrency.
4. Compile HTML.
5. Nếu có error diagnostic thì trả lỗi và không ghi revision.
6. Insert Protocol V2 JSON vào `project_revisions`.
7. Insert HTML vào `project_html_revisions` với `protocol_revision_id`.
8. Cập nhật `projects.current_revision_no` và `source_format`.
9. Ghi audit event.
10. Trả về HTML revision, Protocol V2 revision và diagnostics.

Không được tạo HTML revision nếu bước compile thất bại.

### 3.3 JSON inspection và JSON patch

Các tool đọc JSON:

```text
get_project_json
list_revisions
get_revision
```

`get_project_json` chỉ đọc canonical JSON đã lưu trong
`project_revisions.document_json`. Nó không compile ngược về HTML.

Tool chỉnh sửa trực tiếp JSON:

```text
apply_json_patch
```

Input tối thiểu:

```json
{
  "project_id": "uuid",
  "expected_protocol_revision_no": 5,
  "patch": [
    {
      "op": "setValue",
      "path": "/layers/title/opacity",
      "value": 0.85
    }
  ]
}
```

Quy tắc:

- Không nhận toàn bộ JSON thay thế nếu không cần thiết.
- Tái sử dụng patch schema V2 hiện có.
- Luôn kiểm tra revision number.
- Tạo một `project_revisions` mới với `reason: "mcp-json-patch"`.
- HTML revision cũ không bị sửa ngược.
- Trả `html_sync_status: "overlay"` hoặc `"stale"` để AI biết HTML không còn
  mô tả đầy đủ JSON hiện tại.
- Khi AI quay lại sửa HTML, phải báo rằng JSON patch có thể bị ghi đè hoặc cần
  replay overlay.

Giai đoạn đầu có thể dùng trạng thái `stale` để đơn giản. Cơ chế JSON overlay
được replay tự động là phase nâng cao, không block MCP MVP.

## 4. Persistence adapter cho hosted MCP

### 4.1 Tách logic dùng chung

Tạo các hàm repository có thể nhận authenticated Supabase client thay vì phụ
thuộc cookie session:

```text
createProjectWithClient
getProjectWithClient
createHtmlRevisionWithClient
getLatestHtmlRevisionWithClient
saveHtmlRevisionWithClient
applyJsonPatchWithClient
```

Cookie-based web API và Bearer-based MCP adapter sẽ dùng chung các hàm này.
Không copy lại logic compile hoặc revision numbering trong MCP.

### 4.2 MCP principal

MCP adapter phải giữ:

- `userId` từ JWT `sub`;
- `clientId`;
- scopes;
- access token để tạo Supabase client có RLS.

Mọi project operation phải kiểm tra workspace membership và role:

```text
viewer → đọc
editor → sửa HTML/JSON, upload asset
owner  → toàn quyền workspace
```

### 4.3 Revision consistency

Mỗi HTML save phải bảo đảm:

```text
project_html_revisions.project_id = project.id
project_html_revisions.protocol_revision_id = new project_revisions.id
```

Composite foreign key phải tiếp tục được giữ nguyên để chặn liên kết chéo
project.

## 5. MCP instructions/skill contract

Hosted MCP server instructions phải mô tả rõ quy trình cho AI:

```text
1. Use create_project only when creating the initial Protocol V2 project.
2. Use get_project_html before editing an existing HTML-authored project.
3. Prefer HTML edits for authoring changes.
4. Call validate_html before update_project_html.
5. Use update_project_html to persist HTML and create a new Protocol V2 revision.
6. Use get_project_json only for inspection and debugging.
7. Use apply_json_patch only when HTML cannot express the requested change.
8. Never attempt JSON → HTML conversion.
9. Check revision conflicts before every write.
```

Tool descriptions phải nói rõ tool nào read-only và tool nào tạo revision.

## 6. OAuth và quyền MCP

MCP OAuth hiện đã có nền tảng:

- Supabase OAuth issuer;
- JWKS verification;
- Bearer token;
- protected resource metadata;
- consent flow.

Trong MCP-first phase:

- mọi project read/write yêu cầu authenticated MCP principal;
- `validate_html` và `compile_html` có thể cho phép authenticated MCP client
  sử dụng mà không ghi database;
- `create_project`, `update_project_html`, `apply_json_patch` yêu cầu editor;
- asset upload yêu cầu editor;
- export sẽ yêu cầu editor/owner và project đã tồn tại.

Không đưa anonymous draft vào MCP. Anonymous playground là phase riêng sau này.

## 7. Asset tools cho MCP

Sau khi project/html persistence hoàn tất, thêm asset operations:

```text
list_assets
import_asset
request_asset_upload
complete_asset_upload
attach_asset_to_project
delete_asset
```

### Import từ URL

`import_asset` để server tải file, validate và upload R2:

```json
{
  "project_id": "uuid",
  "source_url": "https://example.com/image.png",
  "filename": "image.png"
}
```

Phải có:

- allowlist MIME;
- giới hạn bytes;
- timeout;
- chống SSRF;
- SHA-256 deduplication;
- tạo `assets` và `project_assets`;
- trả về asset reference để AI dùng trong HTML/JSON.

### Presigned upload

Đối với file local hoặc file lớn:

```text
request_asset_upload
  → presigned URL
upload bytes
complete_asset_upload
  → verify object + create metadata
```

Không bao giờ đưa R2 secret vào MCP client.

## 8. Export qua MCP

Export không thuộc MVP đầu tiên của HTML authoring, nhưng cần chuẩn hóa sau khi
project persistence ổn định:

```text
create_export
get_export
get_export_download_url
cancel_export
```

`create_export` chỉ nhận:

```json
{
  "project_id": "uuid",
  "protocol_revision_no": 6,
  "preset": "export-1080p"
}
```

Server phải:

1. Xác thực user và workspace role.
2. Đọc JSON revision từ database.
3. Compile JSON thành runtime project.
4. Tạo render job gắn với user/project/revision.
5. Gửi job tới worker.
6. Lưu video output vào R2.
7. Trả signed download URL khi video hoàn tất.

Không để MCP client gửi một JSON tùy ý để export mà không lưu revision.

## 9. Phases triển khai

### Phase 0 — Contract lock

- Chốt JSON-first semantics của `create_project`.
- Chốt tên tool không có prefix `neonix_`.
- Chốt input/output schema.
- Chốt revision conflict behavior.
- Cập nhật README, architecture và MCP instructions.

Acceptance:

- Không còn mơ hồ giữa JSON project creation và HTML authoring.
- Có schema test cho toàn bộ tool mới.

### Phase 1 — Shared authenticated repository

- Tách HTML repository khỏi cookie-only authentication.
- Nhận Supabase client và principal từ adapter.
- Dùng chung compile, hash, diagnostics và revision persistence.
- Bổ sung transaction/RPC nếu cần để tránh tạo JSON revision nhưng thiếu HTML
  revision.

Acceptance:

- Web API hiện tại vẫn hoạt động.
- MCP có thể dùng cùng persistence logic.
- Không tạo revision một nửa khi compile hoặc insert thất bại.

### Phase 2 — MCP HTML read/compile tools

- Đổi `neonix_get_capabilities` thành `get_capabilities`.
- Đổi `neonix_validate_document` thành `validate_html`.
- Đổi `neonix_compile_document` thành `compile_html`.
- Bổ sung `get_project_html`.
- Bổ sung `list_html_revisions` và `get_html_revision`.

Acceptance:

- AI có thể đọc HTML hiện tại của project.
- AI có thể validate/compile HTML nhưng chưa ghi DB.
- Kết quả trả đúng composition, diagnostics và revision metadata.

### Phase 3 — MCP HTML write tool

- Bổ sung `update_project_html`.
- Thêm expected HTML/protocol revision checks.
- Ghi JSON trước, HTML sau theo cùng một operation an toàn.
- Ghi audit event.
- Trả về cả HTML revision và Protocol V2 revision.

Acceptance:

- AI sửa HTML và tạo JSON revision mới.
- Compile lỗi không làm thay đổi database.
- Concurrent update trả lỗi conflict rõ ràng.
- Composite FK xác nhận HTML liên kết đúng JSON của cùng project.

### Phase 4 — Direct JSON patch escape hatch

- Bổ sung `get_project_json`.
- Bổ sung `apply_json_patch`.
- Dùng patch schema V2 hiện có.
- Ghi `reason: "mcp-json-patch"`.
- Trả trạng thái HTML stale/overlay.
- Thêm warning trong tool result và MCP instructions.

Acceptance:

- AI sửa được thuộc tính nhỏ mà HTML compiler chưa hỗ trợ.
- Không có full-document replacement mặc định.
- HTML không bị giả vờ đồng bộ với JSON sau JSON patch.

### Phase 5 — MCP asset operations

- Thêm import từ URL.
- Thêm presigned upload flow.
- Đăng ký metadata vào `assets`.
- Liên kết qua `project_assets`.
- Bổ sung size/MIME/SSRF/dedup tests.

Acceptance:

- AI có thể đưa asset vào project mà không thấy R2 credentials.
- HTML/JSON có thể tham chiếu asset ổn định.

### Phase 6 — MCP export

- Thêm project-scoped render API.
- Bắt buộc authenticated user.
- Đọc Protocol V2 JSON từ DB thay vì nhận JSON tùy ý.
- Chuẩn hóa render job persistence.
- Lưu output vào R2.
- Trả signed download URL.

Acceptance:

- User chưa xác thực không thể export qua MCP.
- Export luôn gắn với project revision.
- User chỉ tải được video thuộc project/workspace của mình.

### Phase 7 — MCP end-to-end certification

- Test initialize/tools/list/call qua Streamable HTTP.
- Test Supabase OAuth/Bearer.
- Test RLS owner/editor/viewer.
- Test create JSON project.
- Test HTML read → validate → update → get JSON.
- Test JSON patch sau HTML update.
- Test asset import/upload.
- Test export và signed download.
- Cập nhật Swagger/API docs và MCP README.

## 10. Test matrix bắt buộc

### Project

- Tạo project với Protocol V2 JSON hợp lệ.
- Từ chối JSON sai schema.
- Viewer không được sửa.
- Revision conflict không ghi dữ liệu.

### HTML

- Đọc HTML revision mới nhất.
- Validate HTML hợp lệ.
- Từ chối HTML thiếu `meta[name="neonix-document"]`.
- Từ chối unsupported tag/CSS theo RULE.md.
- Compile lỗi không tạo revision.
- Compile thành công tạo đúng một JSON revision và một HTML revision.

### Link integrity

- HTML revision trỏ đúng Protocol V2 revision cùng project.
- Không thể liên kết HTML project A với JSON project B.
- Xóa project xử lý đúng HTML revisions và JSON revisions.

### JSON patch

- Patch hợp lệ tạo JSON revision mới.
- Patch sai path trả diagnostic.
- Patch stale trả conflict.
- Sau patch, response đánh dấu HTML stale/overlay.

### Security

- Không có Bearer token → MCP 401.
- Token sai audience/issuer → MCP 401.
- Workspace khác → không lộ project.
- Asset URL nội bộ bị chặn.
- R2 credentials không xuất hiện trong tool result.

## 11. Non-goals của kế hoạch này

- Không tạo `/playground`.
- Không lưu anonymous draft.
- Không thêm nút Playground vào landing header.
- Không xây JSON → HTML reverse compiler.
- Không biến `create_project` thành HTML-first.
- Không bỏ các JSON tools hiện có cho client Protocol V2.

Các nội dung trên sẽ thực hiện sau khi MCP authoring flow được certification.

## 12. Definition of Done

MCP-first phase hoàn thành khi AI có thể thực hiện đầy đủ:

```text
create_project(JSON)
  → get_project_html hoặc nhận HTML mới
  → validate_html
  → update_project_html
  → get_project_json
  → apply_json_patch nếu cần
  → upload/attach asset
  → export revision đã lưu
```

Mọi thay đổi đều có user/workspace authorization, optimistic concurrency,
revision history, audit event và không phá vỡ nguyên tắc Protocol V2 JSON là
source of truth cho runtime.

## Implementation status - 2026-09-09

- Phase 0: implemented; contract and tool naming are locked. Broader schema
  coverage remains part of hosted certification.
- Phase 1: implemented; shared repository accepts an authenticated Supabase
  client and actor, and HTML commits use the transaction RPC.
- Phase 2: implemented; hosted HTML capability, validation, compilation and
  revision read tools are registered.
- Phase 3: implemented; `update_project_html` creates linked HTML and Protocol
  V2 revisions with optimistic concurrency.
- Phase 4: implemented; JSON inspection and patch escape hatch are registered,
  with `html_sync_status: "stale"` after a direct JSON patch.
- Phase 5: implemented; hosted asset list, presigned upload, completion, URL
  import, project attachment and deletion tools are registered.
- Phase 6: implemented; hosted export reads a stored Protocol V2 revision,
  persists the worker artifact to the private exports bucket, mirrors the job
  in `render_jobs`, and exposes a signed download URL.
- Phase 7: partially implemented; package/web typechecks and MCP unit tests
  pass. Full hosted OAuth, RLS, R2 and worker E2E certification remains a
  deployment test step.

The anonymous playground, draft persistence and JSON-to-HTML reverse compiler
remain out of scope.
