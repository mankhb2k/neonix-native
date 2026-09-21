---
slug: mcp
title: MCP — Motion infrastructure for AI agents
description: Connect Claude, Grok, and ChatGPT to Neonix through one secure MCP server for editable motion videos.
---
# Neonix MCP — Motion infrastructure for AI agents

A standard bridge between an AI client and Neonix.

## What is MCP?

Model Context Protocol lets a compatible AI client discover structured tools and call them with validated inputs. Instead of asking an agent to print a large JSON file in chat, Neonix lets it work with a real project through a controlled remote connection.

Neonix remains responsible for authentication, workspace ownership, revisions, Neonix JSON V2 validation, preview, and export. The agent supplies intent; Neonix keeps the project safe and editable.

`Streamable HTTP / OAuth / Neonix JSON V2 / Preview and export`

## Get started

No local renderer or package is required. Connect to the URL, sign in with your Neonix account when OAuth opens, and approve access to the workspace you want the client to use.

Hosted MCP endpoint:

```text
https://www.neonix.video/api/mcp
```

1. **Use a remote MCP client** — Choose a host that supports Streamable HTTP MCP connections.
2. **Authorize Neonix** — OAuth connects the client to your account and workspace permissions.
3. **Start with an HTML project** — Ask the agent to create a complete HTML/CSS project.

## Supported clients

These OAuth registrations are ready for Neonix's hosted MCP connection. The endpoint remains the same for every client.

| Client | Description | Client ID |
| --- | --- | --- |
| Claude | Create and refine motion projects from a conversation. | `5c365b60-7190-4e77-90c7-52af523b1d27` |
| Grok | Give Grok a secure connection to your Neonix workspace. | `ec4a6d6d-8b36-4c8b-897f-9a3b7982ae10` |
| ChatGPT | Turn structured intent into editable motion and exports. | `51923cdd-fcac-4cac-adf7-fbfa414361a0` |

Continue with [Claude setup](/docs/mcp/claude), [ChatGPT setup](/docs/mcp/chatgpt) or [Grok setup](/docs/mcp/grok).

## Tools

The remote server exposes focused tools instead of one opaque generate call. Each operation is authenticated, validated, and scoped to the user's workspace.

| Group | Description | Tools |
| --- | --- | --- |
| Workspace & projects | Find workspaces and projects, manage HTML revisions, and open the Neonix editor. | `list_workspaces`, `list_projects`, `get_project`, `delete_project`, `open_editor` |
| HTML authoring | Use complete HTML/CSS as the high-level authoring source for a project. | `get_capabilities`, `validate_html`, `compile_html`, `create_project_html`, `get_project_html`, `update_project_html`, `list_html_revisions`, `get_html_revision` |
| Neonix JSON | Inspect canonical Neonix JSON V2 and apply a small validated JSON patch when needed. | `get_project_json`, `apply_json_patch` |
| Assets | List, upload, import, attach, and safely remove workspace media assets. | `list_assets`, `request_asset_upload`, `complete_asset_upload`, `import_asset`, `attach_asset_to_project`, `delete_asset` |
| Export jobs | Create an export from a saved revision, follow its status, and retrieve the result. | `create_export`, `get_export`, `get_export_download_url`, `cancel_export` |

## Recommended workflow

Start high-level, keep the source and revision history clear.

- **Create** — For an HTML-first request, call `get_capabilities`, prepare a complete `neonix-document`, then use `create_project_html`.
- **Edit** — Read with `get_project_html`, preserve the document metadata, validate with `validate_html`, then save with `update_project_html`.
- **Ship** — Open the editor with `open_editor`, create an export from a saved revision, and retrieve the signed download URL when ready.

```text
get_capabilities -> create_project_html -> open_editor
get_project_html -> validate_html -> update_project_html
create_export -> get_export -> get_export_download_url
```

## Resources and prompts

- `neonix://docs/workflows` — recommended create, edit, asset, and export flows.
- `neonix://docs/html-authoring` — supported HTML/CSS boundary and Neonix JSON V2 rules.

Compatible hosts can attach the `create_html_project` and `edit_html_project` prompts and the resources above to give the agent the Neonix workflow before it calls a tool.

## Important boundaries

- HTML is the preferred high-level authoring source for HTML requests; Neonix JSON V2 remains canonical.
- Exports run from saved revisions, not unsaved arbitrary JSON supplied in a tool call.
- Destructive actions such as `delete_project`, `delete_asset`, and `cancel_export` should be confirmed first.

## Continue

- [Claude setup](/docs/mcp/claude)
- [ChatGPT setup](/docs/mcp/chatgpt)
- [Grok setup](/docs/mcp/grok)

---
slug: mcp/chatgpt
title: MCP for ChatGPT
description: Connect ChatGPT to Neonix for editable motion video projects.
---
# Neonix MCP for ChatGPT

Connect ChatGPT to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from your ChatGPT workflow.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| OAuth client ID | `51923cdd-fcac-4cac-adf7-fbfa414361a0` |

## Setup flow

1. **Open your client** — Start a new MCP connection in ChatGPT.
2. **Add Neonix** — Use the hosted endpoint and complete OAuth authorization.
3. **Create motion** — Ask your agent to create or update an editable project.

Back to [MCP connections](/docs/mcp).

---
slug: mcp/claude
title: MCP for Claude
description: Connect Claude to Neonix for editable motion video projects.
---
# Neonix MCP for Claude

Connect Claude to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from your Claude workflow.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| OAuth client ID | `5c365b60-7190-4e77-90c7-52af523b1d27` |

## Setup flow

1. **Open your client** — Start a new MCP connection in Claude.
2. **Add Neonix** — Use the hosted endpoint and complete OAuth authorization.
3. **Create motion** — Ask your agent to create or update an editable project.

Back to [MCP connections](/docs/mcp).

---
slug: mcp/grok
title: MCP for Grok
description: Connect Grok to Neonix for editable motion video projects.
---
# Neonix MCP for Grok

Connect Grok to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from your Grok workflow.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| OAuth client ID | `ec4a6d6d-8b36-4c8b-897f-9a3b7982ae10` |

## Setup flow

1. **Open your client** — Start a new MCP connection in Grok.
2. **Add Neonix** — Use the hosted endpoint and complete OAuth authorization.
3. **Create motion** — Ask your agent to create or update an editable project.

Back to [MCP connections](/docs/mcp).
