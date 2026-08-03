# Timeline Architecture & Glossary

Tài liệu này giải thích kiến trúc và định nghĩa chuẩn hóa (Glossary) cho toàn bộ các khái niệm (concept) được sử dụng trong thư mục `timeline`. Việc đồng bộ ngôn ngữ chung (Ubiquitous Language) giúp quá trình trao đổi, maintain và phát triển tính năng diễn ra trôi chảy hơn.

---

## 1. Kiến Trúc Tổng Quan (Architecture Overview)

Timeline của MotiClip được thiết kế hướng tới **hiệu năng cực cao (60fps)** cho các thao tác kéo thả (Drag & Drop), cắt ghép (Trim) trên trình duyệt. Để làm được điều này, chúng ta sử dụng kiến trúc 2 tầng state:

- **Document State (Redux/EditorCore):** Lưu trữ dữ liệu thật của Timeline (danh sách clip, lane, duration). Chỉ cập nhật khi thao tác ĐÃ HOÀN TẤT (Commit / Mouse Up). Điều này tránh việc React phải re-render toàn bộ DOM tree liên tục.
- **Preview Session State (Zustand/Sync Store):** Lưu trữ tọa độ, trạng thái lơ lửng của các thao tác đang diễn ra (Mouse Move). Dữ liệu này được đọc trực tiếp bởi một số ít Component (như `TimelineOverlays`, `ClipStrip`) để vẽ giao diện 60fps mà không làm lag các Component khác.

---

## 2. Từ Điển Khái Niệm (Glossary)

Dưới đây là các thuật ngữ chuẩn dùng trong codebase và khi giao tiếp.

### 🎬 Các Thực Thể Cơ Bản (Entities)

* **Clip:** Đơn vị media cơ bản nhất trên Timeline (Video, Audio, Text, Sticker). Clip có điểm bắt đầu (`startTime`), thời lượng (`duration`) và nằm trong một Lane cụ thể.
* **Lane:** Một "dải" hoặc "dòng" nằm ngang chứa các Clip. Lane không được phép chứa 2 clip đè lên nhau về mặt thời gian (chúng sẽ tự xô đẩy hoặc tạo lane mới).
* **Track / TrackKind:** Phân loại logic của Lane. 
  * `main`: Trục video chính (Main Track). Thường nằm ở giữa, các clip tự động hút vào nhau (magnetic).
  * `overlay`: Các track phụ (PiP - Picture in Picture, Text) nằm bên trên `main`.
  * `audio`: Các track âm thanh nằm bên dưới `main`.

### 🖱️ Các Trạng Thái Tương Tác (Interactions)

* **Preview / Active Move:** Trạng thái khi người dùng đang bấm giữ chuột và kéo một (hoặc nhiều) Clip đi nơi khác, nhưng chưa thả chuột.
* **Float / Floating Bubble (Khối Nổi):** Là giao diện mô phỏng Clip thật đang bay lơ lửng, **bám sát 100% theo tọa độ chuột** (X, Y). Khối nổi này copy y hệt CSS của Clip thật (màu sắc, text) để mang lại cảm giác "đang cầm chính Clip đó trên tay". Được render bởi `TimelineOverlays`.
* **Ghost (Bóng mờ/Drop Target):** Là một ô hình chữ nhật màu xám đen bóng đổ (mặc định) nằm "dưới mặt đất" (bám trên các Lane). Chức năng của Ghost là **chỉ thị chính xác vị trí mà Clip sẽ rớt xuống** nếu người dùng thả chuột. Ghost luôn bám (snap) vào lưới hoặc các clip khác.
* **Marquee (Khung Chọn):** Hình chữ nhật trong suốt viền xanh xuất hiện khi người dùng bấm chuột vào vùng trống và kéo, dùng để quét chọn nhiều Clip cùng lúc.

### 📏 Các Khái Niệm Về Không Gian & Trục Thời Gian

* **Playhead:** Cái kim/vạch kẻ dọc màu xanh lá báo hiệu thời điểm đang được phát. Bao gồm phần đầu (Head) để cầm nắm và phần vạch (Line).
* **Time Ruler (Thước Thời Gian):** Thanh ngang nằm trên cùng của Timeline, hiển thị các mốc thời gian (00:01, 00:02,...).
* **PPS (Pixels Per Second):** Hệ số Scale cực kỳ quan trọng. Dùng để quy đổi giữa **Thời gian (Giây)** và **Không gian (Pixel)**. Ví dụ: Clip dài 5 giây, PPS = 20 => Chiều rộng hiển thị là 100px. Phóng to/thu nhỏ (Zoom) bản chất là thay đổi biến PPS này.
* **Viewport (Khung Nhìn):** Khung cuộn chứa toàn bộ Timeline. Những phần nằm ngoài Viewport sẽ không được render (kỹ thuật Virtualization) để giữ cho app không bị lag khi Timeline dài hàng tiếng đồng hồ.
* **Snap / Snapping (Hút):** Hành vi tự động dính tọa độ (hoặc thời gian) khi một Clip được kéo lại gần một Clip khác, hoặc gần Playhead. `snapGuideTime` là biến lưu thời điểm đang bị hút để vẽ một đường vạch dọc chỉ thị (Snap Guide).

