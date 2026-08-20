# `@motionvideo/motion-mcp`

Transport-agnostic MCP operations for Atomic Protocol V2.

The package accepts only `format: "motion-protocol"` with
`formatVersion: 2`. Its compile operation calls `compileProtocolV2` and
returns `RuntimeProjectV2`; it never converts or executes an older project
format.

```text
AI / MCP operation
        |
  Protocol V2 JSON
        |
  compileProtocolV2
        |
  RuntimeProjectV2
```

V2 patch operations are intentionally flat while Group is not certified:
`addLayer`, `updateLayer`, `removeLayer`, `trimLayer`, `setComposition`, and
`setValue`. Every patch is validated against the strict V2 schema before it is
returned.
