# HTML compiler / Skia `filter: drop-shadow()` parity

The E2E suite compares the user-visible Browser CSS iframe with the
CanvasKit/Skia canvas at the same display size. It deliberately measures the
rendered surface rather than Protocol JSON alone.

Test file:

- `apps/web/e2e/html-compiler-filter-drop-shadow-parity.spec.ts`

Coverage:

- zero-blur alpha silhouette;
- blur-only alpha silhouette;
- offset-only alpha silhouette;
- offset plus blur;
- rounded source geometry, so a rectangular `box-shadow` fallback is detected;
- Protocol `source: "alpha"` and runtime diagnostics.

## Acceptance contract

The current contract is display-surface based, not byte-for-byte golden
equality:

- shadow bounds: each edge within **6 display pixels**;
- changed pixel ratio: below **3.5%**;
- mean absolute channel delta: below **1.5**;
- non-zero blur chroma: Skia retains at least **60%** of the Browser reference;
- no `unsupported` or `fallback` runtime diagnostic;
- Protocol must contain an ordered `shadow` effect with `source: "alpha"`.

The 6-pixel geometry tolerance covers device/display scaling and the small
coverage difference between Chrome's filter rasterizer and CanvasKit's image
filter. The 3.5% aggregate threshold catches a missing, rectangular, or
materially displaced shadow without requiring identical blur kernels.

Zero-blur is intentionally validated through Protocol, diagnostics and the
owner-surface diff: an opaque owner hides a coincident alpha shadow in both
renderers, so a halo-pixel assertion would be invalid for that case.

## Measured Chromium baseline

The baseline is captured on the standard 494x278 preview surface. Values can
vary slightly with browser/CanvasKit versions, but the acceptance contract
must remain unchanged unless the renderer calibration changes.

| Case | Changed ratio | Mean delta | Browser bounds | Skia bounds |
| --- | ---: | ---: | --- | --- |
| zero blur | 1.14% | 0.434 | not visible under opaque owner | not visible under opaque owner |
| blur only | 3.13% | 0.683 | 166,89–326,172 | 167,90–324,170 |
| offset only | 1.32% | 0.373 | 178,99–329,175 | 178,100–329,175 |
| offset + blur | 2.99% | 0.659 | 174,96–333,178 | 176,98–331,176 |

The remaining difference is a bounded rasterization difference in blur coverage,
not a different CSS effect order or a different alpha source.
