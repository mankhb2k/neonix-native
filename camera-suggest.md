# Kiến trúc Camera 2D cho MotionVideo

Tài liệu này tổng hợp các đề xuất thiết kế hệ thống Camera 2D phục vụ cho engine chỉnh sửa video, tuân thủ chặt chẽ triết lý **"Preset-Driven"** (điều khiển bằng preset, hạn chế keyframe thô) để đảm bảo an toàn cho layout và tối ưu cho AI Copilot.

## 1. Triết lý cốt lõi (Core Concepts)

*   **2D Transform:** Camera trong môi trường này không phải là một object 3D thực sự. Nó là ảo giác được tạo ra bằng cách áp dụng ma trận biến đổi toán học (Translate X/Y, Scale) lên `container` chứa các Layer.
*   **Không tạo Camera Layer:** Camera KHÔNG phải là một Layer hiển thị trên timeline. Nó là một **Thuộc tính (Property)** áp dụng lên không gian làm việc (Scene hoặc Project).
*   **Dual Camera (Camera Kép):**
    *   **Local Camera (Cấp độ Scene):** Xử lý chuyển động lia/zoom *bên trong* một cảnh.
    *   **Global Camera (Cấp độ Project):** Xử lý hiệu ứng lia máy *xuyên qua* nhiều cảnh (bằng thủ thuật Compiler).

## 2. Đề xuất Zod Schema (Tích hợp vào `packages/motion-schema`)

Để tận dụng các hiệu ứng camera đã có trong `package block`, chúng ta mở rộng schema hiện tại bằng cách thêm `CameraActionSchema` vào `SceneSchema`. Cấu trúc này cố tình được thiết kế giống `AnimationSchema` để giữ tính nhất quán.

```typescript
import { z } from "zod";

// 1. Khai báo các Preset Camera mà package block hỗ trợ
export const CameraPresetSchema = z.enum([
  "pan-left", "pan-right", "pan-up", "pan-down",
  "zoom-in", "zoom-out",
  "focus-target",    // Preset đặc biệt để zoom vào 1 layer cụ thể
  "custom-transform" // Escape hatch nếu thực sự cần truyền raw data
]);

// 2. Schema cho một hành động Camera
export const CameraActionSchema = z.object({
  preset: CameraPresetSchema,
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  delay: z.number().nonnegative().optional(),
  // easing: EasingSchema.optional(), // Kế thừa EasingSchema của dự án
  params: z.record(z.string(), z.unknown()).optional(),
});

// 3. Tích hợp vào SceneSchema
export const SceneSchema = z.object({
  id: z.string(),
  duration: z.number().positive(),
  layers: z.array(LayerSchema), 
  
  // Mảng các hành động camera áp dụng cho Scene này
  cameraActions: z.array(CameraActionSchema).optional(),
});
```

## 3. Cơ chế hoạt động của các Preset quan trọng

### 3.1. Preset: `focus-target` (Zoom vào vật thể)
Giải quyết bài toán: *"Tôi muốn camera zoom sát vào cốc cà phê đang nằm ở góc trái"*.

Thay vì bắt User/AI tự đoán tọa độ `X: -200, Y: 50, Scale: 2`, hệ thống sử dụng tham chiếu ID.

**Đầu vào JSON:**
```json
{
  "preset": "focus-target",
  "start": 1.0,
  "duration": 1.5,
  "params": {
    "targetLayerId": "layer_cup_coffee", 
    "zoomScale": 2.0 
  }
}
```

**Cách Engine xử lý:**
1. Trình biên dịch (Compiler) đọc JSON.
2. Tìm layer có id là `layer_cup_coffee`.
3. Lấy tọa độ Box (X, Y, Width, Height) của layer đó.
4. Tự động nội suy ra thông số Translate X, Y và áp dụng lên root container của Scene.

### 3.2. Thủ thuật Compiler cho Global Camera (Tương lai)
Giải quyết bài toán: *"Trượt camera từ Scene 1 sang Scene 2 thật mượt"*.

Do engine render hiện tại đang xử lý theo từng Scene rời rạc, ta không làm Global Camera ở runtime (quá tốn tài nguyên), mà làm ở khâu **Biên dịch (Compile)**.

Khi user áp dụng preset `Global Pan Right`:
*   **Tại Scene 1:** Compiler tự động bơm một `CameraAction` trượt sang trái vào giây cuối cùng.
*   **Tại Scene 2:** Compiler bơm một `CameraAction` trượt từ phải vào vị trí trung tâm ở giây đầu tiên.
*   Kết quả: Khi hai video MP4 nối lại, cảm giác lia máy hoàn toàn trơn tru.

## 4. Tóm tắt lợi ích

1.  **AI-Friendly:** Trí tuệ nhân tạo (Copilot) sinh JSON cực kỳ chính xác vì chỉ việc gọi tên Preset, không phải tính toán tọa độ Bezier phức tạp.
2.  **An toàn cho Layout (Moat):** Giữ vững rào chắn bảo vệ của template. Chống vỡ layout do can thiệp thông số thô.
3.  **Dễ scale:** Khớp hoàn toàn với engine hiện có và dễ dàng mở rộng lên cấp độ Global Project sau này.
