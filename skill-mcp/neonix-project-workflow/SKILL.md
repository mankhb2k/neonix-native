---
name: neonix-project-workflow
description: Create, inspect, update, preview, and safely manage Neonix HTML projects.
---

# Neonix Project Workflow

## Purpose

Use this skill to create, inspect, update, preview, and safely manage Neonix
projects through the hosted MCP server.

A Neonix MCP project stores raw HTML/CSS as-is. There is no compile step and
no separate JSON document: the HTML is the project, and it is rendered frame
by frame. The MCP tools only work with these HTML projects.

## Available tools

- `list_workspaces`
- `create_project_html`
- `list_projects`
- `get_project`
- `update_project`
- `delete_project`
- `open_preview`
- `get_project_html`
- `update_project_html`

## Selecting a workspace

When the user does not specify a workspace:

1. Call `list_workspaces`.
2. Prefer the user's personal or default workspace.
3. Ask the user to choose when multiple workspaces are equally plausible.

Do not create a project in an arbitrary workspace when the user's intent is
ambiguous.

## Creating a project

When the user asks for a new project:

1. Follow the Neonix HTML Authoring skill to draft a complete Neonix HTML
   document for the requested composition, or omit `html` to start from the
   standard blank template.
2. Call `create_project_html` with a concise title, the selected workspace,
   and the HTML — this creates the project and saves the HTML in one step.
3. Return the project identifier or stable public reference.
4. Use `open_preview` to show the result.

Do not imply that an unsaved HTML draft is already a saved project.

## Reading a project

Use `list_projects` for discovery and `get_project` for one project. Use
`get_project_html` when the user wants to read or edit the HTML.

## Updating a project

- Use `update_project` to rename a project.
- Use `update_project_html` to replace the project's HTML. It overwrites the
  single current document; there is no revision history, so read the latest
  HTML with `get_project_html` first and apply the smallest change.

Never overwrite the user's HTML with a rewrite they did not ask for.

## Destructive actions

`delete_project` is destructive. Call it only when the user explicitly asks to
delete a named project. Confirm the target when the project identifier is
ambiguous. Explain that deletion follows the configured retention policy when
the tool reports one.

## Response rules

Always distinguish between:

- a project created in the database;
- an HTML draft that has not been saved;
- an HTML source saved to the project;
- a project opened in the preview.

Return stable identifiers when available. Do not expose access tokens,
internal database details, or private storage keys.
