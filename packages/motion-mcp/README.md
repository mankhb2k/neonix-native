# `@motionvideo/motion-mcp`

Transport-agnostic MCP operations for Atomic Protocol V2 and HTML authoring.

The package accepts only `format: "motion-protocol"` with
`formatVersion: 2`. Its compile operation calls the canonical `compileProtocol`
and returns `RuntimeProjectV3`; it never converts or executes an older project
format.

```text
create_project(Protocol V2 JSON)
        |
get_project_html → edit HTML → validate_html
        |
update_project_html
        |
project_html_revision + linked project_revision
        |
Protocol V2 JSON → compileProtocol → RuntimeProjectV3
```

HTML is an authoring source attached to an existing JSON project. The hosted
MCP flow never converts JSON back to HTML. `get_project_json` is read-only and
`apply_json_patch` is an explicit escape hatch for small changes that HTML
cannot express.

The hosted adapter also exposes project-scoped media and export operations:

```text
list_assets
request_asset_upload → upload to R2 → complete_asset_upload
import_asset
attach_asset_to_project
delete_asset
create_export → get_export → get_export_download_url
cancel_export
```

Asset writes require editor access. URL imports are limited to public HTTP(S)
hosts, supported media MIME types and the account upload quota. Export reads a
saved Protocol V2 revision from the database; an unsaved arbitrary document
cannot be exported through MCP. Completed artifacts are persisted to the
private exports bucket and exposed only through a short-lived signed URL.

V2 patch operations are intentionally flat while Group is not certified:
`addLayer`, `updateLayer`, `removeLayer`, `trimLayer`, `setComposition`, and
`setValue`. Every patch is validated against the strict V2 schema before it is
returned.

## Remote server integration

`createRemoteMcpServer` registers the remote project and authoring tools without
depending on Next.js or Supabase. The web app supplies a small persistence
adapter so RLS and deployment-specific authentication remain at the edge:

```ts
import { createRemoteMcpServer } from "@motionvideo/motion-mcp/remote";

const server = createRemoteMcpServer({ api: projectApi });
```

The HTTP transport and JWT validation belong in the host application; this
package owns the MCP tool contracts and registration.

## Tool annotations

Every registered tool publishes explicit MCP annotations for
`readOnlyHint`, `openWorldHint`, `destructiveHint`, and `idempotentHint`.
These hints are shared by ChatGPT, Claude, Cursor, and other MCP clients:

- read-only tools use `readOnlyHint: true`;
- project, revision, asset-upload, and export creation tools are additive;
- deletion and cancellation tools use `destructiveHint: true`;
- `import_asset` uses `openWorldHint: true` because it fetches a user-supplied URL;
- all other tools operate inside Neonix and use `openWorldHint: false`.

The OpenAI submission manifest may repeat the first three fields and add
review justifications, but those justifications are not part of the runtime
MCP protocol.
