# NeonVideo V1 Audio

> Trạng thái: v1
>
> Mục tiêu: audio là timeline object **chỉ root**, không phải visual primitive.

---

## Đã chốt

- Audio vẫn là một `layer` trên `project.layers` (cùng clock `timing`).
- Không dùng mental model visual: không `frame`, không `transform`, không `layout` / `layoutItem`, không `appearance`.
- Chỉ root: `parentLayerId: null`. Không nest trong group.
- `zIndex` bắt buộc và **< 0**. Đây là lane rule trên timeline, không phải visual stacking.
- `timing` bắt buộc; cửa sổ hiệu lực giao với composition như layer khác.
- Playback sống trên `payload`: `assetId`, `trimStart`, `trimEnd`, `playbackRate`, `volume`, `fadeIn`, `fadeOut`, `loop`, `muted`.
- `trim*` cắt **nguồn**, không phải layer trim protocol.
- `volume` nguyên `0..100` (100 = đầy). Tắt tiếng bằng `muted`, không bằng `opacity: 0`.
- Hit-test / editor selection không thuộc JSON audio.

---

## Câu chốt

Audio là làn âm thanh trên timeline. Visual guide không áp dụng.

---

## Audio analysis → keyframes

> Trạng thái: v1 (package `@motionvideo/audio-analysis`).
>
> Mục tiêu: sinh keyframes theo nhạc khi user muốn video nhảy theo beat — **không** đưa dữ liệu phân tích vào `MotionProjectV1`.

---

### Ranh giới

Audio analysis là **tính năng tùy chọn của app**, không phải primitive bắt buộc của protocol.

Chỉ chạy analysis khi user cần:

- visualizer theo beat
- neon glow pulse theo nhạc
- logo/avatar scale theo bass
- equalizer/waveform motion
- remix/music video keyframes

Không chạy khi chỉ đặt nhạc nền, render nhạc không cần hình nhảy theo nhạc, keyframes thủ công, hay template không audio-reactive.

```txt
Audio analysis = app feature / tool artifact.
MotionProjectV1 = output cuối cùng, chỉ chứa layer.animations đã bake.
Compiler/runtime = không phụ thuộc audio analysis.
```

---

### Artifact `AudioAnalysisV1`

Kết quả phân tích là file sidecar JSON, **không nằm trong** `MotionProjectV1`:

```ts
type AudioAnalysisV1 = {
  format: "moticlip-audio-analysis";
  formatVersion: 1;

  projectId: string;
  audioAssetId: string;
  audioHash?: string; // invalidate cache khi asset đổi

  duration: number;
  sampleRate: number;
  channels: number;
  hopSeconds: number; // mặc định 0.05

  beats: Array<{ t: number; strength: number }>; // 0..1
  bassEnergy: Array<{ t: number; value: number }>; // 0..1
  loudness: Array<{ t: number; value: number }>; // 0..1
  sections: Array<{
    type: "intro" | "build" | "drop" | "main" | "break" | "outro";
    start: number;
    end: number;
    confidence?: number; // 0..1
  }>;

  createdAt: string;
  analyzerVersion: string;
};
```

R2 object key (deterministic theo project namespace):

```txt
workspaces/{workspaceId}/projects/{projectId}/analysis/audio/{audioAssetId}.audio-analysis.v1.json
```

---

### Luồng hoạt động

```txt
audio assetId
  -> motion-storage getDownloadUrl
  -> packages/audio-analysis analyze
  -> save AudioAnalysisV1 artifact to R2
  -> generate layer.animations
  -> patch owning visual layer.animations
```

---

### Map signal → clip

| Audio signal   | Motion target                                                |
| -------------- | ------------------------------------------------------------ |
| `beats[]`      | `transform.scale`, `effects.<glow>.opacity` (spike)          |
| `bassEnergy[]` | ring scale, bar height, glow radius/opacity (continuous)     |
| `loudness[]`   | brightness, noise opacity, background intensity (continuous) |
| `sections[]`   | palette, scene intensity, template variant                   |

Output cuối cùng là `layer.animations` (đã bake), ví dụ:

```json
{
  "id": "clip-beat-glow",
  "layerId": "visualizer.ring",
  "property": "effects.fx-glow-1.opacity",
  "keys": [
    { "t": 12.4, "value": 25 },
    { "t": 12.43, "value": 100 },
    { "t": 12.58, "value": 25 }
  ]
}
```

---

### Preset `neon-circle-pulse`

```ts
const analysis = await analyzeAudio({
  audioUrl,
  projectId: "proj_123",
  audioAssetId: "asset.audio.main",
  hopSeconds: 0.05,
});

const drafts = audioAnalysisToTimelineClips({
  analysis,
  preset: "neon-circle-pulse",
  targets: {
    ringLayerId: "visualizer.ring",
    glowEffectId: "fx-glow-1",
  },
});

// Strip layerId and push onto the owning visual layer.animations
```

Quy ước giá trị keyframe sinh ra:

- `opacity`: `0..100`
- `scale`: multiplier (`1.0` = base)
- `brightness`: `20..80` (theo preset)

Cùng target `transform.scale`, beat pulse và bass scale được gộp vào **một clip** (`clip-ring-scale`) để không clip sau đè clip trước.

---

## Xem thêm

- [audio-analysis-feature-plan.md](./audio-analysis-feature-plan.md)
- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-animation-keyframes-guide.md](./v1-animation-keyframes-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-video-guide.md](./v1-video-guide.md)
- [v1-appearance-guide.md](./v1-appearance-guide.md)