---

## 3. Luồng Hoạt Động Của Một Cú Kéo Thả (Drag Flow)

Để dễ hình dung tại sao ta có các khái niệm `Float` và `Ghost`, hãy xem luồng khi kéo 1 Clip:

1. **`onPointerDown`:** Hệ thống ghi nhận Clip đang bị cầm. Clip gốc trên DOM bị chuyển thành trạng thái tàng hình (`invisible pointer-events-none`).
2. **`onPointerMove`:**
   - Hệ thống tính toán tọa độ chuột và đẩy vào `Preview Session`.
   - `TimelineOverlays` đọc tọa độ và vẽ ra **Float** (Khối Nổi) bay theo chuột.
   - `use-clip-move` tính toán xem chuột đang nằm ở Lane nào, bị Snap vào đâu, và sinh ra **Ghost** nằm dưới Lane đó.
3. **`onPointerUp`:**
   - **Float** và **Ghost** bị xóa.
   - Bắn lệnh `move-clip` vào Redux.
   - Redux cập nhật state thật, React vẽ lại Clip gốc ở tọa độ mới. Cảm giác như Clip vừa rớt xuống hoàn hảo.

---

## 4. Các Khái Niệm Kỹ Thuật & Tối Ưu (Tech Concepts)

Để đạt được hiệu năng cao, Timeline sử dụng một số kỹ thuật và viết tắt chuyên ngành:

* **RAF (requestAnimationFrame):** Một API của trình duyệt giúp gọi hàm đồng bộ với tần số quét của màn hình (thường là 60fps). Timeline dùng RAF để giới hạn (throttle) số lần render khi cuộn chuột hoặc khi Playhead chạy, giúp UI cực kỳ mượt mà không bị xé hình.
* **Virtualization (Ảo Hóa):** Kỹ thuật chỉ vẽ (render) những Clip/Lane đang hiện diện trên màn hình (Viewport), và "cất" những Clip đang bị cuộn khuất khỏi DOM. Cực kỳ quan trọng để Timeline có thể chứa hàng ngàn Clip mà không bị lag.
* **Sync Store / Transient State:** Những state có vòng đời cực ngắn (tọa độ chuột, trạng thái đang kéo thả) không được lưu bằng `useState` hay `Redux` (vì sẽ làm re-render toàn app). Chúng được lưu thẳng vào biến local hoặc `Zustand store` để các component nhỏ (như lớp Overlays) tự đọc (subscribe) và tự vẽ lại độc lập.
* **Scrubbing / Seek:** Hành động cầm Playhead kéo qua kéo lại để xem lướt video. Tương tự như Drag, Scrubbing dùng RAF để render UI của Playhead ngay lập tức, nhưng chỉ "commit" thời gian về Redux/Video Player theo từng đợt để tránh làm đơ Video Engine.

---

## 5. Cấu Trúc Z-Index (Stacking Context)

Để tránh tình trạng z-index lộn xộn (spaghetti z-index) hoặc lạm dụng `!important`, Timeline sử dụng quy chuẩn phân lớp z-index từ thấp đến cao trong cùng một Stacking Context (Container Scroll):

* **`z-0`:** Nền của Scroll Container. Bắt buộc để khoanh vùng Stacking Context cho toàn bộ Timeline.
* **`z-[2]`:** Trim Handles (Cạnh trái/phải của Clip khi được chọn để kéo dài/thu ngắn).
* **`z-[5]`:** Đường line đỏ báo lỗi khi thả Clip vào vùng không hợp lệ (Invalid Drop Target).
* **`z-10`:** Clip đang được chọn (Selected Clip). Giúp nó luôn nằm trên các Clip bình thường (không có z-index). Handle kéo của Playhead cũng dùng mức này.
* **`z-[20]`:** Bóng mờ trên track (Ghost) khi đang kéo Clip. Luôn đè lên các Clip khác nhưng nằm dưới Overlays.
* **`z-[30]`:** Bóng mờ thả từ thư viện xuống (Library Drop Ghost) hoặc vạch chỉ thị chèn (Insert Indicator).
* **`z-[32]`:** Đường dóng bắt dính (Snap Guide) màu xanh.
* **`z-[45]`:** Trục dọc (Line) của Playhead. Nằm trên cùng mặt phẳng track để không bị Clip che khuất.
* **`z-50`:** Khung quét chọn (Marquee). Hoặc Sidebar dán nhãn Lane (Sticky Lane Labels).
* **`z-[60]`:** Khối nổi lơ lửng bám theo chuột (Floating Bubble). Mức cao nhất để đảm bảo khi kéo chuột, Clip không bao giờ bị che bởi bất kỳ thành phần nào khác.
