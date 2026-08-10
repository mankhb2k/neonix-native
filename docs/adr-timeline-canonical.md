# ADR 001 — Canonical Timeline Source of Truth

> Status: Accepted
> Date: 2026-08-10
> Deciders: Core engine team

## Context

`TimelineDocument` hiện tại chứa cả `project: MotionProject` và `lanes: TimelineLane[]` + `clips: TimelineClip[]`. Đây là **hai model song song** được đồng bộ thủ công:

- **Project → Lanes/Clips**: `sceneOrderToTimelineClips()` / `migrateLanesAndClips()` tạo lanes/clips từ `project.timeline.sceneOrder`
- **Lanes/Clips → Project**: `rebuildMainProject()` tạo lại `project.timeline.sceneOrder` từ base lane clips

Mỗi `TimelineCommand` hiện tại sửa **cả hai** model cùng lúc trong command runner. Điều này gây ra:

1. **Drift risk**: Hai model có thể lệch nhau nếu một command quên cập nhật một bên
2. **Không có single source of truth**: Không rõ model nào là canonical khi có conflict
3. **Khó test**: Muốn test projection cần mock cả hai model
4. **Không deterministic**: Cùng project có thể cho TimelineDocument khác nhau tùy migration path

## Decision

**Chọn phương án (B): giữ `lanes`/`clips` là projection derived từ project, gắn `revision` + `fingerprint`.**

Không chọn (A) — xóa hẳn lanes/clips — vì lý do:

- Toàn bộ `TimelineCommand` system (~15 command types) đang thao tác trực tiếp trên lanes/clips. Viết lại tất cả trong một phase là rủi ro cao và không an toàn.
- Editor UI (web + desktop) đọc lanes/clips để render timeline rows. Refactor UI song song với engine sẽ làm vỡ toàn bộ preview.
- Lanes/clips là cache hữu ích — project chỉ có `sceneOrder`, không có thông tin lane assignment hay collision resolution.

### Cơ chế

```
MotionProject (authoring, canonical)
    │
    │  projectToTimelineDocument(project)
    ▼
TimelineDocument {
    project: MotionProject,
    lanes: TimelineLane[],      // derived projection
    clips: TimelineClip[],       // derived projection
    revision: number,            // monotonic, tăng mỗi lần project thay đổi
    fingerprint: string,         // hash của project snapshot
}
```

### Quy tắc

1. **Project là canonical**: Mọi thay đổi editor phải bắt đầu bằng cách patch `project`, sau đó re-derive `lanes`/`clips` qua `projectToTimelineDocument()`.
2. **Revision monotonic**: Mỗi lần project thay đổi, `revision` tăng 1. Không có hai document khác revision mà cùng project state.
3. **Fingerprint để detect drift**: `fingerprint` = hash của project state. Nếu lanes/clips không khớp fingerprint, document bị stale → reject hoặc re-derive.
4. **Renderer guard**: Runtime/compiler/renderer chỉ chấp nhận document có `revision` hợp lệ + `fingerprint` khớp project.
5. **Command runner mới**: `executeTimelineCommand(doc, cmd)` → patch project → `projectToTimelineDocument(patchedProject)` → return new doc. KHÔNG sửa lanes/clips trực tiếp.

### Lộ trình

| Phase                  | Hành động                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1** (hiện tại) | Thêm `revision` + `fingerprint` vào `TimelineDocument`. Tạo `projectToTimelineDocument()`. Chưa refactor toàn bộ command runner — thêm adapter layer. |
| **Phase 2**            | Refactor từng command sang project-first. Mỗi command có test verify `revision` tăng.                                                                 |
| **Phase 3**            | Xóa `rebuildMainProject()` và các code path sửa lanes/clips trực tiếp.                                                                                |
| **Phase 4+**           | Khi tất cả command đã project-first, cân nhắc xóa lanes/clips khỏi persisted state — derive on read.                                                  |

## Consequences

### Positive

- Single source of truth (`project`) rõ ràng
- Detect được stale/divergent document qua `fingerprint`
- Renderer có thể từ chối document không hợp lệ
- Deterministic: cùng project + revision = cùng TimelineDocument

### Negative

- Cần adapter layer cho đến khi command runner được refactor xong
- Performance: re-derive lanes/clips mỗi command (hiện tại cache nhẹ, chấp nhận được)
- Migration period: code vừa có path cũ vừa có path mới trong Phase 1-2

### Risks

- Quên tăng `revision` trong một command → document stale không detected. Mitigation: test tự động kiểm tra revision sau mỗi command.
- Fingerprint collision (cực kỳ thấp với SHA-256). Mitigation: dùng SHA-256 của JSON-stable serialization.
