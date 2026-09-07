# HTML Compiler Refactor Plan

## Mục tiêu

Refactor `packages/html-compiler` từ cấu trúc hiện tại, nơi phần lớn pipeline
đang tập trung trong `src/index.ts`, thành kiến trúc tách biệt theo domain:

```text
HTML parser + CSS parser
          ↓
   computed styles
          ↓
      layout
          ↓
 visual/audio lowering
          ↓
   Protocol V2 JSON
```

Mục tiêu của đợt refactor này là thay đổi cấu trúc code, không thay đổi
behavior hoặc Protocol V2 output.

## Phạm vi

Bao gồm:

- Tách HTML domain khỏi CSS domain.
- Tách layout engine khỏi lowering.
- Tách text, media, audio, SVG và paint lowering.
- Tạo `CompileContext` và `LayoutState` dùng chung.
- Biến `src/index.ts` thành public facade mỏng.
- Giữ nguyên public API, diagnostics và Protocol V2 output.

Không bao gồm:

- Thay đổi schema Protocol V2.
- Thay đổi CSS semantics.
- Thêm CSS property hoặc HTML tag mới chỉ vì refactor.
- Thay đổi renderer, runtime hoặc export pipeline.

## Baseline cần giữ nguyên

Trước khi bắt đầu refactor, cần chạy:

```bash
pnpm --filter @motionvideo/html-compiler typecheck
pnpm --filter @motionvideo/html-compiler test
```

Các invariant phải được giữ nguyên:

- `compileHtmlCss()` vẫn là public API.
- Layer ID không thay đổi.
- Layer order không thay đổi.
- Asset ID không thay đổi.
- Diagnostic code không thay đổi.
- Animation track path không thay đổi.
- Protocol V2 output không thay đổi.
- CLI hiện tại vẫn compile được fixture.

Nên bổ sung contract test hoặc snapshot cho:

- composition;
- layer IDs và layer types;
- asset IDs;
- audio track IDs;
- animation track paths;
- các fixture đại diện cho HTML, layout, paint, media, SVG và animation.

## Cấu trúc đích

```text
packages/html-compiler/src/
├─ index.ts
├─ source.ts
└─ compiler/
   ├─ html/
   │  ├─ parser.ts
   │  ├─ manifest.ts
   │  ├─ tags.ts
   │  └─ dom-model.ts
   │
   ├─ css/
   │  ├─ parser.ts
   │  ├─ selectors.ts
   │  ├─ cascade.ts
   │  ├─ values.ts
   │  ├─ animation.ts
   │  └─ typography.ts
   │
   ├─ layout/
   │  ├─ engine.ts
   │  ├─ geometry.ts
   │  ├─ flex.ts
   │  ├─ grid.ts
   │  └─ layout-ir.ts
   │
   ├─ lowering/
   │  ├─ node.ts
   │  ├─ text.ts
   │  ├─ media.ts
   │  ├─ audio.ts
   │  ├─ svg.ts
   │  ├─ paint.ts
   │  ├─ effects.ts
   │  └─ assets.ts
   │
   ├─ protocol/
   │  └─ finalize.ts
   │
   ├─ pipeline/
   │  ├─ prepare.ts
   │  ├─ resolve-styles.ts
   │  └─ compile.ts
   │
   └─ shared/
      ├─ errors.ts
      └─ utils.ts
```

Không cần tạo một file riêng cho từng HTML tag. Nên tách theo domain và
semantic responsibility.

## Dependency rules

```text
html       không import css/layout/protocol
css        có thể import html/dom-model, không import protocol
layout     import html + css
lowering   import html + css + layout + protocol
pipeline   import tất cả các phase
index      chỉ import pipeline/source
```

Không được tạo dependency vòng:

```text
html → css → layout → html
```

## Phase 0 — Baseline và contract tests

### Công việc

1. Chạy typecheck và test hiện tại.
2. Ghi nhận số lượng test và các lỗi đã tồn tại trước refactor.
3. Bổ sung contract test cho Protocol V2 output quan trọng.
4. Không di chuyển code trong phase này.

### Kết quả cần đạt

- Có baseline rõ ràng.
- Biết chính xác test nào bảo vệ behavior nào.
- Có thể phát hiện output thay đổi sau mỗi phase.

## Phase 1 — Tách HTML domain

### Chuyển module

| Hiện tại | Đích |
|---|---|
| `compiler/html.ts` | `compiler/html/parser.ts` |
| `neonixManifest()` | `compiler/html/manifest.ts` |
| `withoutNeonixManifest()` | `compiler/html/manifest.ts` |
| `SUPPORTED_TAGS` | `compiler/html/tags.ts` |
| `TEXT_TAGS` | `compiler/html/tags.ts` |
| `Node` | `compiler/html/dom-model.ts` |
| `EXPLICIT_ID` | `compiler/html/dom-model.ts` |
| `CLASS_TOKEN` | `compiler/html/dom-model.ts` |

