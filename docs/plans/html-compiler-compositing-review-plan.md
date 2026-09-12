# HTML Compiler — Multi-Layer Compositing Review Plan

## 1. Mục tiêu

Rà soát toàn bộ luồng HTML/CSS compiler khi nhiều layer được sử dụng trong cùng một scene.

Các fixture đơn lẻ hiện thường render đúng, nhưng scene tổng hợp có thể sai ở:

- paint order;
- layer tree và `parentLayerId`;
- opacity bị áp dụng nhiều lần;
- rounded shape bị tách thành các geometry chồng nhau;
- effect/filter bị áp dụng sai boundary;
- filter graph bị renderer đánh dấu unsupported;
- filter bounds bị crop hoặc ảnh hưởng nhầm đến sibling;
- sự khác biệt giữa Browser CSS, Runtime và Skia.

Mục tiêu cuối cùng là xác định chính xác lỗi thuộc lớp nào:

```text
HTML/CSS compiler
  → Protocol V2
  → Motion Runtime command buffer
  → Runtime effect program
  → Skia compositing/filter
  → final pixels
```

Không sửa thủ công từng fixture. Mọi thay đổi phải đi qua compiler/runtime contract và có regression test.

---

## 2. Phạm vi review

### Trong phạm vi

- HTML/CSS paint primitives khi kết hợp nhiều layer;
- opacity và alpha compositing;
- background, gradient, rounded shape, path và image;
- `box-shadow`, `text-shadow`, `filter`, `backdrop-filter`;
- blend mode và isolation;
- clip path, mask và effect boundary;
- layer order, nested group và sibling overlap;
- filter graph từ compiler đến Skia;
- filter bounds, offscreen surface và `saveLayer`;
- Browser CSS reference so với Runtime/Skia output;
- deterministic fixtures và pixel-level regression tests.

### Ngoài phạm vi giai đoạn đầu

- tối ưu playback buffer;
- thay đổi UI playground;
- thay đổi source of truth JSON V2;
- thay đổi kiến trúc MCP/API;
- tối ưu performance khi chưa xác định sai khác hình ảnh.

---

## 3. Các artifact bắt buộc phải thu thập

Mỗi fixture tổng hợp phải được kiểm tra ở cùng một frame/time và cùng composition:

| Artifact | Mục đích |
| --- | --- |
| Browser CSS screenshot | Ground truth trực quan từ trình duyệt |
| Compiled Protocol V2 | Xác nhận compiler sinh đúng layer/paint/effect |
| Runtime command buffer | Xác nhận thứ tự begin/draw/end và alpha |
| Runtime effect program | Xác nhận filter graph và input/output surface |
| Skia diagnostics/stats | Phát hiện filter unsupported, skipped command, crop |
| Skia screenshot | Kết quả raster cuối cùng |
| Pixel/sample diff | Đo sai khác có thể kiểm chứng |

Không kết luận lỗi chỉ dựa vào screenshot cuối cùng.

---

## 4. Phase 0 — Tạo baseline và instrumentation

### Mục tiêu

Có thể nhìn thấy chính xác dữ liệu đi qua từng tầng.

### Việc cần làm

- ghi lại `protocol.layers` theo thứ tự `order`;
- in `id`, `type`, `parentLayerId`, `frame`, `opacity`, `style`, `effects`;
- log Runtime commands theo từng layer;
- nhóm commands theo `beginLayer/endLayer`;
- log `effectProgram.ops` theo `input`, `output`, `kind`;
- thu thập Skia diagnostics:
  - `skia_effect_unsupported`;
  - `skia_backdrop_filter_unsupported`;
  - `skia_*_surface_*`;
  - `skippedCommands`;
  - filter cache hit/miss;
- xác định frame cố định để so sánh, ví dụ `frame = 0`, `frame = 15`, `frame = 30`.

### Tiêu chí hoàn thành

- Có thể truy ngược một pixel sai về layer và command tương ứng.
- Không cần debug bằng cách đoán từ screenshot.
- Diagnostics được lưu cùng fixture test.

---

## 5. Phase 1 — Review compiler layer tree

### File cần review

- `packages/html-compiler/src/compiler/pipeline/compile.ts`
- `packages/html-compiler/src/compiler/layout/*`
- `packages/html-compiler/src/compiler/paint.ts`
- `packages/html-compiler/src/compiler/filter.ts`

### Checklist

