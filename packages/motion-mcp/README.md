# `@motionvideo/motion-mcp`

Transport-agnostic MCP operations for Atomic Protocol V2.

The package accepts only `format: "motion-protocol"` with
`formatVersion: 2`. Its compile operation calls the canonical `compileProtocol`
and returns `RuntimeProjectV3`; it never converts or executes an older project
format.

```text
Claude via Remote MCP
        |
  Protocol V2 JSON
        |
  compileProtocol
        |
  RuntimeProjectV3
```

V2 patch operations are intentionally flat while Group is not certified:
`addLayer`, `updateLayer`, `removeLayer`, `trimLayer`, `setComposition`, and
`setValue`. Every patch is validated against the strict V2 schema before it is
returned.

## Remote server integration

`createRemoteMcpServer` registers Neonix's remote project tools without
depending on Next.js or Supabase. The web app supplies a small persistence
adapter so RLS and deployment-specific authentication remain at the edge:

```ts
import { createRemoteMcpServer } from "@motionvideo/motion-mcp/remote";

const server = createRemoteMcpServer({ api: projectApi });
```

The HTTP transport and JWT validation belong in the host application; this
package owns the MCP tool contracts and registration.
