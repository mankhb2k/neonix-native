# Audio Domain V2 Completion Plan

> Status: Phase 0 through Phase 6 implemented; Phase 7 planned
>
> Scope: complete the audio domain of Atomic Protocol V2 across protocol,
> compiler, runtime, playback preview, and Remotion export.
>
> This is a deliberate V2-only breaking change. Do not add a V1 adapter or
> preserve a second audio representation.

## 1. Goal

Audio belongs to the same project as visual content, but it is not part of the
3D scene graph. It must not pass through Matrix4, view projection,
`RuntimeFrameV2`, or `PaintCommandBuffer`.

The canonical public type remains `MotionProtocolV2`. Do not introduce a
parallel `MotionProjectV2` root type or alias.

```text
MotionProtocolV2
        |
        +--> layers[] --> visual runtime --> RuntimeFrameV2 --> paint commands
        |
        +--> audio    --> audio runtime  --> AudioMixPlanV2
                                               |
                         +---------------------+--------------------+
                         |                                          |
                     Web preview                              Remotion export
                         |                                          |
                    WebAudio mixer                         audio render/mix
                         \                                          /
                          \                                        /
                                   final encoded media
```

## 2. Non-goals

This plan does not build editor timeline UI, waveform UI, beat detection,
automatic ducking, DAW buses, EQ, compression, spatial audio, recording, or
plugin-defined audio effects.

Waveform data is derived asset metadata for a future UI. It is never part of
the Atomic Protocol and is never required for preview or export.

## 3. Final Protocol Shape

`audio` is required, including for silent projects. A silent project uses an
empty `tracks` array. This makes the root document shape stable and removes
the current `composition.audioSampleRate` field.

```ts
type MotionProtocolV2 = {
  format: "motion-protocol";
  formatVersion: 2;
  id: string;
  composition: CompositionV2;
  assets: AssetV2[];
  layers: VisualLayerAtomV2[];
  audio: AudioDomainV2;
};

type AudioDomainV2 = {
  sampleRate: 48000;
  tracks: AudioTrackV2[];
};

type AudioTrackV2 = {
  id: string;
  gainDb: number;
  pan: number; // -1 through 1
  muted: boolean;
  clips: AudioClipV2[];
};

type AudioClipV2 = {
  id: string;
  assetId: string;
  timing: { start: number; duration: number };
  trim: { start: number; end?: number };
  playbackRate: number;
  loop: boolean;
  gainDb: number;
  fadeIn?: AudioFadeV2;
  fadeOut?: AudioFadeV2;
};

type AudioFadeV2 = {
  duration: number;
  curve: "linear" | "equal-power";
};
```

The schema may use defaults internally while parsing, but Compiler A and any
plugin lowering to V2 must emit the values explicitly. Atomic JSON must not
depend on editor-only mute, solo, selection, lane height, waveform, or cache
state.

### 3.1 Audio asset sources

Add `kind: "audio"` assets with immutable delivery metadata:

```ts
type AudioAssetV2 = {
  id: string;
  kind: "audio";
  uri: string;
  mimeType: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  integrity?: string;
};
```

An `AudioClipV2` may reference either an `audio` asset or a `video` asset. A
video layer remains visual-only: `video.payload.muted` controls only that
layer's visual media behavior and must not create, remove, or alter an audio
clip. Referencing a video asset from `audio.tracks` is the only explicit way
to use its audio stream.

### 3.2 Time and mix semantics

- All protocol timing is seconds in composition time.
- `audio.sampleRate` is fixed at 48,000 Hz in the first V2 release.
- Runtime converts seconds to integer output samples with one shared,
  deterministic rounding rule.
- `timing.duration` is duration on the composition timeline, not source
  duration.
- `trim` is source-media time before playback-rate conversion.
- `loop: false` makes a clip silent after its available source span ends.
- `loop: true` repeats the trimmed source span until timeline duration ends.
- Track gain and clip gain are summed in dB before conversion to linear gain.
- Track pan is applied after clip gain with a documented equal-power stereo
  pan law.
- Fades apply to the clip's local timeline coverage before track gain and pan.
- Overlapping clips mix by summation. No implicit normalization or limiter is
  applied in the atomic contract.

