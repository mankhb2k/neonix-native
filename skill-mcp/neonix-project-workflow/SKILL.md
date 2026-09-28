---
name: neonix-project-workflow
description: Create, inspect, update, open, and safely manage Neonix projects and their persisted Protocol V2 revisions.
---

# Neonix Project Workflow

## Purpose

Use this skill to create, inspect, update, open, and safely manage Neonix
projects through the hosted MCP server.

Neonix projects come in two independent, complete forms. A project created
with `create_project_html` stores raw HTML/CSS as-is, with no compile step and
no Protocol V2 revision — it is a complete project on its own, not one waiting
to be finished. A project that has a Protocol V2 revision (created from the
Neonix dashboard, or converted there from an HTML project — no MCP tool does
that conversion) treats HTML as an authoring source attached to it, which is
no longer the canonical source of truth after a later JSON-only patch.

## Available tools

- `list_workspaces`
- `create_project_html`
- `list_projects`
- `get_project`
- `update_project`
- `delete_project`
- `open_editor`
- `get_project_html`
- `update_project_html`
- `get_project_json`
- `apply_json_patch`

## Selecting a workspace

When the user does not specify a workspace:

1. Call `list_workspaces`.
2. Prefer the user's personal or default workspace.
3. Ask the user to choose when multiple workspaces are equally plausible.

Do not create a project in an arbitrary workspace when the user's intent is
ambiguous.

## Creating a project

When the user asks for a new project:

1. Follow the Neonix HTML Authoring skill to draft and validate a complete
   Neonix HTML document for the requested composition.
2. Call `create_project_html` with a concise title, the selected workspace,
   and the validated HTML — this creates the project and saves the HTML in
   one step (no separate Protocol V2 revision).
3. Return the project identifier or stable public reference.
4. Use `open_preview` to show the result. `open_editor` only works once the
   project has a Protocol V2 revision, which an HTML-only project does not —
   that conversion has no MCP tool and requires the Neonix dashboard.

Do not imply that an unsaved HTML draft is already a persisted project revision.

## Reading a project

Use `list_projects` for discovery and `get_project` for one project. Use
`get_project_html` when the user wants to edit HTML. Use `get_project_json` when
the user wants to inspect the canonical Protocol V2 document.

Do not reconstruct HTML from JSON. The project may contain HTML revisions that
are not equivalent to every later JSON-only patch.

## Updating a project

- Use `update_project` for project metadata or an editor document update.
- Use `update_project_html` for HTML authoring changes — it only works before
  the project has ever had a Protocol V2 revision; once it has one, this tool
  is rejected and the JSON side (`apply_json_patch`, the editor) takes over.
- Preserve revision guards such as `expected_revision_no`,
  `expected_html_revision_no`, and `expected_protocol_revision_no` whenever
  they are available.
- If a revision conflict occurs, re-read the latest project or HTML revision,
  merge the user's requested change, and retry only once with the new guard.

Never overwrite a newer revision silently.

## Destructive actions

`delete_project` is destructive. Call it only when the user explicitly asks to
delete a named project. Confirm the target when the project identifier is
ambiguous. Explain that deletion follows the configured retention policy when
the tool reports one.

Do not delete a project merely because the user wants to start a new revision.
Neonix revisions are intended to preserve project history.

## Response rules

Always distinguish between:

- a project created in the database;
- an HTML source validated in memory;
- an HTML source saved as a new revision;
- a Protocol V2 JSON revision;
- a project opened in the web editor.

Return stable identifiers and revision numbers when available. Do not expose
access tokens, internal database details, or private storage keys.
