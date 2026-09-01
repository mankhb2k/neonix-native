# Atomic Protocol V2 Audio Guide

This is a static guide to the Atomic Protocol V2 audio domain. Audio is a
project-level domain that runs beside the visual scene graph. It is not a
visual layer, does not use Matrix4, and is not rendered by WebGPU or WebGL2.

The same audio contract feeds the runtime `RuntimeAudioMixPlanV3`, browser
playback, and Remotion export. Protocol semantics stop at the runtime plan;
decoding and scheduling belong to the preview/export adapters.

## Audio Model

The audio branch has four important concepts:

| Concept | Purpose |
| --- | --- |
| Audio asset | A direct audio file such as MP3, WAV, or another supported source |
| Video asset source | An explicit reference to the audio stream inside a video asset |
| Track | A mix lane with gain, pan, mute state, and ordered clips |
| Clip | A bounded timed use of one source asset with trim, playback rate, gain, and fades |

The root project always contains an audio domain. A silent project uses an
empty track list:

```json
{
  "audio": {
    "sampleRate": 48000,
    "tracks": []
  }
}
```

`sampleRate` is fixed at `48000` in the first V2 release. Audio is not placed
inside `layers[]`.

## Asset Sources

### Direct audio asset

Use an `audio` asset for a standalone music file, voice recording, or sound
effect. The clip references it through `assetId`.

```json
{
  "id": "music-island",
  "kind": "audio",
  "uri": "/assets/music/Music-MBB-Island-Tropical_128k.mp3",
  "mimeType": "audio/mpeg",
  "duration": 124.551837,
  "sampleRate": 44100,
  "channels": 2
}
```

### Audio from a video asset

Video audio is opt-in. A video layer does not automatically create an audio
clip. To use the video's audio stream, add a separate audio clip that points
to the `video` asset id.

```json
{
  "id": "video-with-audio",
  "kind": "video",
  "uri": "/preview/video/demo-video.mp4",
  "mimeType": "video/mp4",
  "width": 1920,
  "height": 1080,
  "duration": 60.5,
  "fps": 30
}
```

## Track and Clip JSON

A track owns the mix controls that apply to all of its clips. A clip owns the
source and timeline controls for one use of that source.

```json
{
  "audio": {
    "sampleRate": 48000,
    "tracks": [
      {
        "id": "music-track",
        "gainDb": -3,
        "pan": 0,
        "muted": false,
        "clips": [
          {
            "id": "music-clip",
            "assetId": "music-island",
            "timing": {
              "start": 0,
              "duration": 20
            },
            "trim": {
              "start": 52,
              "end": 72
            },
            "playbackRate": 1,
            "gainDb": -6,
            "fadeIn": {
              "duration": 4,
              "curve": "linear"
            },
            "fadeOut": {
              "duration": 4,
              "curve": "equal-power"
            }
          }
        ]
      }
    ]
  }
}
```

### Required clip fields

| Field | Meaning |
| --- | --- |
| `id` | Globally unique audio clip id |
| `assetId` | Existing `audio` or `video` asset id |
| `timing.start` | Composition time at which the clip begins, in seconds |
| `timing.duration` | How long the clip is audible in the composition, in seconds |
| `trim.start` | Source-media start position, in seconds |
| `trim.end` | Optional source-media end position, in seconds |
| `playbackRate` | Source playback speed; `1` is normal speed |
| `gainDb` | Clip gain in decibels; `0` is unchanged |
| `fadeIn` | Optional gain envelope at the beginning of the clip |
| `fadeOut` | Optional gain envelope at the end of the clip |

`timing` and `trim` use different clocks. For example, the JSON above places
20 seconds of source audio from `52s` through `72s` at composition time `0s`
through `20s`.

## Gain, Pan, and Mute

Track and clip gain are additive in decibels. In this example the final track
gain before fades is `-12 dB`:

```json
{
  "id": "music-track",
  "gainDb": -6,
  "pan": 1,
  "muted": false,
  "clips": [
    {
      "id": "music-clip",
      "assetId": "music-island",
      "timing": { "start": 0, "duration": 10 },
      "trim": { "start": 52, "end": 62 },
      "playbackRate": 1,
      "gainDb": -6
    }
  ]
}
```

- `gainDb: 0` leaves the signal unchanged.
- Negative gain attenuates the signal; positive gain boosts it.
- `pan: -1` is hard left, `0` is centered, and `1` is hard right.
- `muted: true` silences the complete track without deleting its clips.

## Fade Curves

V2 currently supports exactly two fade curves:

| Curve | Behavior | Best use |
| --- | --- | --- |
| `linear` | Gain changes evenly from zero to full, or full to zero | Simple, predictable fades and tests |
| `equal-power` | Uses a sine/cosine power curve to preserve perceived energy | Music fades and crossfades that should sound smooth |

For a normalized progress value `p` from `0` to `1`:

- Linear fade-in: `gain = p`
- Linear fade-out: `gain = 1 - p`
- Equal-power fade-in: `gain = sin(p * PI / 2)`
- Equal-power fade-out: `gain = cos(p * PI / 2)`

At the midpoint, linear gain is `0.5` (about `-6 dB`) while equal-power gain
is about `0.707` (about `-3 dB`). This is why equal-power usually sounds less
like the signal is dipping during a musical transition.

```json
{
  "fadeIn": {
    "duration": 4,
    "curve": "linear"
  },
  "fadeOut": {
    "duration": 4,
    "curve": "equal-power"
  }
}
```

Fade duration cannot be longer than the clip duration. The compiler lowers
fades into the runtime `RuntimeAudioMixPlanV3` gain envelope, which both the
WebAudio preview adapter and Remotion export consume.

## Bounded Clips and Playback Rate

`trim` selects the source range. Audio clips are always bounded: playback stops
when the clip reaches `timing.duration` or the trimmed source range ends. To
repeat audio, the compiler/editor expands the repeated use into multiple clips
with distinct `id` values on the same track. This keeps the protocol
deterministic and avoids backend-specific looping behavior.

```json
{
  "timing": {
    "start": 5,
    "duration": 20
  },
  "trim": {
    "start": 0,
    "end": 4
  },
  "playbackRate": 1
}
```

With `playbackRate: 2`, the source plays twice as fast. With `0.5`, it plays
at half speed. The source range and the composition duration remain separate.

## Complete Minimal Project Shape

The following shows where audio sits in a complete V2 project. The visual
layer list may be empty while the audio domain is being developed.

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "id": "audio-project-v2",
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background": "#101820",
    "colorSpace": "srgb",
    "view": {
      "projection": {
        "kind": "orthographic",
        "zoom": 1,
        "near": 1,
        "far": 4000
      },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "assets": [
    {
      "id": "music-island",
      "kind": "audio",
      "uri": "/assets/music/Music-MBB-Island-Tropical_128k.mp3",
      "mimeType": "audio/mpeg",
      "duration": 124.551837,
      "sampleRate": 44100,
      "channels": 2
    }
  ],
  "layers": [],
  "audio": {
    "sampleRate": 48000,
    "tracks": []
  }
}
```

## Deferred Curves

V2 should keep `linear` and `equal-power` stable until the runtime and export
path are driven by `AudioMixPlanV2`. Curves such as `exponential`, `smoothstep`,
and `cubic` may be added later, but only when their math, preview behavior, and
Remotion export behavior can be defined and tested from the same mix plan.

These are not part of the current V2 protocol and must not be emitted in JSON
yet.
