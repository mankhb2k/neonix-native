---
slug: animation
title: Animation and timing
description: How typed keyframe tracks, easing and each layer's local time window drive deterministic animation in Neonix JSON V2.
---
# Animation and timing

## Two clocks

Each layer has a composition-time window. Tracks evaluate inside that layer&apos;s local time, so a layer can enter the composition at 1200 ms while its animation still starts at local time 0.

```json
{
  "timing": { "start": 1200, "duration": 2400 },
  "tracks": [
    {
      "id": "move-x",
      "path": "transform.translate.x",
      "keyframes": [
        { "time": 0, "value": { "type": "number", "value": -120 } },
        {
          "time": 600,
          "value": { "type": "number", "value": 0 },
          "easing": {
            "type": "cubicBezier",
            "x1": 0.22,
            "y1": 1,
            "x2": 0.36,
            "y2": 1
          }
        }
      ]
    }
  ]
}
```

## Typed keyframes

Tracks target a dot-separated property path such as transform.translate.x, opacity, style.fill or motion.offsetDistance. Values are explicitly typed as number, vec2, vec3, vec4, color, boolean, string or enum.

Keyframe times are strictly increasing and cannot exceed the layer duration. Vector sizes are fixed and the schema checks that the value kind matches the target property.

## Easing

V2 supports linear, step, cubicBezier and spring easing. interpolation may be linear or discrete. Easing changes how a value is sampled; it does not create an implicit property or a hidden animation.

## Deterministic playback

Preview and export evaluate the same track at the same composition time. No browser CSS animation state is part of the protocol contract.


---
slug: animation/motion-paths
title: Motion paths
description: How a layer-owned motion path moves content along an offset path with distance, rotation and anchor controls.
---
# Motion paths

## A layer-owned path

Motion paths are part of the layer model. The path is not a visible paint and does not create a second layout pass.

```json
{
  "motion": {
    "offsetPath": {
      "type": "path",
      "coordinateSpace": "parent-local",
      "referenceBox": "border-box",
      "contours": [
        {
          "id": "orbit",
          "start": { "x": 100, "y": 100 },
          "segments": [
            { "kind": "cubic", "control1": { "x": 180, "y": 0 }, "control2": { "x": 420, "y": 0 }, "to": { "x": 500, "y": 100 } }
          ],
          "closed": false
        }
      ]
    },
    "offsetDistance": 0,
    "offsetRotate": { "mode": "auto", "angle": 0 },
    "offsetAnchor": { "x": 40, "y": 40 }
  },
  "tracks": [
    {
      "id": "path-progress",
      "path": "motion.offsetDistance",
      "keyframes": [
        { "time": 0, "value": { "type": "number", "value": 0 } },
        { "time": 1400, "value": { "type": "number", "value": 1 } }
      ]
    }
  ]
}
```

## Lowering rules

The HTML/CSS compiler resolves path(), CSS lengths and percentages, then stores offsetDistance as a normalized ratio from 0 to 1. The documented motion-path values compose translation, rotation, anchor and authored transforms.

Only supported deterministic path grammar is accepted. Empty paths, zero-length paths, non-finite values and unsupported grammar produce diagnostics.


---
slug: audio
title: Audio
description: How Neonix JSON V2 models audio as a required parallel timeline of tracks and clips alongside visual layers.
---
# Audio

## A parallel timeline

Audio is a required root domain next to visual layers. A silent project still declares a sample rate and an empty track list.

```json
{
  "audio": {
    "sampleRate": 48000,
    "tracks": [
      {
        "id": "music",
        "gainDb": -3,
        "pan": 0,
        "muted": false,
        "clips": [
          {
            "id": "music-clip",
            "assetId": "audio-001",
            "timing": { "start": 0, "duration": 30000 },
            "trim": { "start": 0, "duration": 30000 },
            "playbackRate": 1,
            "enabled": true,
            "fadeIn": { "duration": 250, "curve": "linear" },
            "fadeOut": { "duration": 500, "curve": "equal-power" }
          }
        ]
      }
    ]
  }
}
```

## Time and mix rules

Clip timing is composition time; trim is source time. Playback rate is positive, pan is normalized to -1..1, and fade durations cannot exceed clip duration. An enabled false clip stays on the timeline while silencing its input.

## Video audio

Embedded video audio stays on video.payload.audio so its visual trim and original audio identity move together.

