# Neonix Web API v1

Neonix's product REST API is versioned under `/api/v1`. The API is the
canonical boundary used by the web application, CLI clients and the future
hosted MCP adapter.

An interactive OpenAPI/Swagger reference is available at
`/docs/preview/api` during local development.

## Source model

The project API keeps three things separate:

1. `document_html`: the optional authored single-file Neonix HTML source;
2. `project_revisions.document_json`: the canonical Protocol V2 source of truth;
3. `render job`: an asynchronous video export created from a validated JSON revision.

HTML authoring revisions link to their canonical JSON revision through
`protocol_revision_id`. Rendering never needs to compile HTML again.

`/api/v1/projects/:projectId` is JSON-first. HTML is an authoring subresource
attached to that project. The existing editor persistence remains available
under `/api/v1/editor/projects/:projectId` for compatibility.

## Document endpoints

```text
POST /api/v1/documents/validate
POST /api/v1/documents/compile
```

Both accept:

```json
{ "html": "<!doctype html>..." }
```

`validate` returns diagnostics and composition metadata. `compile` returns a
Protocol V2 document when there are no compiler errors.

## Project endpoints

```text
POST /api/v1/projects                     (Protocol V2 JSON)
GET  /api/v1/projects
GET  /api/v1/projects/:projectId
PATCH /api/v1/projects/:projectId         (Protocol V2 JSON)
DELETE /api/v1/projects/:projectId

GET  /api/v1/projects/:projectId/html
PUT  /api/v1/projects/:projectId/html     (compile + persist HTML)
PATCH /api/v1/projects/:projectId/json    (validated JSON patch)

GET  /api/v1/projects/:projectId/revisions
GET  /api/v1/projects/:projectId/revisions/:revisionNo
GET  /api/v1/projects/:projectId/revisions/:revisionNo/json
POST /api/v1/projects/:projectId/renders
```

Creating a project stores the initial Protocol V2 JSON revision. Updating the
HTML subresource compiles the HTML and atomically stores both an immutable HTML
revision and its linked Protocol V2 revision. JSON and HTML updates use
optimistic revision checks and return `409` on a conflict.

## Shared response errors

```json
{
  "error": {
    "code": "DOCUMENT_INVALID",
    "message": "...",
    "details": [],
    "requestId": "..."
  }
}
```

## Resource endpoints

The existing asset, font, storage and render resources are exposed below the
same prefix:

```text
/api/v1/assets
/api/v1/fonts
/api/v1/account/storage
/api/v1/renders
/api/v1/jobs
/api/v1/system-assets
/api/v1/system-fonts
/api/v1/previews/video
```

Authentication callbacks, OAuth decisions, worker callbacks and the MCP
transport remain outside the REST namespace:

```text
/api/auth
/api/oauth
/api/internal
/api/mcp
```

The old unversioned product routes remain only as temporary compatibility
handlers during local development. New application code must use `/api/v1`.