- Mỗi HTML element có đúng một logical layer hoặc group cần thiết.
- `parentLayerId` phản ánh đúng DOM/staking context.
- `order` giữ đúng CSS paint order.
- Nhiều background layers không đảo sai thứ tự.
- Border, outline, shadow và content không chiếm sai order band.
- Rounded background không phát ra các geometry chồng nhau.
- Child layer không bị đưa ra ngoài group của element.
- `z-index` không làm thay đổi sai thứ tự giữa các sibling.
- `opacity` của element không bị copy đồng thời vào group và paint child.
- `filter` và `box-shadow` được gắn đúng owner element.
- `backdrop-filter` được giữ riêng với foreground `filter`.

### Regression assertions

Mỗi fixture phải kiểm tra tối thiểu:

```ts
expect(layer.parentLayerId).toBe(expectedParent);
expect(layer.order).toBe(expectedOrder);
expect(layer.opacity).toBe(expectedOpacity);
expect(layer.effects).toEqual(expectedEffects);
```

Không chỉ kiểm tra `status === "success"`.

---

## 6. Phase 2 — Review paint primitive và geometry overlap

### Mục tiêu

Đảm bảo một CSS element được paint đúng số lần cần thiết.

### Case cần kiểm tra

- rectangle opacity;
- ellipse opacity;
- `border-radius: 50%`;
- non-uniform border radius;
- gradient opacity;
- image opacity;
- repeating grid opacity;
- shape chồng shape;
- shape chồng image;
- shape chồng text;
- border/outline cùng background;
- nhiều background layers trên một element.

### Invariants

- Một fill đơn không được tạo geometry trùng nhau nếu không có chủ ý.
- Các mảnh geometry liền kề không được làm alpha cộng dồn ở vùng giao nhau.
- Opacity của một element được composited một lần tại đúng boundary.
- Geometry local không bị cộng thêm `localX/localY` hai lần.
- `frame` và transform của từng paint pass dùng cùng coordinate space.
- Shape/path/image cùng kích thước phải có cùng origin khi được overlay.

### Tiêu chí hoàn thành

- Protocol không có duplicate geometry ngoài chủ ý.
- Fixture opacity shape có cùng alpha ở Browser và Skia trong vùng không anti-alias.
- Các vùng overlap có kết quả source-over đúng.

---

## 7. Phase 3 — Review Runtime command buffer

### File cần review

- `packages/motion-runtime/src/visual/evaluate.ts`
- `packages/motion-runtime/src/visual/effects.ts`
- `packages/motion-runtime/src/paint/paint-command.ts`
- `packages/motion-runtime/src/paint/validate-paint-command-buffer.ts`

### Checklist

- Mỗi layer effect có một cặp `beginLayer/endLayer` cân bằng.
- Mỗi drawable có đúng một `setTransform` trước draw command.
- `setTransform.alpha` không nhân opacity đã đặt ở effect surface lần nữa.
- Group opacity được áp dụng ở group boundary, không lặp ở child.
- `filter` dùng source surface của chính layer.
- `backdrop-filter` dùng backdrop capture đúng semantic boundary.
- Clip/mask wrapper không tạo thêm opacity ngoài ý muốn.
- Nested group có thứ tự command đúng.
- Sibling không bị đưa vào offscreen surface của layer khác.
- Layer inactive/fully clipped không để lại orphan transform hoặc effect scope.

### Test bắt buộc

- command sequence snapshot;
- begin/end balance;
- alpha propagation;
- nested group order;
- sibling isolation;
- filter layer ownership.

Ví dụ invariant:

```text
beginLayer(card)
  setTransform(card)
  drawShape(card)
endLayer(card)
```

Không chấp nhận:

```text
beginLayer(scene)
  beginLayer(card)
    setTransform(card)
    drawShape(card)
  endLayer(card)
endLayer(other-layer)
```

---

## 8. Phase 4 — Review effect program

### File cần review

- `packages/motion-runtime/src/visual/effects.ts`
- `packages/motion-runtime/src/visual/effect-program.ts`
- `packages/html-compiler/src/compiler/filter.ts`

### Mục tiêu

Xác nhận CSS effect được chuyển thành graph tuyến tính hoặc graph compositing hợp lệ.

### Checklist

