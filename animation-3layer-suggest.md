# Kiến trúc Animation 3 Tầng cho MotionVideo

Để xây dựng một Web-based Video Editor có khả năng tạo ra chuyển động (motion) phức tạp như After Effects nhưng vẫn giữ được sự nhẹ nhàng, dễ bảo trì (maintain) và thân thiện với AI Copilot, dự án **MotionVideo** nên áp dụng chiến lược phân loại Animation thành 3 tầng (Tiers) dưới đây.

## Tầng 1: Basic Presets (Hiệu ứng cơ bản, cố định)

Dùng cho những chuyển động phổ thông nhất (xuất hiện, trượt, mờ), chiếm 80% thời lượng của một video quảng cáo/marketing thông thường.

*   **Bản chất:** Là các đoạn code (CSS, JS, hoặc WebGL) được Dev viết cứng các thông số điểm đầu và điểm cuối.
*   **Ví dụ thực tế:** Dòng chữ "Sale 50%" trượt từ dưới lên và rõ dần.
*   **Dữ liệu JSON sinh ra (Schema):**
    ```json
    {
      "preset": "fade-up", 
      "duration": 1.0 
    }
    ```
*   **Cách Engine xử lý:** Trình render đọc preset `fade-up`, tự động nội suy giá trị từ `Opacity: 0, Y: 50` đến `Opacity: 1, Y: 0` theo một đường thẳng tuyến tính (Linear/Ease). Rất nhẹ và không bao giờ gây lỗi layout.

## Tầng 2: Smart/Parametric Presets (Hiệu ứng toán học, nội suy)

Dùng cho các chuyển động mang tính hữu cơ, lặp đi lặp lại hoặc có quỹ đạo phức tạp. Tránh việc phải code cứng (hardcode) hàng ngàn hiệu ứng lẻ tẻ.

*   **Bản chất:** Tận dụng các thư viện hoạt ảnh mạnh mẽ (như GSAP) kết hợp với các tham số (params) động.
*   **Ví dụ thực tế:** Một chiếc chuông báo thức rung lắc liên tục (Wiggle).
*   **Dữ liệu JSON sinh ra (Schema):**
    ```json
    {
      "preset": "wiggle",
      "duration": 5.0,
      "params": { 
        "intensity": "high",  // Độ rung lắc mạnh
        "speed": 2.0          // Tốc độ rung nhanh
      }
    }
    ```
*   **Cách Engine xử lý:** Engine nạp tham số `intensity` và `speed` vào một hàm toán học (như hàm Sine/Cosine) của thư viện (ví dụ GSAP CustomWiggle). Hàm này liên tục sinh ra các góc xoay ngẫu nhiên (-10 độ, +5 độ...) một cách tự nhiên trong 5 giây mà không cần lưu trữ keyframe thô.

## Tầng 3: Complex Assets (Đồ họa hoạt hình phức tạp)

Dùng cho những chuyển động vượt quá giới hạn của một Web Editor cơ bản (ví dụ: biến đổi hình dáng path morphing, khung xương nhân vật rigger, hiệu ứng vật lý hạt particles). 

*   **Bản chất:** Kế thừa sức mạnh từ các phần mềm chuyên nghiệp (After Effects) thông qua định dạng trung gian như **Lottie JSON** (hoặc Rive). Không bắt ép team Dev phải tự viết engine cho các chuyển động này.
*   **Ví dụ thực tế:** Một nhân vật Mascot chạy ra màn hình, tóc bay trong gió và vẫy tay chớp mắt.
*   **Dữ liệu JSON sinh ra (Schema):** Lúc này, animation không nằm ở thuộc tính `animations`, mà bản thân file Lottie được coi là một Layer (Asset).
    ```json
    {
      "id": "mascot_running",
      "type": "lottie",
      "content": "https://server.com/assets/mascot_running.json",
      "transform": {
        "x": 100, "y": 200, "scale": 1
      }
    }
    ```
*   **Cách Engine xử lý:** Trình render của MotionVideo "giao phó" toàn bộ việc tính toán điểm ảnh cho thư viện bên thứ 3 (ví dụ `lottie-web`). Nó chỉ tạo ra một container ở tọa độ (100, 200) và điều khiển việc Play/Pause đoạn Lottie đó.

---

## Tóm tắt lợi ích chiến lược

1.  **Dành cho Dev:** Nhàn hạ. Chỉ cần tập trung tối ưu Tầng 1 và Tầng 2 cho thật mượt. Không bị sa lầy vào việc viết lại engine rigger xương khớp của Tầng 3.
2.  **Dành cho AI Copilot:** Cực kỳ an toàn. AI chỉ việc gọi đúng tên Preset và tham số (params), không phải tính toán tọa độ Bezier, triệt tiêu nguy cơ AI làm vỡ layout của Template.
3.  **Dành cho Designer:** Tự do sáng tạo ở Tầng 3 bằng công cụ quen thuộc (After Effects) và dễ dàng import vào hệ thống mà không cần nhờ Coder can thiệp.
