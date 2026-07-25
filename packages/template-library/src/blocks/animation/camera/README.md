# Animation · Camera Presets

Preset **camera** gắn scene/frame — không phải content layer.  
Khác `content/camera` (placeholder shot). Kệ lab: **Animation → Camera Presets**.

## Kệ (`CAMERA_PRESET_BLOCKS`)

| ID | Preset | Tên |
|---|---|---|
| `camera.zoom-in` | `camera-zoom-in` | Zoom In |
| `camera.zoom-out` | `camera-zoom-out` | Zoom Out |
| `camera.pan-left` | `camera-pan-left` | Pan Left |
| `camera.pan-right` | `camera-pan-right` | Pan Right |
| `camera.pan-up` | `camera-pan-up` | Pan Up |
| `camera.pan-down` | `camera-pan-down` | Pan Down |
| `camera.focus-target` | `camera-focus-target` | Focus Target |
| `camera.follow-object` | `camera-follow-object` | Follow Object |
| `camera.shake` | `camera-shake` | Shake |
| `camera.rotate` | `camera-rotate` | Rotate |

## Nguyên tắc

1. Camera preset thường gắn **scene** (hoặc root frame), không gắn từng text layer.
2. `zoom-in` (Entrance) ≠ `camera-zoom-in` — cái trước scale layer; cái sau scale viewport.
3. `focus-target` / `follow-object` cần `targetLayerId` trên animation params (schema mở rộng sau).
4. MVP hay dùng: zoom-in/out, pan, ken-burns-style (zoom+pan nhẹ). Shake/rotate sparingly.

## Timing

Dùng `schedule` / `duration` / `playback` trên Clip; easing nằm trên Track key sau compile.
