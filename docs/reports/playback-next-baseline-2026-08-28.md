# PlaybackEngine baseline — 2026-08-28

This is the reproducible baseline recorded before changing Runtime V2 or adding
the V3 boundary.

## Repository checks

| Check | Result |
| --- | --- |
| `pnpm --filter @motionvideo/playback-engine test` | 11 files, 49 tests passed |
| `pnpm --filter @motionvideo/playback-engine typecheck` | passed |
| Web playback/controller tests | 3 files, 13 tests passed |

The existing soak report is retained at
`docs/reports/playback-soak-report-2026-08-28.md`.

## Existing runtime observations

- PlaybackEngineV2 schedules from `performance.now()` and does not use an
  `AudioContext` as its master clock.
- The Web Audio adapter fetches and decodes a whole source with
  `decodeAudioData`; its byte cache is not a streaming decode path.
- AudioWorkletMixerV2 still has a coarse gain/pan path and resets source cursor
  state at render boundaries.
- Video playback uses muted HTML video sessions and maps sessions by asset ID;
  this is not sufficient for multiple clip instances of one asset.
- Compiler V2 already lowers embedded video audio to a separate runtime audio
  track. V3 formalizes that boundary instead of changing the protocol.

## Root media inventory

| Asset | Current metadata | Phase 0 decision |
| --- | --- | --- |
| `assets/music/Music-MBB-Island-Tropical_128k.mp3` | MP3, stereo, 44.1 kHz, ~124.55 s, ~2.9 MB | Reuse as background-music fixture |
| `apps/web/public/docs/example-video.mp4` | H.264 Main, 1920×1080, 30 fps, ~60.5 s, AAC stereo 48 kHz, ~154 MB | Reuse as embedded-audio source; do not duplicate it |
| `assets/audio/preview-voice-8s.wav` | not present yet | Add in compiler/preview phase |
| `apps/web/public/docs/fixtures/audio/example-video-audio.m4a` | not present yet | Generate as the explicit audio derivative |

## Baseline risks to track

1. Audio and video clocks can drift when independently anchored.
2. A seek must invalidate pending work from the previous generation.
3. Asset IDs are not clip instance IDs; runtime plans must preserve both.
4. Streaming/proxy support must be an adapter capability, not a compiler rewrite.
