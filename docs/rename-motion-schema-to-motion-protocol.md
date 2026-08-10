# Kế hoạch đổi tên: `motion-schema` → `motion-protocol`

> **Phạm vi:** Đổi tên thư mục `packages/motion-schema` → `packages/motion-protocol` và package name `@motionvideo/motion-schema` → `@motionvideo/motion-protocol` trên toàn monorepo.
>
> **Hiện trạng:** ~130 file tham chiếu `@motionvideo/motion-schema` hoặc `motion-schema` (import, package.json, tsconfig paths, vitest aliases, scripts, docs).
>
> **Ngày tạo:** 2026-08-10

---

## Mục tiêu

1. Đổi tên package mà **không phá build** ở bất kỳ bước kiểm chứng nào.
2. Mọi tham chiếu (import path, dependency, alias, script, tài liệu) được cập nhật nhất quán.
3. Test suite đầy đủ (566+ tests) vẫn pass sau khi đổi tên.

## Rủi ro chính

| Rủi ro                                          | Tác động               | Giảm thiểu                                                     |
| ----------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| Lockfile lệch với package.json                  | `pnpm install` fail CI | Chạy `pnpm install --no-frozen-lockfile` sau khi sửa manifests |
| Alias trong vitest/vite/tsconfig còn trỏ tên cũ | Test fail ngẫu nhiên   | Checklist grep từng loại file config                           |
| Docs/scripts tham chiếu đường dẫn thư mục cũ    | Script crash khi chạy  | Grep `motion-schema` cả nội dung file                          |
| Import type vs import value sót                 | Typecheck fail         | Chạy typecheck toàn workspace                                  |

---

## Task 1 — Chuẩn bị & kiểm kê

**Mục tiêu:** Có danh sách đầy đủ mọi điểm cần sửa trước khi đụng code.

- [ ] 1.1. Đảm bảo working tree sạch (`git status`) — tạo branch `chore/rename-motion-protocol`.
- [ ] 1.2. Grep toàn workspace, xuất danh sách file tham chiếu:
  - `rg -l "@motionvideo/motion-schema"` (import + manifests)
  - `rg -l "motion-schema"` (alias, đường dẫn, scripts, docs)
- [ ] 1.3. Phân loại kết quả thành 5 nhóm:
  1. `packages/motion-schema/**` (bản thân package)
  2. `package.json` của các package/app phụ thuộc
  3. File config: `tsconfig*.json`, `vitest.config.ts`, `vite.config.ts`, `eslint.config.mjs`
  4. Source code import (`.ts`, `.tsx`)
  5. Docs/scripts: `*.md`, `scripts/*`
- [ ] 1.4. Ghi nhận các thư mục **loại trừ** khỏi rename: `node_modules_broken_pr2/`, `dist-renderer/`, `release/`, mọi `node_modules/`.

**Sản phẩm:** Danh sách file theo nhóm, commit lên branch (file này tick dần).

---

## Task 2 — Đổi tên thư mục & package name

**Mục tiêu:** Package tự nhận tên mới.

- [ ] 2.1. `git mv packages/motion-schema packages/motion-protocol`
- [ ] 2.2. Sửa [packages/motion-protocol/package.json](../packages/motion-protocol/package.json): `"name": "@motionvideo/motion-protocol"`.
- [ ] 2.3. Grep **bên trong** package mới xem có self-reference tên cũ không (README, comment, chuỗi `"motion-schema"` trong schema ID, error message, diagnostic code prefix…). Quyết định giữ/đổi:
  - Chuỗi runtime (ví dụ `schemaVersion`, diagnostic codes) — **đánh giá tương thích dữ liệu cũ** trước khi đổi; nếu là định danh dữ liệu đã lưu của ngưởi dùng thì GIỮ NGUYÊN, chỉ đổi tên package.
- [ ] 2.4. Chạy test riêng của package: `pnpm --filter @motionvideo/motion-protocol test` — phải pass.

**Sản phẩm:** Package đổi tên xong, test nội bộ xanh.

---

## Task 3 — Cập nhật manifests của các package phụ thuộc

**Mục tiêu:** Mọi `package.json` trỏ dependency tên mới.

- [ ] 3.1. Tìm tất cả `"@motionvideo/motion-schema": "workspace:*"` trong workspace (đã biết tối thiểu: [apps/desktop/package.json](../apps/desktop/package.json), [apps/remotion-site/package.json](../apps/remotion-site/package.json); kiểm tra thêm `apps/render-worker`, `apps/web`, và toàn bộ `packages/*`).
- [ ] 3.2. Replace hàng loạt: `"@motionvideo/motion-schema"` → `"@motionvideo/motion-protocol"` trong mọi `package.json`.
- [ ] 3.3. Kiểm tra `pnpm-workspace.yaml` — nếu liệt kê package theo tên, cập nhật.
- [ ] 3.4. Chạy `pnpm install --no-frozen-lockfile` để lockfile tái tạo.
- [ ] 3.5. Verify: `pnpm why @motionvideo/motion-schema` phải ra rỗng; `pnpm why @motionvideo/motion-protocol` hiện đúng đồ thị phụ thuộc.