## 4. Runtime Boundaries

Keep visual and audio outputs separate:

```ts
type RuntimeProjectV2 = {
  // Existing visual composition, view, and nodes.
  audio: RuntimeAudioProjectV2;
};

type AudioMixPlanV2 = {
  runtimeFormat: "motion-runtime";
  runtimeVersion: 2;
  sampleRate: 48000;
  startSample: number;
  sampleCount: number;
  inputs: RuntimeAudioInputV2[];
};
```

`RuntimeFrameV2` remains visual-only. Audio evaluation receives a sample
range, not a video-frame index:

```ts
evaluateRuntimeAudioMixV2(runtime, {
  startSample,
  sampleCount,
}): AudioMixPlanV2;
```

The mix plan describes source ranges, loop segments, gain envelopes, pan, and
active clip order. It does not hold decoded PCM, browser nodes, GPU resources,
or FFmpeg command strings.

## 5. Phased Work

### Phase 0 - Lock audio decisions

Status: complete.

- Record the final protocol shape and timing rules in this document.
- Decide that 48 kHz stereo output is the V2 baseline.
- Confirm that `audio` is required and silent documents use `tracks: []`.
- Confirm that waveform, solo, editor selection, and media decode caches are
  outside the protocol.
- Confirm that a video asset's audio needs an explicit `AudioClipV2`.

Acceptance:

- No task starts with an ambiguous meaning for trim, loop, fade, gain, or
  clock ownership.

### Phase 1 - Protocol and JSON schema

Status: complete.

- Add `src/v2/audio.ts` in `packages/motion-protocol`.
- Add `AudioAssetV2` and include it in `V2AssetSchema`.
- Add required `audio: AudioDomainV2` to `MotionProtocolV2Schema` and types.
- Remove `composition.audioSampleRate` from the schema and all V2 fixtures.
- Validate unique track ids and globally unique audio clip ids.
- Validate `pan` range, positive playback rate, valid trim ranges, finite dB,
  fade duration inside clip duration, and only audio/video source assets.
- Regenerate `schema/v2.json`, protocol docs, public exports, and root API
  regression tests.

Acceptance:

- A silent V2 document parses only with `audio: { sampleRate: 48000, tracks: [] }`.
- Invalid source type, duplicate ids, invalid fades, and invalid trim fail at
  the protocol boundary.
- No V2 schema or fixture still uses `composition.audioSampleRate`.

### Phase 2 - Audio atomic fixture catalog and certification ledger

Status: complete. These capabilities begin as fixture-only and are promoted to
`runtime-ready` by Phase 3. Preview scheduling and export parity remain later
certification gates.

- Add concise V2 fixtures for silence, one audio asset, one video-audio
  source, trim, loop, gain, pan, fade-in, fade-out, overlapping clips, and
  muted track.
- Add explicit capabilities such as `audio.asset`, `audio.timing`,
  `audio.trim`, `audio.loop`, `audio.gain`, `audio.pan`, `audio.fade`, and
  `audio.track.mute`.
- Certify a capability only after protocol, runtime, preview, and export tests
  exist for it.
- Do not put visual capabilities, Matrix4, layer z-index, or paint terms in
  the audio ledger.

Acceptance:

- Every supported audio field has one named fixture and one certification
  capability.
- The browser preview shows the shared MP3 as an asset audition and displays
  the parsed track/clip contract. It does not claim WebAudio scheduling parity;
  that belongs to Phase 6.

### Phase 3 - Compiler lowering to Runtime Audio IR

Status: complete. Compiler V2 now lowers the root audio domain into a separate
Runtime Audio IR, resolves immutable source metadata, and includes audio clip
ends in the compiled project duration. No decoded media or playback scheduler
is introduced in this phase.

- Extend `compileProtocolV2()` so it lowers the root audio domain alongside
  visual nodes.
- Add `RuntimeAudioProjectV2`, `RuntimeAudioTrackV2`, and
  `RuntimeAudioClipV2` to `packages/motion-runtime/src/v2/types.ts`.
- Resolve each asset id to immutable audio source metadata and preserve source
  URI and integrity as data, never as a decoded resource.
