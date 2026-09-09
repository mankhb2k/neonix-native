# HTML Compiler Final Document Refactor Plan

> **Current scope:** This plan currently covers only `html-compiler`, final HTML
> documents used by fixtures, AI agents and MCP integrations. It does not
> implement `create-neonix` build output or a developer multi-file authoring
> workflow. Those belong to a later phase and are out of scope for the current
> refactor.

Current execution flow:

```text
AI / MCP generates a named HTML document
        ↓
Preview fixture or MCP validation
        ↓
compileDocument({ html })
        ↓
Protocol V2 JSON
```

There is no requirement in the current phase to read `neonix.config.json`,
resolve a developer project, or produce a `create-neonix` build artifact.

## Implementation status

The first execution pass has completed the compiler and fixture foundation:

- [x] V2 document metadata parser and composition validation.
- [x] Ordered collection of inline `<style>` resources.
- [x] `compileDocument({ html })` with font/media asset options.
- [x] Root `final.html` reference compiles successfully.
- [x] Preview fixtures expose final HTML and use the same document for the
  browser iframe and compiler path.
- [x] Unit and Preview Lab coverage for the new document path.
- [x] Dedicated Playwright metadata assertions for tag/text fixture routes.
- [x] Invalid metadata, duplicate metadata and invalid style-type unit coverage.
- [ ] Legacy API removal (deferred until downstream consumers migrate).
- [ ] Developer build and `create-neonix` integration (explicitly deferred).

## 1. Mục tiêu

Refactor `html-compiler` và toàn bộ Preview Lab fixtures về một contract thống nhất:

```text
Authoring project nhiều file
        ↓ neonix build
Một final.html duy nhất
        ↓ compileDocument({ html })
Protocol V2 JSON
        ↓
Skia/runtime/video export
```

AI agent, MCP, ChatGPT plugin hoặc Claude chỉ cần tạo/ghi một file HTML cuối cùng. File đó chứa:

- HTML visual trong `<body>`;
- CSS đã inline trong `<style data-neonix-bundle>`;
- composition metadata trong `meta[name="neonix-document"]`;
- không phụ thuộc vào `neonix.config.json`, CSS file hoặc manifest script khi đưa vào compiler.

`neonix.config.json` vẫn tồn tại ở authoring project. `neonix build` dùng file này để inject metadata vào `final.html`.

## 2. Contract cuối cùng

### 2.1 Final document

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="neonix-document"
      content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'
    />
    <style data-neonix-bundle>
      /* all authored CSS after bundling */
    </style>
  </head>
  <body>
    <!-- supported visual HTML -->
  </body>
</html>
```

### 2.2 Metadata contract

Compiler phải tìm chính xác một:

```html
<meta name="neonix-document" content="..." />
```

`content` phải là JSON object:

```json
{
  "kind": "neonix-html-document",
  "schemaVersion": 2,
  "composition": {
    "width": 1080,
    "height": 1080,
    "fps": 30,
    "background": "#081018",
    "colorSpace": "srgb"
  }
}
```

Rules:

- thiếu metadata: `html-document-metadata-missing`;
- có nhiều metadata: `html-document-metadata-duplicate`;
- JSON sai: `html-document-metadata-invalid`;
- `kind` sai: `html-document-kind-invalid`;
- `schemaVersion` khác `2`: `html-document-schema-unsupported`;
- composition sai: `html-composition-invalid`.

`schemaVersion: 2` là version của HTML document envelope. Protocol output vẫn dùng `formatVersion: 2` theo Protocol V2.

### 2.3 CSS contract

Final document được phép có các resource tag sau trong `<head>`:

- `meta`;
- `style`;
- `title` nếu cần hỗ trợ ở document shell, không lower thành layer.

Final document không được còn:

- `<link rel="stylesheet">` chưa resolve;
- CSS remote;
- `@import` remote;
- JavaScript runtime dependency;
- CSS file path không tồn tại.

Compiler thu thập nội dung của mọi `<style>` theo document order, nối thành một stylesheet logic, sau đó bỏ các `<style>` khỏi visual DOM trước khi parse layer.

`style="..."` inline trên visual element chưa nằm trong phase đầu. Nếu gặp, compiler báo `html-inline-style-unsupported`; sau này có thể thêm một phase normalize riêng.

## 3. API mục tiêu

### 3.1 Public compiler API

```ts
export type HtmlDocumentCompilerInput = Readonly<{
  html: string;
  fontAssets?: readonly HtmlCompilerFontAsset[];
  mediaAssets?: readonly HtmlCompilerMediaAsset[];
}>;

