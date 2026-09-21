---
slug: examples
title: Static examples
description: Teaching examples of Neonix JSON V2 documents and high-level authoring intent, shown as static, non-rendered reference code.
---
# Static examples

## Example: a centered card

The following JSON is a teaching example. It is shown as text and is not executed by this page.

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": { "width": 1920, "height": 1080, "fps": 30 },
  "layers": [
    {
      "id": "card",
      "type": "shape",
      "shape": { "kind": "rectangle" },
      "frame": { "width": 720, "height": 420 },
      "fill": "#18B89A",
      "transform": {
        "translate": { "x": 600, "y": 300, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 },
        "anchor": { "x": 0.5, "y": 0.5, "z": 0 }
      }
    }
  ]
}
```

## Example: future intent

```json
{
  "kind": "photo-carousel",
  "items": 4,
  "motion": "orbit"
}
```

This is high-level intent, not an atomic layer. It becomes publishable only after an approved lowering rule exists.

## Visual policy

Static figures may show the expected visual idea. They must not claim to be a pixel comparison with the real preview or export output.

---
slug: examples/project
title: Complete project
description: A complete, minimal Neonix JSON V2 project example combining a root document, a shape layer and a typed animation track.
---
# Complete project

## A small animated composition

This teaching project shows the root, one shape layer and a typed animation track.

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "id": "neon-card",
  "composition": {
    "width": 1080,
    "height": 1080,
    "fps": 30,
    "background": "#07111F",
    "colorSpace": "srgb",
    "view": {
      "projection": { "kind": "orthographic", "zoom": 1, "near": 0.1, "far": 1000 },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "assets": [],
  "layers": [
    {
      "id": "card",
      "parentLayerId": null,
      "order": 0,
      "frame": { "width": 640, "height": 360 },
      "timing": { "start": 0, "duration": 4000 },
      "type": "shape",
      "payload": { "shape": "rectangle", "cornerRadius": 28 },
      "style": { "fill": "#14B8A6" },
      "tracks": [
        {
          "id": "card-in",
          "path": "opacity",
          "keyframes": [
            { "time": 0, "value": { "type": "number", "value": 0 } },
            { "time": 800, "value": { "type": "number", "value": 1 } }
          ]
        }
      ]
    }
  ],
  "audio": { "sampleRate": 48000, "tracks": [] }
}
```

## Add motion

Attach tracks to the layer when the property is atomic and animatable. Keep the layer timing window separate from keyframe times.

