# MotiClip Audio Analysis Feature Plan

> Trang thai: plan
>
> Muc tieu: them tinh nang phan tich audio de sinh keyframes theo nhac, khong dua `beats[]`, `bassEnergy[]`, `loudness[]`, `sections[]` vao MotionProjectV1.

---

## 1. Ket Luan Thiet Ke

Audio analysis la **tinh nang tuy chon cua app**, khong phai primitive bat buoc cua protocol.

Chi can chay audio analysis khi user muon:

- tao visualizer theo beat
- lam neon glow pulse theo nhac
- lam logo/avatar scale theo bass
- tao equalizer/waveform motion
- tao keyframes tu audio de render video remix/music

Khong can chay audio analysis khi user chi:

- dat audio nen binh thuong
- render video co nhac nhung khong can hinh anh nhay theo nhac
- dung keyframes thu cong
- dung template khong audio-reactive

**Cau chot:**

```txt
Audio analysis = app feature / tool artifact.
MotionProjectV1 = output cuoi cung, chi chua timeline.clips da bake.
Compiler/runtime = khong phu thuoc audio analysis.
```

---

## 2. Ranh Gioi Kien Truc

### 2.1 Khong Dua Vao Protocol

Khong them cac field sau vao `MotionProjectV1`:

```json
{
  "audioAnalysis": {},
  "beats": [],
  "bassEnergy": [],
  "loudness": [],
  "sections": []
}
```

Ly do:

- Day la du lieu trung gian, co the tinh lai.
- Du lieu co the nang voi bai nhac dai.
- Mot audio co the phan tich bang nhieu version/setting khac nhau.
- AI authoring khong can hoc DSP vocabulary.
- Runtime chi can keyframes da bake.

### 2.2 Nen Lam O Dau

Tao package rieng:

```txt
packages/audio-analysis
```

Package nay lam:

- decode audio
- tinh loudness
- tinh bass energy
- detect beats
- detect sections heuristic
- export `AudioAnalysisV1`
- map analysis thanh `timeline.clips`

---

## 3. R2 Project Folder Chuan

Tat ca production assets/artifacts nen nam trong namespace project tren R2.

De xuat prefix:

```txt
workspaces/{workspaceId}/projects/{projectId}/
  project/
    motion-project.v1.json
    snapshots/
      {timestamp}.motion-project.v1.json

  assets/
    image/
      {assetId}.{ext}
    svg/
      {assetId}.svg
    video/
      {assetId}.{ext}
    audio/
      {assetId}.{ext}
    font/
      {assetId}.{ext}

  analysis/
    audio/
      {audioAssetId}.audio-analysis.v1.json

  generated/
    waveforms/
      {audioAssetId}.waveform.v1.json
    thumbnails/
      {thumbnailId}.webp
    previews/
      {previewId}.mp4

  renders/
    jobs/
      {renderJobId}/
        runtime.motion-runtime.v1.json
        manifest.json
        output.mp4
        poster.webp

  temp/
    uploads/
      {uploadSessionId}/
```

Neu chua co workspace, co the dung:

```txt
projects/{projectId}/...
```

Nhung de san sang team/account sau nay, nen dung:

```txt
workspaces/{workspaceId}/projects/{projectId}/...
```

---

## 4. AudioAnalysisV1 Artifact

Audio analysis la file JSON sidecar/cache tren R2:

```txt
workspaces/{workspaceId}/projects/{projectId}/analysis/audio/{audioAssetId}.audio-analysis.v1.json
```

Schema de xuat:

