# `@motionvideo/ai-planner`

AI tooling is currently a strict Protocol V2 boundary. It validates,
patches, and compiles Atomic Protocol V2 documents; it does not generate or
execute the retired authoring format.

```text
AI output / user document
          |
  validateAtomicProtocolV2
          |
  applyAtomicProtocolV2Patch
          |
  compileAtomicProtocolV2
```

High-level patterns, templates, and scene planning are deliberately disabled
until the underlying V2 atoms are certified one by one. This keeps AI output
from becoming an untested second protocol.