- Thứ tự effect giữ nguyên như CSS.
- Mỗi operator có input/output surface hợp lệ.
- Source surface không bị ghi đè.
- Output cuối cùng reachable từ source.
- Không có duplicate output surface.
- `requiresOffscreen` khớp với loại effect.
- `filter: opacity()` không bị gộp nhầm với CSS `opacity`.
- `drop-shadow()` dùng alpha silhouette đúng.
- `box-shadow` dùng box geometry đúng.
- `backdrop-filter` không bị nối vào foreground filter graph.
- Nhiều shadow dùng đúng source owner theo CSS.

### Ma trận filter cần kiểm tra

| Case | Kỳ vọng |
| --- | --- |
| `blur()` | Một spatial filter |
| `brightness() contrast()` | Ordered color-adjust chain |
| `grayscale() sepia() invert()` | Ordered color-matrix chain |
| `opacity()` | Alpha operator riêng |
| `drop-shadow()` | Alpha → blur → tint → offset → composite |
| `blur() drop-shadow()` | Shadow lấy source từ blur output |
| `box-shadow + filter` | Hai semantics không bị nhập sai |
| `opacity + filter` | Layer alpha và filter alpha tách biệt |
| `filter + backdrop-filter` | Foreground và backdrop tách surface |
| nhiều filter trên nhiều sibling | Không dùng chung source surface |

### Tiêu chí hoàn thành

- Effect graph được snapshot trong test.
- Graph unsupported bị báo lỗi/diagnostic rõ ràng, không silently fallback.
- Mỗi graph hợp lệ có renderer test tương ứng.

---

## 9. Phase 5 — Review Skia saveLayer và filter bounds

### File cần review

- `packages/skia-renderer/src/command/replay.ts`
- `packages/skia-renderer/src/command/effects.ts`
- `packages/skia-renderer/src/command/geometry.ts`

### Checklist

- `saveLayer` được tạo đúng cho effect cần offscreen.
- Foreground filter chỉ nhận pixels của layer hiện tại.
- Backdrop filter nhận đúng pixels phía sau layer.
- `compositeAlpha` chỉ áp dụng một lần khi kết thúc layer.
- Filter output không bị crop theo bounds quá nhỏ.
- Shadow/blur được phép mở rộng ra ngoài geometry owner.
- Filter không làm thay đổi paint order với sibling.
- Canvas save/restore cân bằng.
- Paint/filter resource được delete đúng vòng đời.
- Unsupported filter không bị vẽ như output “đúng” mà không diagnostic.

### Đặc biệt kiểm tra

Việc sử dụng composition bounds lớn trong `saveLayer` có thể:

- làm tăng chi phí render;
- che giấu lỗi local bounds;
- làm khó xác định filter đang nhận input nào;
- tạo sai khác khi có backdrop filter hoặc blend mode.

Phải phân biệt rõ:

```text
layer content bounds
filter-expanded bounds
composition bounds
```

Không dùng composition bounds cho mọi filter nếu không cần thiết.

---

## 10. Phase 6 — Xây combined production fixtures

Tạo bộ fixture riêng cho scene tổng hợp, không lấy nguyên trạng từ primitive fixtures.

**Tất cả fixtures HTML (primitive lẫn combined) viết dưới `public`**, cùng convention với Phase 2/4 — không dùng `apps/web/lib/docs/fixtures/`.

Thư mục bắt buộc:

```text
apps/web/public/playground/fixtures/
```

Quy ước đặt tên (khớp Phase 2/4):

```text
phase6-alpha-overlap.html
phase6-foreground-effects.html
phase6-filter-chain.html
phase6-backdrop-isolation.html
phase6-nested-groups.html
```

URL phục vụ qua `/playground/fixtures/<file>` và đăng ký case trong `apps/web/lib/playground/html-playground-cases.ts` (dùng `fixtureUrl(...)`, gắn `nativeStage: true` khi cần so Browser/Skia trên native-stage).

### Fixture A — Alpha and overlap

- nền grid opacity thấp;
- rounded rectangle;
- ellipse tím opacity trung bình;
- yellow rotated rectangle;
- image opacity;
- text nằm trên cùng.

Kiểm tra alpha không bị cộng dồn do geometry duplicate.

### Fixture B — Foreground effects

- card có `box-shadow`;
- card có `filter: blur()`;
- card có `filter: brightness() contrast()`;
- card có `opacity`;
- các card chồng nhau.

Kiểm tra filter chỉ tác động đến owner layer.

### Fixture C — Filter chain

- `blur() brightness() contrast()`;
- `grayscale() opacity()`;
- `blur() drop-shadow()`;
- nhiều sibling có filter khác nhau.

