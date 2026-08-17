# NeonVideo V1 cyber recipe

> Stack `glow` (outer) + `inner-glow` + `noise` trên shape HUD tối.

Không phải effect type mới. `composition.background` tối. Outer cyan, inner magenta. Noise `amount` thấp, `animated` true. Không scanline / chromatic / glitch.

```json
{
  "composition": { "background": "#121218" },
  "effects": [
    {
      "id": "fx-glow-1",
      "type": "glow",
      "radius": 18,
      "color": "#22d3ee",
      "opacity": 70
    },
    {
      "id": "fx-inner-glow-1",
      "type": "inner-glow",
      "radius": 18,
      "color": "#A855FF",
      "opacity": 80
    },
    {
      "id": "fx-noise-1",
      "type": "noise",
      "amount": 12,
      "scale": 1,
      "opacity": 28,
      "animated": true
    }
  ]
}
```

AI: card neon = inner-glow + glow, noise amount thấp, không scanline giả. Không `intensity`, không `seed`.

Xem `/docs/effects/glow`, `/docs/effects/inner-glow`, `/docs/effects/noise`. Không có trang recipe riêng.
