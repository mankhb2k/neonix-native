# PR-3 Kinetic vertical slice

- Brief: [`docs/fixtures/ai/positive/kinetic-brief-hook-benefit-cta.json`](../fixtures/ai/positive/kinetic-brief-hook-benefit-cta.json)
- Gate: `pnpm validate:ai-fixtures` runs `runGenerationLoop` (from-scratch → recipes → critic → contact sheet)
- Expect: ≥3 scenes (hook/benefit/cta), critic without error severity, contact-sheet frames ≥1

Pixel frame goldens for A1 remain deferred; fingerprint contact sheet is the acceptance signal for this slice.