- Reject uncertified audio capabilities during compilation.
- Compute project duration as the maximum of visual node duration and audio
  clip duration.

Acceptance:

- Compiling a silent project yields an empty audio runtime domain.
- Audio compilation does not modify visual `RuntimeNodeV2` or Matrix4 values.
- A project with only audio has a non-zero runtime duration.

### Phase 4 - Sample-accurate audio evaluation

Status: complete. Runtime V2 now exposes deterministic seconds/sample helpers
and a pure `evaluateRuntimeAudioMixV2()` evaluator. It emits stable ordered
mix inputs with trim ranges, loop segments, gain envelopes, pan, mute state,
and source metadata. It does not access clocks, decoders, WebAudio, or video
frames.

- Add deterministic seconds-to-sample helpers in `motion-runtime`.
- Implement `evaluateRuntimeAudioMixV2()` as a pure evaluator of sample
  ranges.
- Emit ordered mix inputs with exact composition sample bounds, source ranges,
  loop boundaries, gain envelopes, and pan values.
- Define one stable ordering rule: track order, then clip order, then clip id.
- Add tests at trim boundaries, source end, loop wrap, fade endpoints, overlap,
  negative dB, pan extremes, and frame/sample non-integer times.

Acceptance:

- The same project and sample range always produce byte-equivalent mix-plan
  JSON and hash.
- Evaluation never depends on `requestAnimationFrame`, `AudioContext.currentTime`,
  browser decode timing, or video frame quantization.

### Phase 5 - Shared transport and playback engine

Status: complete. Playback Engine V2 now coordinates visual frame evaluation
and audio sample-range plans from one monotonic composition clock. It does not
decode media or create WebAudio nodes.

- Extend `packages/playback-engine` into a coordinator for visual frame
  evaluation and audio sample-range scheduling from one monotonic composition
  clock.
- Keep `RuntimeFrameV2` and `AudioMixPlanV2` as distinct consumer outputs.
- Update playback duration, seek, pause, resume, and end-of-project behavior
  to include audio-only projects.
- Define seek preroll and scheduling policy so WebAudio can restart without a
  second independent clock.
- Keep source decoding and WebAudio node creation outside the pure playback
  engine.

Acceptance:

- Visual and audio consumers receive the same composition time after play,
  pause, seek, and resume.
- Audio-only projects can play and seek without requiring a visual node.
- Audio scheduling exposes a deterministic block window and seek preroll while
  keeping `RuntimeFrameV2` and `RuntimeAudioMixPlanV2` as separate outputs.
- Playback duration is the maximum of declared composition, visual node, and
  audio clip duration.

### Phase 6 - Web preview audio adapter

Status: complete. The browser preview now consumes `AudioMixPlanV2` through a
renderer-independent WebAudio adapter. The adapter owns browser decode,
resampling, node scheduling, cache, and diagnostics; protocol meaning remains
in Runtime V2.

- Add a browser-only WebAudio adapter behind the preview surface, not inside
  `preview-renderer`.
- Resolve audio/video asset sources, decode, resample to 48 kHz, cache decoded
  buffers by immutable asset identity, and schedule from `AudioMixPlanV2`.
- Apply gain, equal-power pan, trim, loop, and fades exactly as the mix plan
  specifies.
- Handle blocked autoplay, unavailable media, decode failure, and seek with
  explicit diagnostics rather than silent fallback.
- Add a small audio fixture section to `/docs/preview`; keep it separate from
  the visual scene graph categories.

Acceptance:

- Preview video layers remain silent unless an explicit audio clip references
  the same video asset.
- Play, pause, and seek keep scheduled audio within the defined tolerance of
  visual transport time.
- Preview tests verify mix-plan scheduling; browser tests verify audible graph
  construction without relying on human listening.
- Track fixtures in `/docs/preview` use the WebAudio adapter; asset-only
  audition remains an explicit native fallback because it has no atomic clip.
- Decode failures, unavailable sources, closed contexts, and blocked autoplay
  produce stable adapter diagnostics instead of silent fallback.

### Phase 7 - Remotion export adapter