export function compileDocument(
  input: HtmlDocumentCompilerInput,
): HtmlCompilerResult;
```

API public không nhận `css` hoặc `config` riêng. Compiler lấy CSS và composition từ `html`.

### 3.2 Build API

Build layer chịu trách nhiệm biến authoring project thành final document:

```ts
buildHtmlDocument({
  html: readFile("src/scene.html"),
  cssFiles: [...],
  config: readJson("neonix.config.json"),
  components: [...],
});
```

Kết quả:

```ts
{
  html: string;
  diagnostics: HtmlCompilerDiagnostic[];
}
```

### 3.3 Compatibility API

Trong thời gian migration giữ các API sau:

```ts
compileProject({ html, css, config });
compileHtmlCss(source);
```

Chúng được đánh dấu deprecated và chỉ dùng để chạy fixture/test cũ trong thời gian chuyển đổi. Không thêm fixture mới dùng hai API này.

## 4. Pipeline compiler mới

```text
compileDocument({ html })
        ↓
validate document shell
        ↓
read meta[name="neonix-document"]
        ↓
validate schemaVersion 2 + composition
        ↓
collect <style> blocks
        ↓
remove metadata/resource nodes from visual DOM
        ↓
parse HTML visual tree
        ↓
parse combined CSS
        ↓
cascade / custom properties
        ↓
layout / typography / SVG / media
        ↓
HTML lowering
        ↓
Protocol V2 schema validation
```

Nên tách implementation thành các boundary:

```text
compiler/document/
  metadata.ts       # meta contract và schemaVersion 2
  resources.ts      # collect <style>, resource validation
  normalize.ts      # final HTML normalization

compiler/html/
  parser.ts
  dom-model.ts
  tags.ts
  lowering/

compiler/css/
  parser.ts
  cascade.ts
  values.ts
  animation.ts

compiler/pipeline/
  compile-document.ts
```

`compiler/html` và `compiler/css` vẫn là domain implementation. `compiler/document` trở thành boundary mới xử lý final HTML.

## 5. Future developer build layer (deferred)

The following section describes the later developer workflow only. It must not
block the current compiler, fixture or MCP migration. The current work may use
`createFinalHtml` in tests and an MCP-side document generator without adding a
build command to `create-neonix`.

### 5.1 Input authoring project

```text
project/
├── neonix.config.json
├── src/
│   ├── scene.html
│   ├── scene.css
│   └── components/
├── styles/
└── assets/
```

### 5.2 Build output

```text
dist/
└── <document-name>.html

Tên mặc định có thể là `final.html`, nhưng user được phép dùng `scene.html`,
`promo.html` hoặc tên HTML hợp lệ bất kỳ. Compiler không được phụ thuộc vào
file name; khi dùng API, compiler chỉ nhận HTML string hoặc file content.
```

Build phải:

1. đọc composition từ `neonix.config.json`;
2. resolve component HTML theo thứ tự;
3. resolve local CSS và `@import`;
4. nối stylesheet theo cascade order;
5. inline CSS vào một hoặc nhiều `<style data-neonix-bundle>`;
6. inject/update `meta[name="neonix-document"]`;
7. validate final HTML;
8. đảm bảo không còn local `<link>` hoặc remote dependency;
9. tạo hash ổn định cho final document;
10. ghi HTML output với tên mặc định `final.html` hoặc tên file do user cấu hình.

Build không được tự sửa visual HTML/CSS ngoài các bước normalize đã định nghĩa.

## 6. Preview Lab contract

Browser reference và compiler output phải dùng cùng một fixture HTML:

```text
fixture.html
   ├── Browser iframe
   └── compileDocument({ html: fixture.html })