**Sản phẩm:** Install sạch, lockfile mới, không còn tên cũ trong manifests.

---

## Task 4 — Cập nhật cấu hình build/test (aliases & paths)

**Mục tiêu:** Mọi alias resolve về thư mục mới.

- [ ] 4.1. Sửa mọi `vitest.config.ts` có alias (đã biết: [apps/desktop/vitest.config.ts](../apps/desktop/vitest.config.ts#L16)) — đổi cả key `"@motionvideo/motion-schema"` và path `packages/motion-schema`.
- [ ] 4.2. Kiểm tra `vite.config.ts` (desktop renderer, web) tương tự.
- [ ] 4.3. Kiểm tra mọi `tsconfig*.json` có `paths` trỏ `motion-schema`.
- [ ] 4.4. Kiểm tra `eslint.config.mjs` nếu có rule import theo tên package.
- [ ] 4.5. Grep xác nhận: `rg "motion-schema" --type-add 'cfg:*.{json,ts,mjs,yaml,yml}' -t cfg` chỉ còn kết quả trong docs/scripts chưa xử lý.

**Sản phẩm:** Toàn bộ alias/paths sạch tên cũ.

---

## Task 5 — Cập nhật import trong source code

**Mục tiêu:** ~100+ file `.ts/.tsx` import tên mới.

- [ ] 5.1. Replace hàng loạt trong source (loại trừ thư mục ở Task 1.4):
      `rg -l "@motionvideo/motion-schema" -g '!node_modules*' | xargs sed -i 's/@motionvideo\/motion-schema/@motionvideo\/motion-protocol/g'`
      (hoặc dùng công cụ find/replace của editor cho an toàn trên Windows).
- [ ] 5.2. Review diff — đảm bảo không đụng chuỗi runtime nào ngoài import/require/module specifier.
- [ ] 5.3. Typecheck toàn workspace: `pnpm -r typecheck` (hoặc script tương đương) — 0 lỗi.
- [ ] 5.4. Build các app chính: desktop, web, render-worker (nếu có script build).

**Sản phẩm:** Typecheck xanh toàn workspace.

---

## Task 6 — Cập nhật scripts & tooling

- [ ] 6.1. Grep `motion-schema` trong [scripts/](../scripts/) — cập nhật đường dẫn/import (ví dụ `validate-*.ts`, `dump-capability-ledger.ts`, `benchmark-engine.ts` nếu có).
- [ ] 6.2. Kiểm tra [docs/capability-ledger.json](../docs/capability-ledger.json) và các file generated — quyết định regenerate hay sửa tay.
- [ ] 6.3. Kiểm tra config CI (GitHub Actions / tương đương) nếu filter theo tên package (`--filter @motionvideo/motion-schema`).

**Sản phẩm:** Scripts chạy được với tên mới.

---

## Task 7 — Cập nhật tài liệu

- [ ] 7.1. Cập nhật [README.md](../README.md), [json-project-design.md](../json-project-design.md), [web-architechture.md](../web-architechture.md), [docs/adr-timeline-canonical.md](../docs/adr-timeline-canonical.md) và mọi `.md` còn nhắc tên cũ.
- [ ] 7.2. Ghi chú trong CHANGELOG / capability-ledger về breaking rename (nếu repo có quy ước).

**Sản phẩm:** Docs nhất quán.

---

## Task 8 — Kiểm chứng cuối & merge

- [ ] 8.1. `rg -i "motion-schema"` toàn workspace → chỉ còn: (a) chuỗi runtime cố ý giữ (Task 2.3), (b) bản ghi lịch sử trong file kế hoạch này.
- [ ] 8.2. Chạy full test suite từng package trọng yếu: `motion-protocol`, `playback-engine`, `motion-runtime`, `motion-compiler`, `editor-core`, `pixi-renderer`, `remotion-renderer`, `apps/desktop` — tổng ≥ 566 tests pass.
- [ ] 8.3. Smoke: mở desktop app, load một project fixture, export render thử.
- [ ] 8.4. Commit theo từng task (hoặc squash 1 commit): `chore: rename @motionvideo/motion-schema → @motionvideo/motion-protocol`.
- [ ] 8.5. Mở PR, CI xanh, merge.

---

## Lệnh rollback

```powershell
git reset --hard <commit-truoc-rename>
pnpm install --frozen-lockfile
```

## Ước lượng

| Task              | Khối lượng       | Thởi gian dự kiến |
| ----------------- | ---------------- | ----------------- |
| 1. Kiểm kê        | grep + phân loại | 15 phút           |
| 2. Rename package | 1 thư mục        | 15 phút           |
| 3. Manifests      | ~10-20 file      | 20 phút           |
| 4. Config aliases | ~5-10 file       | 20 phút           |
| 5. Source imports | ~100+ file       | 30 phút           |
| 6. Scripts        | vài file         | 15 phút           |
| 7. Docs           | vài file         | 15 phút           |
| 8. Kiểm chứng     | full test        | 30-60 phút        |
| **Tổng**          | ~130 file        | **~3 giờ**        |