Kiểm tra thứ tự operator và source/output surface.

### Fixture D — Backdrop and isolation

- gradient background;
- translucent glass card;
- `backdrop-filter: blur() contrast()`;
- foreground `filter` riêng;
- sibling phía trước và phía sau.

Kiểm tra backdrop không bị lấy nhầm từ foreground hoặc toàn scene.

### Fixture E — Nested groups

- scene group có opacity;
- child group có filter;
- child shape có opacity;
- sibling bên ngoài group có blend mode;
- clip path hoặc mask.

Kiểm tra alpha và isolation boundary theo từng cấp.

---

## 11. Phase 7 — Pixel comparison và diagnostics

### Cách so sánh

Mỗi fixture phải render tại các frame cố định:

- frame đầu;
- frame giữa;
- frame cuối nếu có animation.

So sánh theo ba mức:

1. **Contract diff** — Protocol và Runtime command.
2. **Diagnostic diff** — unsupported/skipped/error.
3. **Pixel diff** — Browser CSS so với Skia.

### Pixel sampling

Không chỉ dùng toàn ảnh. Lấy mẫu tại:

- vùng màu phẳng của từng layer;
- vùng overlap giữa hai layer;
- vùng overlap giữa ba layer;
- biên rounded shape;
- vùng blur/shadow mở rộng;
- vùng backdrop filter;
- vùng text và image.

Vùng màu phẳng dùng để kiểm tra opacity. Vùng biên dùng để kiểm tra anti-aliasing và geometry.

### Quy tắc kết luận

| Quan sát | Nghi ngờ chính |
| --- | --- |
| Protocol đã sai layer/opacity | HTML compiler |
| Protocol đúng, Runtime command sai | Motion Runtime |
| Command đúng nhưng có `unsupported` | Skia effect support/graph |
| Command đúng, effect đúng, pixels sai | Skia compositing/raster |
| Chỉ sai ở overlap | duplicate geometry hoặc alpha boundary |
| Chỉ sai khi có filter | effect graph, saveLayer hoặc bounds |
| Chỉ sai khi có backdrop | backdrop capture/isolation |

---

## 12. Phase 8 — Regression test bắt buộc

### HTML compiler

- layer tree snapshot;
- paint order;
- parent/child relation;
- duplicate geometry detection;
- opacity preservation;
- effect/filter lowering;
- backdrop filter separation.

### Motion Runtime

- command order snapshot;
- begin/end balance;
- opacity applied once;
- nested isolation;
- effect graph validation;
- source/output surface ownership.

### Skia renderer

- effect graph support matrix;
- unsupported diagnostics;
- saveLayer alpha;
- filter bounds;
- source-over overlap;
- clip/mask with filter;
- multiple sibling effects.

### E2E playground

- load each combined fixture;
- compile successfully;
- wait until preview is ready;
- render Browser and Skia at the same time;
- verify no runtime diagnostic;
- verify play/pause and seek do not change visual contract.

---

## 13. Thứ tự sửa lỗi

Không sửa Skia trước khi xác nhận Protocol và Runtime command đúng.

Thứ tự ưu tiên:

1. duplicate geometry và paint order;
2. parent/group/isolation boundary;
3. opacity applied more than once;
4. effect graph bị unsupported;
5. filter order và source surface;
6. saveLayer/filter bounds;
7. anti-aliasing và pixel-level tuning;
8. performance optimization.

Mỗi bug phải có:

- fixture tái hiện;
- artifact trước sửa;
- root cause;
- patch ở đúng tầng;
- regression test;
- artifact sau sửa.

---

## 14. Definition of Done

Review được xem là hoàn thành khi:

- combined fixtures có coverage cho opacity, overlap, shadow, filter, backdrop-filter và nested group;
- không còn duplicate geometry ngoài chủ ý;
- không còn effect bị silently bỏ qua;
- tất cả effect graph hợp lệ đều có diagnostic/stats rõ ràng;
- Browser, Protocol, Runtime và Skia có thể đối chiếu cùng một frame;
- opacity được áp dụng đúng một lần ở mỗi compositing boundary;
- foreground filter không ảnh hưởng sibling;
- backdrop filter lấy đúng backdrop;
- filter bounds không crop output;
- compiler, runtime, renderer và E2E tests đều pass;
- mọi sai khác còn lại được ghi rõ là giới hạn đã biết, không bị bỏ qua.

