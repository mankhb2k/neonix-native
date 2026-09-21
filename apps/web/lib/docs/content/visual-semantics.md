---
slug: atoms/paint
title: Paint and SVG definitions
description: How fill, stroke, gradients, patterns and named paint servers work as semantic, SVG-compatible paint data in Neonix JSON V2.
---
# Paint and SVG definitions

## Paint is semantic data

V2 keeps fill, stroke, opacity, paint order and markers separate. A paint value may be a color, none, currentColor, context-fill, context-stroke or a structured paint object.

```json
{
  "style": {
    "fill": { "type": "reference", "id": "brand-gradient" },
    "fillOpacity": 1,
    "stroke": "#FFFFFF",
    "strokeWidth": 3,
    "paintOrder": ["fill", "stroke", "markers"]
  },
  "paintServers": [
    {
      "id": "brand-gradient",
      "paint": {
        "type": "linear-gradient",
        "angle": 90,
        "stops": [
          { "offset": 0, "color": "#3AEDAE" },
          { "offset": 1, "color": "#2563EB", "stopOpacity": 0.8 }
        ]
      }
    }
  ]
}
```

## Gradients, patterns and references

Linear, radial and conic gradients preserve SVG coordinates, units, spread method, transforms and stops. Patterns preserve their content nodes and viewBox. Named paint servers live at the root and are referenced by id. Unknown ids and reference cycles are rejected.

## Stroke and markers

Stroke width, opacity, cap, join, miter limit, dash and vectorEffect map directly to SVG semantics. Marker start, mid and end point to root marker definitions.


---
slug: atoms/effects
title: Effects, masks, and composite
description: The ordered atomic effects (blur, shadow, glow, color-adjust), masks and composite/blend model available on a Neonix JSON V2 layer.
---
# Effects, masks, and composite

## Ordered operators

Effects are explicit operators evaluated in order. The order is part of the visual meaning.

```json
{
  "effects": [
    { "type": "blur", "radius": 24 },
    { "type": "shadow", "source": "alpha", "offset": { "x": 18, "y": 20 }, "blur": 16, "spread": 0, "color": "#00000040", "inset": false }
  ],
  "composite": { "opacity": 1, "blendMode": "normal" }
}
```

## Atomic effects

The layer `effects` list supports these deterministic atomic operators. A list may contain at most eight effects, and every effect id must be unique within that layer.

| Type | Purpose | Main fields |
| --- | --- | --- |
| `color-adjust` | Brightness, contrast, saturation and hue in one operator | `brightness`, `contrast`, `saturation`, `hueRotate` |
| `grayscale` | Interpolate from the source color to grayscale | `amount`: 0–1 |
| `sepia` | Interpolate from the source color to sepia | `amount`: 0–1 |
| `invert` | Interpolate toward inverted color | `amount`: 0–1 |
| `filter-opacity` | Apply alpha as an ordered filter operation | `amount`: 0–1 |
| `blur` | Gaussian blur of the rendered layer | `radius` |
| `shadow` | Box shadow or alpha/drop shadow | `source`, `offset`, `blur`, `spread`, `color`, `inset` |
| `outer-glow` | Glow outside the final alpha silhouette | `radius`, `color`, `opacity` |
| `inner-glow` | Glow inside the final alpha silhouette | `radius`, `color`, `opacity` |
| `noise` | Deterministic grain over the layer surface | `scale`, `amount`, `opacity`, `seed` |

Example combining color, blur, glow and deterministic grain:

```json
{
  "effects": [
    {
      "id": "tone",
      "type": "color-adjust",
      "brightness": 0.04,
      "contrast": 1.08,
      "saturation": 1.15,
      "hueRotate": 0
    },
    { "id": "soften", "type": "blur", "radius": 8 },
    { "id": "halo", "type": "outer-glow", "radius": 18, "color": "#2ee6c5", "opacity": 0.55 },
    { "id": "grain", "type": "noise", "scale": 2, "amount": 0.08, "opacity": 0.2, "seed": 42 }
  ]
}
```

### Shadow sources

`shadow` has two explicit sources:

- `box`: uses the layer border box and supports spread and inset.
- `alpha`: follows the rendered alpha silhouette; spread must be `0` and `inset` must be `false`.

```json
{
  "id": "card-shadow",
  "type": "shadow",
  "source": "box",
  "offset": { "x": 0, "y": 16 },
  "blur": 24,
  "spread": 0,
  "color": "#00000066",
  "inset": false
}
```

## Root filter graphs

For SVG filter graphs, define a filter in the document's `filters` collection and reference it from a layer with `filter`. Filter primitives are ordered and can pass named results to later primitives:

`feBlend`, `feColorMatrix`, `feComponentTransfer`, `feComposite`, `feConvolveMatrix`, `feDisplacementMap`, `feDropShadow`, `feFlood`, `feGaussianBlur`, `feImage`, `feMerge`, `feMorphology`, `feOffset`, `feTile`, `feTurbulence`, `feDiffuseLighting` and `feSpecularLighting`.

Use atomic effects for common motion styling. Use a root filter graph when you need compositing, channel math, displacement, convolution, turbulence, merge or lighting primitives.

## Masks

Clip paths, alpha/luminance masks, and isolation describe coverage and compositing relationships. They are not high-level layout features.

Masks can be vector content or an image asset. A mask uses `alpha` or `luminance` mode; multiple CSS mask layers combine with `add`, `subtract`, `intersect` or `exclude`.

```json
{
  "masks": [{
    "id": "reveal-mask",
    "maskType": "luminance",
    "children": [{
      "type": "circle",
      "cx": 240,
      "cy": 135,
      "r": 120,
      "fill": { "type": "solid", "color": "#ffffff" }
    }]
  }],
  "layers": [{
    "id": "photo",
    "mask": "reveal-mask"
  }]
}
```

## Paint and composite opacity

Fill opacity and stroke opacity belong to their paint sources. Layer/composite opacity belongs to the composite result. Keeping them separate makes effect and export behavior predictable.

`composite.blendMode` supports `normal`, `darken`, `multiply`, `color-burn`, `lighten`, `screen`, `color-dodge`, `overlay`, `soft-light`, `hard-light`, `difference`, `exclusion`, `hue`, `saturation`, `color` and `luminosity`. Use `isolation: "isolate"` when a group must composite independently.

`backdropEffects` applies the same atomic effect vocabulary to the already-painted backdrop rather than to the layer's own source.

## Static teaching boundary

The figures in the web guide are explanatory pictures. They do not execute an offscreen pass or initialize a graphics API.
