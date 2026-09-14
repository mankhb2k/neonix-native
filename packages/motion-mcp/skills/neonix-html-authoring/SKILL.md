---
name: neonix-html-authoring
description: Create and edit Neonix video projects from HTML/CSS through the Neonix MCP server.
metadata:
  short-description: Neonix HTML/CSS project authoring
---

# Neonix HTML authoring

Use this skill when the user wants to create, edit, validate, or export a
Neonix project from HTML/CSS.

## New project

1. Call `get_capabilities` when supported HTML/CSS syntax is unknown.
2. Create one complete `neonix-document` HTML string, including its style
   blocks and `meta[name="neonix-document"]` manifest.
3. Call `create_project_html` with the HTML, title, workspace and a stable
   `idempotency_key` when the request may be retried.
4. Return the project identity and call `open_editor` when an editor link is
   useful.
5. Call `create_export` only when the user asks for a rendered export.

## Existing project

1. Call `get_project_html` before editing.
2. Preserve the document manifest and supported CSS surface.
3. Call `validate_html`, then `update_project_html` with the latest revision
   numbers.
4. On `REVISION_CONFLICT`, read the latest HTML and re-apply the requested
   change instead of overwriting it.

## Source of truth and safety

Protocol V2 JSON is canonical for runtime and export. HTML is the linked
authoring source. Use `get_project_json` for inspection and
`apply_json_patch` only when HTML cannot express the requested change; JSON
patches can make the HTML source stale.

Ask for confirmation before destructive operations. Treat compiler diagnostics
as actionable feedback and return the error code/details to the user when a
tool call fails.