- Extend `packages/remotion-renderer` and `apps/remotion-site` to consume the
  compiled audio runtime domain.
- Lower each active audio clip to the export audio primitive using the same
  trim, loop, gain, pan, fade, and timing semantics as `AudioMixPlanV2`.
- Ensure audio-only projects still generate a valid visual container and
  encoded audio output.
- Verify output duration includes the longest active visual or audio element.
- Do not re-derive protocol semantics in JSX; the adapter consumes Runtime IR.

Acceptance:

- Rendered media contains no audio for `tracks: []`.
- A known PCM or tone fixture renders at the expected start, end, gain, pan,
  trim, loop, and fade boundaries.
- Video-source audio is emitted exactly once when explicitly referenced.

### Phase 8 - Preview/export parity and E2E

- Add deterministic generated tone fixtures plus a small checked-in media
  fixture for decode coverage.
- Compare runtime mix plans for fixed sample windows before testing adapters.
- Add preview E2E for transport, explicit video audio, mute, trim, loop, and
  fade scheduling.
- Add export E2E that renders media, extracts audio, and samples PCM at known
  timestamps.
- Define tolerances separately for exact plan data and decoded/encoded PCM.

Acceptance:

- Exact Runtime Audio IR and `AudioMixPlanV2` match with zero tolerance.
- Preview and export use the same clip timing and gain envelope within the
  documented decoder/encoder tolerance.
- Every certified audio capability has protocol, runtime, preview, and export
  coverage.

### Phase 9 - Hard lock and documentation

- Remove remaining V2 uses of `composition.audioSampleRate`.
- Ensure compiler, runtime, playback, preview, and Remotion import V2 audio
  types only.
- Do not import editor timeline audio models into the protocol or runtime.
- Update the static V2 docs with conceptual audio material only; keep real
  audio fixtures in `/docs/preview`.
- Update package READMEs and the capability ledger with certified versus
  planned fields.

Acceptance:

- Search confirms one V2 audio schema, one compiler lowering path, one runtime
  mix evaluator, and adapter-only decode/mix code.
- No V1 parser, V1 audio migration, or editor-specific audio object appears in
  the protocol-to-export path.

## 6. Required Test Matrix

| Case | Protocol | Runtime plan | Preview | Export |
| --- | --- | --- | --- | --- |
| Empty audio domain | parse | empty plan | silent | silent output |
| Audio asset | source validation | input range | decode | encoded audio |
| Video asset audio | explicit source only | input range | one source | one source |
| Trim | bounds | source range | seek | extracted PCM |
| Loop | valid span | repeat segments | continuous | continuous |
| Gain | finite dB | envelope | node gain | PCM amplitude |
| Pan | range | pan coefficients | stereo nodes | channel energy |
| Fade | valid duration | envelope endpoints | scheduled ramp | amplitude ramp |
| Overlap | valid clips | stable order | mixed output | mixed PCM |
| Mute | track field | omitted/silent input | silent track | silent track |
| Audio-only project | valid root | duration | transport | encoded output |

## 7. Delivery Order and Commit Boundaries

Keep commits small and V2-only:

1. `protocol: add atomic audio domain v2`
2. `test: add audio v2 fixture catalog`
3. `compiler: lower v2 audio runtime`
4. `runtime: evaluate deterministic audio mix plans`
5. `playback: coordinate visual and audio transport`
6. `preview: schedule v2 audio through web audio`
7. `export: render v2 audio through remotion`
8. `test: certify v2 audio preview export parity`
9. `docs: document certified v2 audio domain`

Do not begin Phase 6 before Phases 1 through 5 are accepted. Do not certify a
field from a visual preview alone. Audio is complete only when the same V2
audio contract reaches both preview and export.

## 8. Deferred Audio Vocabulary

These may become high-level authoring features or later audio-domain operators,
but are intentionally absent from the initial atomic audio release:

- waveform and beat analysis;
- solo, selection, lane layout, track color, and editor cache data;
- loudness normalization and limiting;
- ducking and side-chain behavior;
- EQ, compression, reverb, delay, and plugin effects;
- buses, sends, surround, ambisonics, and spatial positioning;
- captions, transcript, speech generation, and voice cleanup.
