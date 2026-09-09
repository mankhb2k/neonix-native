# Neonix Web API v1

Neonix's product REST API is versioned under `/api/v1`. The API is the
canonical boundary used by the web application, CLI clients and the future
hosted MCP adapter.

## Source model

The HTML-first API keeps three things separate:

1. `document_html`: the authored single-file Neonix HTML document;
2. `compile artifact`: Protocol V2 JSON produced by `@motionvideo/html-compiler`;
3. `render job`: an asynchronous video export created from a validated revision.

The existing editor Protocol V2 persistence remains available under
`/api/v1/editor/projects/:projectId` while the HTML-first project resource is
`/api/v1/projects/:projectId`.

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

## HTML project endpoints

```text
POST /api/v1/projects
GET  /api/v1/projects
GET  /api/v1/projects/:projectId
PUT  /api/v1/projects/:projectId
GET  /api/v1/projects/:projectId/document
GET  /api/v1/projects/:projectId/revisions
GET  /api/v1/projects/:projectId/revisions/:revisionNo
POST /api/v1/projects/:projectId/renders
```

Creating and updating a project stores the final HTML document in an immutable
HTML revision. Updates require `expectedRevisionNo` and return `409` on a
revision conflict.

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
