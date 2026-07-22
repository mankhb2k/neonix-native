# Content · Character

Khối **nhân vật / thiết bị / UI giả** cho infographic & SME TVC.  
Không phải puppet full-body (Rive/Lottie character) — MVP = illustration tĩnh + Entrance.

## Kệ (`CHARACTER_BLOCKS`)

| ID | Tên | Dùng cho |
|---|---|---|
| `character.person` | Person | Nhân vật đứng / silhouette |
| `character.hand` | Hand | Tay cầm SP / gesture |
| `character.device` | Device | Thiết bị generic |
| `character.laptop` | Laptop | Mockup laptop / SaaS |
| `character.phone` | Phone | Mockup điện thoại / app |
| `character.browser` | Browser | Cửa sổ trình duyệt |
| `character.chat-bubble` | Chat Bubble | Hội thoại / tin nhắn (khác `shape.speech-bubble`) |
| `character.robot` | Robot | Mascot AI / bot |

## Nguyên tắc

1. **Content ≠ Animation** — Character chỉ là asset/role; chuyển động dùng `enter.*` hoặc asset Lottie/Rive sau.
2. **Chat Bubble:** `character.chat-bubble` = UI chat (tin nhắn); `shape.speech-bubble` = bong bóng quote đơn.
3. **Device vs Laptop/Phone** — `device` generic; laptop/phone khi cần mockup rõ.
4. Tháng 1: ưu tiên **Phone + Laptop + Browser** cho SaaS/app; Person/Robot khi có brand mascot.

## Asset sau này

- SVG/PNG trong `asset-registry`
- Optional Lottie/Rive gắn `media.lottie` — không thay id character