```

Không còn tình trạng:

```text
Browser: html + css riêng
Compiler: source envelope html + css riêng
```

Preview case nên đổi thành:

```ts
export type HtmlCompilerPreviewCase = {
  id: string;
  phase: PreviewPhase;
  category: HtmlCompilerPreviewCategory;
  topic: HtmlCompilerPreviewTopic;
  label: string;
  properties: string[];
  hint: string;
  html: string;
  fontAssets?: HtmlCompilerFontAsset[];
  mediaAssets?: HtmlCompilerMediaAsset[];
  expected?: PreviewExpectation;
};
```

Không còn field `source: HtmlCssSource` trong fixture mới.

## 7. Fixture migration inventory

Các registry hiện tại cần migrate:

### 7.1 Core registry

File:

```text
apps/web/lib/docs/html-compiler-preview.ts
```

Nhiệm vụ:

- đổi `source` thành `html`;
- bỏ `createNewHtmlProject` và `createHtmlCssSource` khỏi fixture mới;
- thêm helper `createFinalHtml({ body, css, composition })` trong thời gian migration;
- helper phải tạo đúng meta schema V2 và `<style data-neonix-bundle>`;
- giữ font/media asset catalog riêng vì đây là runtime input, không nhúng binary vào fixture.

### 7.2 HTML tag fixtures

File:

```text
apps/web/lib/docs/html-compiler-tag-lowering-fixtures.ts
```

Migrate toàn bộ case:

- document shell/container;
- text tags;
- media;
- audio;
- SVG primitives;
- container aliases;
- text tag matrix;
- SVG primitive matrix.

Mỗi fixture phải có document hoàn chỉnh gồm `html`, `head`, metadata meta, style và body. Không dùng HTML fragment ghép với CSS ngoài fixture.

### 7.3 Text/layout fixtures

File:

```text
apps/web/lib/docs/html-compiler-text-compiler-layout-fixtures.ts
```

Migrate các case:

- `br-hard-break`;
- `nested-inline-content`;
- `whitespace-contract`;
- `fixed-line-height`;
- `wrap-width`;
- `auto-height`.

Mỗi case phải kiểm tra đồng thời:

- browser source dùng đúng final HTML;
- compiler đọc `<style>` inline;
- `hardBreaks`;
- `sourceRange` của nested spans;
- frame/layout JSON.

### 7.4 Các nhóm fixture còn lại

Trong `apps/web/lib/docs/html-compiler-preview.ts`, migrate tất cả case thuộc:

- composition và geometry;
- cascade và values;
- transform 2D;
- paint;
- media;
- typography;
- layout primitives;
- effects;
- transform/3D;
- animation/keyframes;
- combined pipeline.

Không tạo bản fixture mới song song cho cùng một behavior. Mỗi case phải được chuyển trực tiếp sang final HTML contract.

## 8. Fixture helper design

Tạo helper dùng chung, không copy thủ công metadata trong hàng trăm fixture:

```ts
type FinalHtmlOptions = {
  body: string;
  css: string;
  composition?: HtmlDocumentComposition;
  lang?: string;
};

function createFinalHtml(options: FinalHtmlOptions): string;
```

Helper phải:

- tạo `meta[name="neonix-document"]` với `schemaVersion: 2`;
- escape JSON đúng chuẩn HTML attribute;
- tạo một `<style data-neonix-bundle>`;
- tạo document shell ổn định;
- không tạo `neonix-manifest`;
- không thêm `<link>`;
- không thêm JavaScript;
- giữ body source theo đúng authored order.

Sau khi compiler hỗ trợ trực tiếp final HTML ổn định, nên thay helper bằng fixture literal hoặc fixture file để E2E kiểm tra chính xác artifact mà MCP sẽ tạo.

## 9. E2E test migration

### 9.1 Tag lowering E2E

File:

```text
apps/web/e2e/html-compiler-tag-lowering.spec.ts
```

Giữ nguyên danh sách case và expectation Protocol V2, nhưng bổ sung:

- kiểm tra fixture có đúng một `meta[name="neonix-document"]`;
- kiểm tra `schemaVersion === 2`;
- kiểm tra output composition khớp metadata;
- kiểm tra không còn diagnostic `html-document-*`;
- kiểm tra browser iframe và compiler dùng cùng source document.

### 9.2 Text/layout E2E

File:

```text
apps/web/e2e/html-compiler-text-compiler-layout.spec.ts
```

Giữ expectation về:

- `hardBreaks`;
- `source.text`;
- whitespace mode;
- line-height;
- width/height;
- nested inline spans.

Thêm case lỗi cho:

- thiếu metadata;
- metadata schema sai;
- metadata trùng;
- `<style>` sai type hoặc CSS parse lỗi.

## 10. Fixture file organization sau migration

Mục tiêu dài hạn:

```text
docs/preview/html-compiler/
├── README.md
├── documents/
│   ├── document-shell.html
│   ├── text-lowering.html
│   ├── svg-lowering.html
│   └── metadata-invalid.html
├── expected/
│   ├── document-shell.json
│   ├── text-lowering.json
│   └── svg-lowering.json
└── cases.ts
```

Giai đoạn đầu có thể giữ fixture TypeScript inline để giảm rủi ro. Sau khi contract compiler ổn định, chuyển những case quan trọng sang file `.html` thật để chúng giống output của MCP.

## 11. Compatibility và deprecation

### Giai đoạn chuyển tiếp

- `compileHtmlCss` vẫn chạy test cũ;
- `compileProject` vẫn nhận `html/css/config`;
- final document compiler chạy song song dưới feature boundary;
- fixture mới chỉ dùng final document.

### Điều kiện xóa legacy

Chỉ xóa khi:

- không còn preview fixture gọi `compileHtmlCss`;
- không còn E2E fixture chứa CSS ngoài HTML;
- không còn `neonix-source.json` trong CLI fixture;
- không còn `script#neonix-manifest` trong source/fixture/docs;
- `compileDocument` đã pass toàn bộ test matrix;
- `create-neonix` có build path tạo `final.html`.

## 12. Lộ trình implementation

### Phase 0 — Freeze contract