```ts
export type AudioAnalysisV1 = {
  format: "moticlip-audio-analysis";
  formatVersion: 1;

  projectId: string;
  audioAssetId: string;
  audioHash?: string;

  duration: number;
  sampleRate: number;
  channels: number;
  hopSeconds: number;

  beats: Array<{
    t: number;
    strength: number; // 0..1
  }>;

  bassEnergy: Array<{
    t: number;
    value: number; // 0..1
  }>;

  loudness: Array<{
    t: number;
    value: number; // 0..1
  }>;

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

---

## 5. Luong Hoat Dong

### 5.1 Import Audio

1. User upload audio.
2. App goi `motion-storage`.
3. `motion-storage` luu object vao R2:

```txt
workspaces/{workspaceId}/projects/{projectId}/assets/audio/{assetId}.mp3
```

4. `motion-storage` tra ve `AssetV1`.
5. App them asset vao `MotionProjectV1.assets[]`.

Vi du asset managed:

```json
{
  "id": "asset.audio.main",
  "assetType": "audio",
  "mimeType": "audio/mpeg",
  "duration": 180,
  "integrity": "sha256:...",
  "sizeBytes": 12345678,
  "storage": {
    "managed": true,
    "provider": "r2",
    "key": "workspaces/ws_123/projects/proj_123/assets/audio/asset.audio.main.mp3",
    "retention": "project"
  },
  "source": {
    "kind": "upload",
    "originalName": "song.mp3"
  }
}
```

### 5.2 Analyze Audio Optional

Chi chay khi user bam:

```txt
Analyze audio
Generate beat keyframes
Create music visualizer
```

Luong:

```txt
audio assetId
  -> motion-storage getDownloadUrl
  -> packages/audio-analysis analyze
  -> save AudioAnalysisV1 artifact to R2
  -> generate timeline.clips
  -> patch MotionProjectV1
```

### 5.3 Generate Keyframes

Mapping co ban:

| Audio signal | Motion target |
| --- | --- |
| `beats[]` | `transform.scale`, `effects.<glow>.opacity`, flash opacity |
| `bassEnergy[]` | ring scale, bar height, glow radius/opacity |
| `loudness[]` | brightness, noise opacity, background intensity |
| `sections[]` | palette, scene intensity, template variant |

Output cuoi cung la `timeline.clips`.

Vi du:

```json
{
  "id": "clip-beat-glow-001",
  "layerId": "visualizer.ring",
  "property": "effects.fx-glow-1.opacity",
  "keys": [
    { "t": 12.4, "value": 45 },
    { "t": 12.47, "value": 95 },
    { "t": 12.62, "value": 45 }
  ]
}
```

---

## 6. Package Plan

### 6.1 Folder

```txt
packages/audio-analysis/
  package.json
  tsconfig.json
  src/
    index.ts
    schema.ts
    analyze.ts
    decode.ts
    features/
      loudness.ts
      bass-energy.ts
      beats.ts
      sections.ts
    artifacts/
      object-keys.ts
      load-analysis.ts
      save-analysis.ts
    mapping/
      audio-to-clips.ts
      presets.ts
    __tests__/
      schema.test.ts
      loudness.test.ts
      bass-energy.test.ts
      beats.test.ts
      audio-to-clips.test.ts
```

### 6.2 Public API

```ts
export {
  AudioAnalysisV1Schema,
  type AudioAnalysisV1,
} from "./schema";

export {
  analyzeAudio,
  type AnalyzeAudioInput,
  type AnalyzeAudioOptions,
} from "./analyze";

export {
  audioAnalysisToTimelineClips,
  type AudioMotionPreset,
} from "./mapping/audio-to-clips";

export {
  audioAnalysisObjectKey,
} from "./artifacts/object-keys";
```

### 6.3 Example Usage

```ts
const analysis = await analyzeAudio({
  audioUrl,
  projectId: "proj_123",
  audioAssetId: "asset.audio.main",
  hopSeconds: 0.05,
});

const clips = audioAnalysisToTimelineClips({
  analysis,
  preset: "neon-circle-pulse",
  targets: {
    ringLayerId: "visualizer.ring",
    glowEffectId: "fx-glow-1",
  },
});

