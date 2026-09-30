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

1. Create one complete `neonix-document` HTML string, including its style
   blocks and `meta[name="neonix-document"]` manifest, or omit `html` to
   start from the standard blank template.
2. Call `create_project_html` with the HTML, title, workspace and a stable
   `idempotency_key` when the request may be retried.
3. Return the project identity and call `open_preview` to show the result.
4. Call `create_export` only when the user asks for a rendered export.

## Existing project

1. Call `get_project_html` before editing.
2. Preserve the document manifest (one `neonix-document` meta, no
   `<script>`, body size matching the composition).
3. Call `update_project_html` with the latest revision number.
4. On `REVISION_CONFLICT`, read the latest HTML and re-apply the requested
   change instead of overwriting it.

## Safety

Ask for confirmation before destructive operations. Return the error
code/details to the user when a tool call fails.
