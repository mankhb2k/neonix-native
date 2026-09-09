# HTML Compiler Offline-First Workflow

## Mục tiêu

Cho phép AI coding agent hoặc developer tạo video bằng HTML/CSS, debug ngay trên máy local, compile thành Protocol V2 JSON và chỉ gọi Neonix API khi cần remote compilation hoặc export video.

## Kiến trúc tổng quát

```text
AI Agent / Developer
        |
        v
HTML + CSS + neonix.config.json
        |
        v
Local HTML Compiler hoặc Neonix Compile API
        |
        v
Protocol V2 JSON
        |
        v
Local Skia Preview hoặc Neonix Video Export
```

## Offline local flow

Sau khi cài dependencies, compiler có thể chạy offline:

```text
HTML/CSS source
  -> parse và validate
  -> layout/paint/motion lowering
  -> Protocol V2
  -> schema validation
  -> iframe browser reference
  -> local Skia/runtime preview
```

Local flow không cần gọi Neonix API. Máy chỉ cần có:

- `@motionvideo/html-compiler`;
- Protocol V2 và runtime preview packages;
- Node.js/pnpm hoặc CLI bundle;
- font, image, video và audio assets local;
- boilerplate debug app.

Dependencies có thể cần network trong lần setup đầu tiên, nhưng sau đó quá trình compile và preview vẫn chạy offline.

## Cấu trúc boilerplate

```text
neonix-html-boilerplate/
├── index.html
├── scene.css
├── neonix.config.json
├── AGENTS.md
├── RULE.md
├── neonix-capabilities.json
├── neonix.config.json
├── src/
│   └── assets/
├── cases/
│   ├── basic-shape/
│   ├── text/
│   └── animation/
└── dist/
```

## Composition bắt buộc

Mỗi project phải khai báo composition rõ ràng. Composition là source of truth cho layout và render, không được suy ra từ viewport của browser.

```json
{
  "kind": "neonix-html-project",
  "schemaVersion": 1,
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background": "#081018",
    "colorSpace": "srgb"
  }
}
```

Các preset thường dùng:

```text
16:9 -> 1920x1080
9:16 -> 1080x1920
1:1  -> 1080x1080
```

Manifest có thể nằm trong `neonix.config.json` và được embed trong HTML:


Nếu manifest trong request và manifest trong HTML không giống nhau, compiler phải trả diagnostic `composition-mismatch` thay vì tự chọn một giá trị.

The canonical project contract is now:

```ts
compileProject({
  html: readFile("src/scene.html"),
  css: readFile("src/scene.css"),
  config: readJson("neonix.config.json"),
});
```

`neonix.config.json` is the only composition source of truth. Do not embed a
`script#neonix-manifest` block in the HTML.

## Current AI/MCP and fixture contract

The compiler-facing artifact for AI agents, MCP and Preview Lab fixtures is a
single self-contained HTML document. Its filename is arbitrary; the required
`meta[name="neonix-document"]` identifies the format and carries composition
metadata. CSS is collected from inline `<style>` resources in document order.

```ts
compileDocument({ html });
```

The multi-file project contract above remains the deferred developer build
workflow. `create-neonix` is not responsible for producing this final document
in the current compiler migration.

## Source authoring

`index.html` chứa semantic HTML:

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div id="blue-rectangle"></div>
    <h1 id="title">Hello Neonix</h1>
  </body>
</html>
```

`scene.css` chứa các property nằm trong allowlist của `packages/html-compiler/RULE.md`:

```css
body {
  margin: 0;
  background: #081018;
}

#blue-rectangle {
  position: absolute;
  left: 400px;
  top: 300px;
  width: 420px;
  height: 220px;
  background: #2563eb;
  border-radius: 24px;
}

