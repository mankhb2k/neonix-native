# Editor text boundary

This folder contains browser-facing text adapters for the Protocol V2 editor.

- `measurement.ts` uses the runtime shaping pipeline and browser font loading.
- `sizing.ts` converts text measurements into canonical V2 layer patches.
- Future text editing input belongs here as an adapter around the framework-free
  text edit session in `@motionvideo/editor-core/text`.

Stage components should consume these modules instead of keeping text
measurement and sizing logic inside pointer-event components.