### Ràng buộc

`html/` chỉ chịu trách nhiệm:

- parse HTML subset;
- tag allowlist;
- attributes;
- identity;
- content order;
- manifest.

`html/` không được biết về CSS parser, layout hoặc Protocol V2.

### Kết quả cần đạt

- Parser có thể test độc lập.
- HTML AST không phụ thuộc vào CSS hoặc renderer.
- Các test normalization hiện tại vẫn pass.

## Phase 2 — Tách CSS domain

### Chuyển module

```text
compiler/css-parser.ts       → compiler/css/parser.ts
compiler/cascade.ts          → compiler/css/cascade.ts
compiler/cascade-values.ts   → compiler/css/cascade-values.ts
compiler/values.ts           → compiler/css/values.ts
compiler/typography.ts       → compiler/css/typography.ts
compiler/animation.ts        → compiler/css/animation.ts
```

### Output của CSS phase

CSS phase nên tạo computed style, không trực tiếp push Protocol layer:

```ts
type ComputedStyleMap = Map<HtmlNode, Style>;
```

CSS phase chịu trách nhiệm:

- CSS parsing;
- selector matching;
- specificity;
- cascade;
- inheritance;
- custom properties;
- unit/value resolution;
- animation declaration parsing;
- typography style resolution.

### Kết quả cần đạt

- CSS tests có thể chạy không cần Protocol renderer.
- Selector, cascade và values không phụ thuộc vào layout engine.
- Các test cascade/values/animation hiện tại vẫn pass.

## Phase 3 — Tạo CompileContext

Hiện tại nhiều state nằm trong closure của `compileHtmlCss()`. Gom các state
này thành context dùng chung:

```ts
export type CompileContext = {
  source: HtmlCssSource;
  options: HtmlCompilerOptions;
  composition: HtmlCssComposition;
  root: HtmlNode;
  styles: Map<HtmlNode, Style>;

  layers: MotionProtocolV2["layers"];
  assets: NonNullable<MotionProtocolV2["assets"]>;
  audioTracks: MotionProtocolV2["audio"]["tracks"];
  clipPaths: NonNullable<MotionProtocolV2["clipPaths"]>;
  masks: NonNullable<MotionProtocolV2["masks"]>;

  layout: LayoutState;
};
```

Tách layout state riêng:

```ts
export type LayoutState = {
  origins: Map<HtmlNode, { x: number; y: number }>;
  sizes: Map<HtmlNode, { width: number; height: number }>;
  layoutBoxes: Map<HtmlNode, LayoutBox>;
  layoutOverrides: Map<HtmlNode, LayoutOverride>;
  anchorBoxes: Map<string, LayoutRect>;
};
```

Không để các lowerer tự tạo output collection riêng. Tất cả layer, asset,
clip path và audio track phải đi qua context hoặc registry tương ứng.

## Phase 4 — Tách asset registry

Chuyển logic đăng ký và deduplicate asset ra:

```text
compiler/lowering/assets.ts
```

API dự kiến:

```ts
const assets = createAssetRegistry(options);

const imageId = assets.registerImage(node, uri);
const videoId = assets.registerVideo(node, uri);
const audioId = assets.registerAudio(node, uri);
const fontIds = assets.registerFonts(fontAssets);
```

Phải giữ nguyên:

- format asset ID;
- asset deduplication;
- catalog lookup;
- font asset mapping;
- media metadata.

## Phase 5 — Tách lowering

Tạo dispatcher chung:

```ts
export function lowerNode(
  node: HtmlNode,
  context: CompileContext,
  layout: ResolvedNodeLayout,
): void {
  if (node.tag === "img") return lowerImage(node, context, layout);
  if (node.tag === "video") return lowerVideo(node, context, layout);
  if (node.tag === "audio") return lowerAudio(node, context, layout);
  if (isTextNode(node)) return lowerText(node, context, layout);
  if (isSvgPrimitive(node)) return lowerSvg(node, context, layout);

  return lowerContainer(node, context, layout);
}
```

### Mapping module

| Trách nhiệm | Module đích |
|---|---|
| Text layer | `lowering/text.ts` |
| Image/video | `lowering/media.ts` |
| Audio track | `lowering/audio.ts` |
| SVG/path/primitives | `lowering/svg.ts` |
| Container/group | `lowering/node.ts` |
| Background/gradient | `lowering/paint.ts` |
| Border/outline | `lowering/paint.ts` hoặc `lowering/border.ts` |
| Filter/shadow/mask/blend | `lowering/effects.ts` |
| Asset registration | `lowering/assets.ts` |

`lowering/` có thể import Protocol V2 vì đây là nơi chuyển semantic source
thành protocol output.

