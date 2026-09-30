# `@motionvideo/motion-mcp`

Transport-agnostic MCP tools for raw HTML authoring (Kiến trúc A, see
`ARCHITECHTURE.md` "Hai kiến trúc render độc lập").

A Neonix MCP project is a raw HTML/CSS document stored as-is and rendered frame
by frame. The hosted server exposes no tool that touches the JSON V2 track
(compiler, Protocol V2 documents, JSON patches, the JSON editor).

```text
create_project_html(HTML + CSS)
        |
get_project_html → edit HTML
        |
update_project_html
        |
open_preview / create_export
```

`create_project_html` is the only public AI project-creation flow. It applies
light validation (one `neonix-document` meta with a valid composition, no
`<script>`, body size matching the composition) and saves the HTML without
compiling it.

The Codex companion skill is available at
`skills/neonix-html-authoring/SKILL.md`. Claude and other MCP clients receive
the equivalent guidance through the `neonix://docs/workflows` resource and
the `create_html_project` / `edit_html_project` prompts.

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
hosts, supported media MIME types and the account upload quota. Completed
artifacts are persisted to the private exports bucket and exposed only through
a short-lived signed URL.

## Remote server integration

`createRemoteMcpServer` registers the remote project and authoring tools without
depending on Next.js or a database. The web app supplies a small persistence
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

Access control is identity-based only: every tool call runs as the
authenticated `principal.userId`, and persistence-layer RLS scopes each
operation to that user's own workspaces/projects. There is no separate
operation-scope gate — Better Auth (the OAuth authorization server) only
issues `openid`/`profile`/`email`/`offline_access`, so a client-requested
scope like `projects:write` can never actually be granted, and gating tool
calls on it would lock out every legitimately authenticated caller.