#title {
  position: absolute;
  left: 420px;
  top: 560px;
  color: #ffffff;
  font-family: Inter;
  font-size: 64px;
  font-weight: 700;
}
```

Boilerplate có thể hỗ trợ cả `<style>` trong HTML và file `scene.css`, nhưng compiler core nên nhận source đã chuẩn hóa:

```ts
{
  html: string;
  css: string;
  config: NeonixHtmlProjectConfig;
}
```

## Debug iframe

Iframe chỉ làm nhiệm vụ preview, không phải nơi lưu source code. Code editor nằm bên ngoài iframe và gửi source mới qua `postMessage` hoặc dev server hot reload.

Preview nên có ba vùng:

```text
Browser HTML/CSS reference
Compiler diagnostics + Protocol V2 JSON
Skia/runtime output
```

Iframe phải render composition cố định theo manifest. Ví dụ composition `1920x1080` được scale để vừa vùng preview nhưng logical coordinate vẫn là `1920x1080`.

Nên chạy iframe trong môi trường sandbox:

```html
<iframe sandbox="allow-scripts" title="Neonix preview"></iframe>
```

Không cho source HTML tự ý truy cập parent app, cookie hoặc API nội bộ.

## CLI local

```bash
pnpm install
pnpm neonix validate
pnpm neonix dev
pnpm neonix compile
```

`neonix validate` kiểm tra:

- `neonix.config.json`;
- composition;
- HTML tag allowlist;
- CSS property/value allowlist;
- asset references;
- compiler diagnostics.

`neonix dev` mở debug iframe và tự động compile khi source thay đổi.

`neonix compile` tạo output:

```text
dist/
├── project.json
├── diagnostics.json
└── source-hash.txt
```

## Local compiler API

```ts
const result = compileProject({
  html,
  css,
  config,
});
```

Kết quả chuẩn:

```ts
{
  status: "success" | "error";
  protocol: MotionProtocolV2 | null;
  diagnostics: Diagnostic[];
  sourceHash: string;
  compilerVersion: string;
}
```

Nếu compiler không có lowering cho một property/value, nó phải trả diagnostic và không tạo Protocol V2 giả hoặc silently drop declaration.

## Remote API flow

Khi user muốn dùng compiler trên Neonix:

```bash
pnpm neonix compile --remote \
  --api https://app.neonix.video/api/v1/html/compile
```

Request:

```json
{
  "html": "...",
  "css": "...",
  "config": {
    "kind": "neonix-html-project",
    "schemaVersion": 1,
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  "compilerVersion": "2.0.0"
}
```

Response phải giữ cùng contract với local compiler:

```json
{
  "status": "success",
  "protocol": {},
  "diagnostics": [],
  "compilerVersion": "2.0.0",
  "sourceHash": "sha256:..."
}
```

Local và remote compiler phải tạo cùng Protocol JSON khi dùng cùng compiler version, font catalog và asset metadata.

## AI agent workflow

Agent nên thực hiện tuần tự:

```text
1. Đọc AGENTS.md và RULE.md
2. Đọc neonix-capabilities.json
3. Chọn composition
4. Viết HTML/CSS
5. Chạy neonix validate
6. Đọc diagnostics nếu compile thất bại
7. Sửa source
8. Chạy neonix dev để so sánh browser/Skia
9. Chạy neonix compile
10. Commit source và Protocol JSON nếu cần
```

Agent không được tự thêm CSS property ngoài capability contract chỉ vì browser hỗ trợ property đó.

## Asset và reproducibility

Để chạy offline và cho kết quả ổn định:

- font phải được khai báo và lưu local;
- image/video/audio nên nằm trong project hoặc asset manifest;
- không phụ thuộc CDN không pin version;
- source phải có compiler version;
- Protocol output nên có `sourceHash`;
- local/API phải sử dụng cùng font catalog và Protocol schema.

## Nguyên tắc triển khai

- Local compiler là mode mặc định.
- Neonix API là remote fallback hoặc export service.
- Debug preview phải hiển thị cả browser reference và Protocol runtime.
- Composition luôn bắt buộc và được validate trước khi compile.
- Không có lowering thì mặc định unsupported.
- Không có runtime/Skia support thì chưa được gọi là app-supported.
- Không silently drop HTML/CSS declaration.