- [ ] Chốt metadata `meta[name="neonix-document"]`.
- [ ] Chốt `schemaVersion: 2`.
- [ ] Chốt `kind: neonix-html-document`.
- [ ] Chốt final HTML không dùng external stylesheet.
- [ ] Cập nhật `RULE.md` và compiler README.
- [ ] Giữ `final.html` ở root làm reference document.

### Phase 1 — Document metadata parser

- [ ] Tạo `compiler/document/metadata.ts`.
- [ ] Parse đúng một metadata meta tag.
- [ ] Validate schema/kind/composition.
- [ ] Thêm diagnostic ổn định.
- [ ] Viết unit test metadata positive/negative.

### Phase 2 — Style collection

- [ ] Cho phép `<style>` trong document shell.
- [ ] Thu thập nhiều `<style>` theo document order.
- [ ] Validate `type` và `data-neonix-bundle`.
- [ ] Nối CSS thành stylesheet logic.
- [ ] Không lower `<style>` thành visual layer.
- [ ] Thêm test nhiều style block/cascade order.

### Phase 3 — `compileDocument`

- [ ] Tạo type/API mới.
- [ ] Tách document normalization khỏi `compileHtmlCss`.
- [ ] Truyền composition từ metadata vào layout/context.
- [ ] Giữ font/media asset options.
- [ ] Validate Protocol V2 output.
- [ ] Thêm test compile `final.html` thực tế.

### Phase 4 — Migrate preview fixture helper

- [ ] Tạo `createFinalHtml`.
- [ ] Migrate phase 0/basic geometry.
- [ ] Migrate tag lowering fixtures.
- [ ] Migrate text/layout fixtures.
- [ ] Migrate CSS/cascade/layout fixtures.
- [ ] Migrate paint/effects/transform/media/animation fixtures.

### Phase 5 — Migrate E2E

- [ ] Browser iframe dùng fixture HTML duy nhất.
- [ ] Compiler dùng `compileDocument({ html })`.
- [ ] Thêm metadata assertions.
- [ ] Thêm invalid-document cases.
- [ ] So sánh browser composition với Protocol composition.

### Phase 6 — Future developer build and create-neonix (deferred)

This phase is intentionally postponed. Do not modify `create-neonix` build
behavior as part of the current final-document compiler migration.

- [ ] Tạo `buildHtmlDocument`.
- [ ] Inline CSS từ authoring project.
- [ ] Inject meta composition.
- [ ] Tạo HTML output với tên mặc định `final.html` và cho phép override tên file.
- [ ] Để `create-neonix` scaffold authoring project nhưng thêm build contract.
- [ ] Cập nhật README/AGENTS/RULE cho AI agent.

### Phase 7 — Remove legacy

- [ ] Xóa source envelope V1 khỏi public path.
- [ ] Xóa `compileHtmlCss` sau deprecation window.
- [ ] Xóa CSS tách rời khỏi compiler core.
- [ ] Xóa manifest parser legacy.
- [ ] Xóa fixture helper cũ.
- [ ] Cập nhật package exports và docs.

## 13. Acceptance criteria

For the current phase, acceptance applies only to `html-compiler`, Preview Lab
fixtures, AI-generated final documents and MCP compile/validate flows. A
developer project build and `create-neonix` integration are not acceptance
requirements and must be tracked separately for the deferred phase.

Refactor chỉ được coi là hoàn thành khi:

- AI có thể tạo một `final.html` hợp lệ chỉ bằng contract trong `RULE.md`;
- compiler chỉ cần `compileDocument({ html })`;
- CSS trong `<style>` được compile chính xác;
- metadata composition được đọc từ `meta[name="neonix-document"]`;
- Browser preview và compiler sử dụng cùng một HTML string;
- toàn bộ `/docs/preview/html-compiler` fixtures đã chuyển sang schema V2;
- tag lowering, CSS lowering và Protocol JSON expectations không giảm coverage;
- invalid metadata/style/document đều có diagnostic ổn định;
- HTML reference ở root (`final.html`) compile thành công sau khi Phase 1–3 hoàn tất; tên file không phải một phần của contract;
- `npm test`, `npm run typecheck`, lint và Playwright E2E đều pass.

## 14. Quy tắc thực hiện

- Không refactor toàn bộ fixture trước khi `compileDocument` và metadata parser có test độc lập.
- Không xóa compatibility API trong cùng commit với document parser.
- Mỗi nhóm fixture migrate phải giữ nguyên ID và expected Protocol nếu behavior không đổi.
- Khi behavior thay đổi vì schema mới, ghi rõ trong fixture expectation và changelog.
- Không thêm CSS/property/tag mới chỉ để làm migration pass.
- Final HTML là source contract của MCP; fixture nào không thể biểu diễn bằng final HTML phải được đánh dấu là legacy hoặc loại khỏi public preview.