project.timeline.clips = [
  ...(project.timeline.clips ?? []),
  ...clips,
];
```

---

## 7. Phase Plan

## Phase 0 — Chot Contract

Muc tieu: khong de audio analysis lam mo protocol.

Tasks:

- [ ] Tao docs plan nay.
- [ ] Chot `AudioAnalysisV1` la artifact app, khong phai MotionProjectV1.
- [ ] Chot R2 object key cho analysis.
- [ ] Chot naming: `audio-analysis`, khong dung `track-analysis`.
- [ ] Chot trigger: chi analyze khi user yeu cau keyframes theo beat.

Done khi:

- [ ] Docs noi ro protocol chi chua `timeline.clips`.
- [ ] Team/app khong them `audioAnalysis` vao `MotionProjectV1`.

---

## Phase 1 — R2 Key Strategy

Muc tieu: moi asset/artifact cua project co prefix R2 on dinh.

Tasks:

- [ ] Mo rong upload context de co `workspaceId` / `projectId`.
- [ ] Cap nhat object key generator tu:

```txt
assets/{assetId}.{ext}
```

thanh:

```txt
workspaces/{workspaceId}/projects/{projectId}/assets/{assetType}/{assetId}.{ext}
```

- [ ] Them helper tao key:

```ts
projectAssetObjectKey(...)
audioAnalysisObjectKey(...)
renderArtifactObjectKey(...)
```

- [ ] Cap nhat docs `asset-format-storage.md`.
- [ ] Giu backward compatibility cho fixture/local neu can.

Done khi:

- [ ] Asset audio upload production co key theo project.
- [ ] Analysis artifact co key deterministic theo audio asset.

---

## Phase 2 — Audio Analysis Package Skeleton

Muc tieu: tao package rieng chua schema va API rong.

Tasks:

- [ ] Tao `packages/audio-analysis`.
- [ ] Them `package.json`, `tsconfig.json`.
- [ ] Them `src/schema.ts` voi `AudioAnalysisV1Schema`.
- [ ] Them `src/artifacts/object-keys.ts`.
- [ ] Them unit tests cho schema/key.
- [ ] Them export trong `src/index.ts`.

Done khi:

- [ ] `pnpm --filter @motionvideo/audio-analysis test` pass.
- [ ] Package build/typecheck pass.

---

## Phase 3 — Decode + Loudness MVP

Muc tieu: lay duoc `loudness[]` tu audio.

Tasks:

- [ ] Chon decode path MVP:
  - Browser: Web Audio API.
  - Server/Desktop: ffmpeg or audio decoder package.
- [ ] Convert stereo -> mono.
- [ ] Chia frame theo `hopSeconds`, mac dinh `0.05`.
- [ ] Tinh RMS moi frame.
- [ ] Normalize ve `0..1`.
- [ ] Smooth nhe de keyframes khong giat.
- [ ] Test bang synthetic sine/silence/noise.

Done khi:

- [ ] Silence cho loudness gan 0.
- [ ] Audio to hon cho loudness cao hon.
- [ ] Output dung `AudioAnalysisV1.loudness`.

---

## Phase 4 — Bass Energy MVP

Muc tieu: lay duoc `bassEnergy[]` de lam neon pulse.

Tasks:

- [ ] Chon cach tinh:
  - MVP nhanh: simple low-pass/filter + RMS.
  - Sau nay: FFT band energy 20Hz..160Hz.
- [ ] Normalize ve `0..1`.
- [ ] Smooth de tranh flicker qua muc.
- [ ] Test synthetic low frequency vs high frequency.

Done khi:

- [ ] Bass tone cho `bassEnergy` cao.
- [ ] High tone cho `bassEnergy` thap.

---

## Phase 5 — Beat Detection MVP

Muc tieu: tim peak tu `bassEnergy`/onset de co `beats[]`.

Tasks:

- [ ] Tinh moving average cua bass energy.
- [ ] Peak khi:

```txt
value > movingAverage * threshold
va t - lastBeat > minBeatGap
```

- [ ] Mac dinh:

```txt
threshold = 1.35
minBeatGap = 0.25s
```

- [ ] Strength = normalized peak strength.
- [ ] Remove duplicate/too-close beats.
- [ ] Test voi synthetic pulse train.

Done khi:

- [ ] Pulse train tao beat timestamps dung gan dung.
- [ ] Silence khong tao beats.

---

## Phase 6 — Sections Heuristic

Muc tieu: co sections du dung cho template neon/music.

Tasks:

- [ ] Chia audio thanh window 4s hoac 8s.
- [ ] Tinh average loudness/bass/beat density moi window.
- [ ] Label heuristic:
  - Dau bai energy thap -> `intro`
  - Energy tang dan -> `build`
  - Energy cao/beat density cao -> `drop` or `main`
  - Energy giam cuoi bai -> `outro`
- [ ] Merge adjacent sections cung type.
- [ ] Them confidence.

Done khi:

- [ ] Moi analysis co it nhat 1 section.
- [ ] Section start/end khong overlap, nam trong duration.

---

## Phase 7 — Save/Load Analysis Artifact

Muc tieu: analysis co cache tren R2, khong tinh lai moi lan.

Tasks:

- [ ] Tao `audioAnalysisObjectKey`.
- [ ] Luu JSON vao:

```txt
workspaces/{workspaceId}/projects/{projectId}/analysis/audio/{audioAssetId}.audio-analysis.v1.json
```

- [ ] Luu `audioHash` de invalid cache khi asset doi.
- [ ] Them function:

```ts
loadAudioAnalysisArtifact(...)
saveAudioAnalysisArtifact(...)
```

- [ ] Neu dung DB app, luu record artifact metadata:

```txt
projectId, audioAssetId, key, audioHash, analyzerVersion
```

Done khi:

- [ ] Analyze lan 1 tao artifact.
- [ ] Analyze lan 2 reuse neu hash/version khop.

---

## Phase 8 — Audio To Motion Mapping

Muc tieu: bien analysis thanh `timeline.clips`.

Tasks:

- [ ] Tao preset `neon-circle-pulse`.
- [ ] Mapping `beats[]` -> glow opacity spike.
- [ ] Mapping `beats[]` -> scale pulse.
- [ ] Mapping `bassEnergy[]` -> continuous scale/radius.
- [ ] Mapping `loudness[]` -> noise opacity / brightness.
- [ ] Mapping `sections[]` -> intensity/palette decisions.
- [ ] Clamp keyframe time theo layer timing.
- [ ] Ensure keyframes sorted, unique `t`.
- [ ] Tao deterministic clip ids.

Done khi:

- [ ] Output la `V1.TimelinePropertyClipV1[]`.
- [ ] Output parse duoc bang MotionProjectV1 schema khi append vao project.

---

## Phase 9 — App Integration

Muc tieu: user co nut tao motion theo nhac.

Tasks:

- [ ] UI: chon audio asset.
- [ ] UI: nut `Analyze audio`.
- [ ] UI: hien status analyzing/done/error.
- [ ] UI: chon template visualizer.
- [ ] UI: intensity slider.
- [ ] App goi storage lay signed URL.
- [ ] App goi `packages/audio-analysis`.
- [ ] App save artifact.
- [ ] App append generated `timeline.clips`.

Done khi:

- [ ] User upload audio -> bam analyze -> co keyframes trong timeline.
- [ ] User co the render video neon nhay theo nhac.

---

## Phase 10 — Production Hardening

Muc tieu: on dinh, repeatable, khong ton chi phi R2/CPU vo ly.

Tasks:

- [ ] Cache theo `audioHash + analyzerVersion + options`.
- [ ] Gioi han duration MVP.
- [ ] Gioi han keyframes per clip.
- [ ] Downsample analysis khi audio qua dai.
- [ ] Progress reporting.
- [ ] Cancel analysis job.
- [ ] Retry upload artifact.
- [ ] Observability: duration, error code, cache hit/miss.
- [ ] Security: user chi doc duoc project artifact cua minh.

Done khi:

- [ ] Analysis deterministic voi cung audio/options.
- [ ] Khong tao qua nhieu keyframes lam project nang.
- [ ] Artifact permissions dung workspace/project.

---

## 8. Non-Goals V1

Khong lam trong V1:

- Runtime audio-reactive live driver.
- Luu `beats[]` vao MotionProjectV1.
- Spotify Audio Analysis dependency.
- Beat detection chuan nhu DJ software.
- Full music structure AI segmentation.
- Real-time microphone visualizer.
- Audio stem separation.

---

## 9. Roadmap Sau MVP

Sau khi MVP chay du:

- Nang `bassEnergy` tu low-pass sang FFT band energy.
- Them bands: `low`, `mid`, `high`.
- Them waveform artifact cho UI preview.
- Them beat marker view tren timeline.
- Them presets:
  - `neon-cover-pulse`
  - `cyber-equalizer-bars`
  - `waveform-ring`
  - `bass-grid-react`
- Them AI planner de chon mapping theo mood/genre.
- Can nhac runtime audio driver sau khi co nhu cau real-time.

---

## 10. Chot Cuoi

```txt
Audio analysis la optional product feature.
No khong phai protocol requirement.
No sinh keyframes vao timeline.clips khi user muon video nhay theo nhac.
Artifact analysis luu tren R2 theo project namespace.
Render/export chi can MotionProjectV1 da bake keyframes.
```