## Phase 6 — Tách layout engine

Đây là phase có rủi ro cao nhất, nên thực hiện sau HTML, CSS và lowering đã
được tách.

Chuyển:

```text
layoutFlowChildren()
layout()
```

ra:

```text
compiler/layout/engine.ts
```

API dự kiến:

```ts
export function resolveLayout(
  root: HtmlNode,
  styles: Map<HtmlNode, Style>,
  options: LayoutOptions,
): LayoutResult;
```

Kết quả:

```ts
type LayoutResult = {
  nodes: Map<HtmlNode, ResolvedNodeLayout>;
  anchors: Map<string, LayoutRect>;
};
```

Layout engine chỉ tính:

- position;
- width/height;
- parent relationship;
- flex/grid placement;
- containing block;
- overflow geometry;
- transform origin cơ bản.

Layout engine không tạo Protocol layer.

## Phase 7 — Tách pipeline

Tạo các module:

```text
compiler/pipeline/prepare.ts
compiler/pipeline/resolve-styles.ts
compiler/pipeline/compile.ts
compiler/protocol/finalize.ts
```

Pipeline cuối cùng:

```ts
export function compileHtmlCss(
  source: HtmlCssSource,
  options: HtmlCompilerOptions = {},
): HtmlCompilerResult {
  try {
    const prepared = prepareSource(source, options);
    const styles = resolveStyles(prepared);
    const layout = resolveLayout(prepared.root, styles, prepared);
    const context = createCompileContext(prepared, styles, layout);

    lowerDocument(context);
    return finalizeProtocol(context);
  } catch (error) {
    return toDiagnosticResult(source, error);
  }
}
```

Sau phase này, `src/index.ts` chỉ còn là facade:

```ts
export { compileHtmlCss } from "./compiler/pipeline/compile";

export {
  DEFAULT_HTML_CSS_COMPOSITION,
  DEFAULT_NEONIX_HTML_DOCUMENT,
  createHtmlCssSource,
  createNewHtmlProject,
} from "./source";

export type * from "./source";
```

## Phase 8 — Tổ chức test

Giữ integration tests import từ public API:

```ts
import { compileHtmlCss } from "../index";
```

Thêm unit tests theo domain:

```text
html/parser.test.ts
css/cascade.test.ts
css/values.test.ts
layout/engine.test.ts
lowering/text.test.ts
lowering/media.test.ts
lowering/audio.test.ts
lowering/svg.test.ts
pipeline/compile.test.ts
```

Phân loại test:

| Loại test | Mục đích |
|---|---|
| HTML parser | tag, attribute, identity, content order |
| CSS | selector, cascade, variable, unit |
| Layout | geometry độc lập với Protocol |
| Lowering | node → layer/asset/track |
| Integration | HTML + CSS → Protocol V2 |
| Contract | giữ nguyên output trước và sau refactor |

## Thứ tự commit đề xuất

```text
1. test: add html compiler output baseline
2. refactor: extract html domain modules
3. refactor: extract css domain modules
4. refactor: introduce compile context
5. refactor: extract asset registry
6. refactor: extract text/media/audio lowering
7. refactor: extract svg/paint/effects lowering
8. refactor: extract layout engine
9. refactor: move compile pipeline out of index
10. docs: update html compiler architecture
```

Mỗi commit phải chạy:

```bash
pnpm --filter @motionvideo/html-compiler typecheck
pnpm --filter @motionvideo/html-compiler test
```

## Rủi ro và cách kiểm soát

### Thay đổi layer order

Giữ nguyên thứ tự traversal và `layerOrder`. Dùng integration snapshot để phát
hiện thay đổi.

### Thay đổi asset ID

Không thay đổi công thức tạo ID trong lúc di chuyển. Chỉ chuyển logic sang
registry trước, tối ưu sau.

### Circular dependency

Tuân thủ dependency rules. Nếu cần type dùng chung, đưa type vào `html/dom-model`
hoặc `shared/`, không import ngược pipeline.

### Thay đổi diagnostic

Giữ nguyên error code và message trong giai đoạn đầu. Việc chuẩn hóa diagnostic
nên là một task riêng.

### Refactor quá lớn

Mỗi phase phải compile và test được độc lập. Không di chuyển toàn bộ
`index.ts` trong một commit.

## Tiêu chí hoàn thành

Refactor hoàn tất khi:

- `index.ts` còn khoảng 30–80 dòng.
- `compileHtmlCss()` nằm trong pipeline module.
- `html/`, `css/`, `layout/`, `lowering/` không có circular dependency.
- Toàn bộ test hiện tại vẫn pass.
- Protocol V2 output không thay đổi.
- CLI vẫn hoạt động.
- Public import cũ vẫn hoạt động.
- Mỗi lowerer chính có unit test riêng.
- README và package structure phản ánh đúng implementation thực tế.
