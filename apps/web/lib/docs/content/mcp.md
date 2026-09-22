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

Neonix's hosted MCP connection works the same way for every client: add the endpoint, complete OAuth, done. No API key or client ID to copy in — supported clients complete OAuth automatically when you add the connector, and any other MCP client registers itself the same way over standard OAuth dynamic client registration.

**Chat apps** — connect through the app's own settings UI:

| Client | Description |
| --- | --- |
| Claude | Create and refine motion projects from a conversation. |
| ChatGPT | Turn structured intent into editable motion and exports. |
| Grok | Give Grok a secure connection to your Neonix workspace. |

**Developer tools** — connect with a CLI command or a config file:

| Client | Description |
| --- | --- |
| Claude Code | Add Neonix as a remote MCP server from the terminal. |
| Codex | Add Neonix to Codex's `config.toml` and call it from a session. |
| Cursor | Add Neonix to `mcp.json` and call it from the editor's agent. |
| Antigravity | Add Neonix to Antigravity's shared MCP config for its CLI and IDE. |

Continue with [Claude](/docs/mcp/claude), [ChatGPT](/docs/mcp/chatgpt), [Grok](/docs/mcp/grok), [Claude Code](/docs/mcp/claude-code), [Codex](/docs/mcp/codex), [Cursor](/docs/mcp/cursor), or [Antigravity](/docs/mcp/antigravity).

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
- [Claude Code setup](/docs/mcp/claude-code)
- [Codex setup](/docs/mcp/codex)
- [Cursor setup](/docs/mcp/cursor)
- [Antigravity setup](/docs/mcp/antigravity)

---
slug: mcp/chatgpt
title: MCP for ChatGPT
description: Connect ChatGPT to Neonix for editable motion video projects.
---
# Neonix MCP for ChatGPT

Connect ChatGPT to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from your ChatGPT workflow. ChatGPT offers two ways in: install Neonix from the plugin directory, or add it yourself as a custom connector in Developer mode.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| Auth | OAuth 2.1 — no API key or client ID needed |
| Availability | ChatGPT Plus, Pro, Team, Enterprise, or Edu |

## Option A — Install from the plugin directory

Once Neonix is listed, this is the fastest path for most users.

1. **Open Apps & Connectors** — In ChatGPT, go to **Settings > Apps & Connectors**.
2. **Find Neonix** — Search "Neonix" in the plugin directory and select it.
3. **Connect** — Click **Connect**, complete OAuth sign-in, and approve workspace access.
4. **Create motion** — Ask ChatGPT to create or update an editable project; Neonix's tools appear automatically.

## Option B — Add a custom connector in Developer mode

Use this today, or to test against a specific workspace before Neonix is generally listed.

1. **Turn on Developer mode** — Go to **Settings > Apps & Connectors > Advanced Settings** and toggle **Developer mode** on.
2. **Create a custom connector** — Back in **Apps & Connectors**, click **Create**, then enter a name (for example "Neonix") and the MCP endpoint above as the server URL.
3. **Authenticate** — Choose OAuth. ChatGPT detects Neonix's OAuth dynamic client registration automatically, so there's no client ID or secret to fill in. Save, then complete sign-in and approve workspace access.
4. **Enable and use** — Toggle the Neonix tools on for a chat, and hit **Refresh** if Neonix's tool list ever changes. Then ask ChatGPT to create or update an editable project.

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
| Auth | OAuth 2.1 — no API key or client ID needed |

## Setup flow

1. **Open Connectors** — In Claude.ai, go to **Customize > Connectors** (Pro and Max plans). On a Team or Enterprise workspace, an Owner adds it once under **Organization settings > Connectors**, and members connect individually after.
2. **Add a custom connector** — Click **+**, choose **Add custom connector**, and paste the MCP endpoint above as the server URL.
3. **Skip the OAuth fields** — Leave "Advanced settings" (OAuth Client ID / Secret) empty. Neonix registers a client automatically over OAuth dynamic client registration, so Claude detects and pre-fills authentication on its own. Click **Add**.
4. **Authorize and enable** — Sign in to Neonix when prompted, then approve workspace access. In any chat, click **+ > Connectors** and toggle Neonix on to use it in that conversation.
5. **Create motion** — Ask Claude to create or update an editable project.

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
| Auth | OAuth 2.1 — no API key or client ID needed |
| Availability | Grok paid tiers |

## Setup flow

1. **Open Connectors** — Go to [grok.com/connectors](https://grok.com/connectors) and click **New Connector**.
2. **Choose Custom** — Select **Custom**, name it "Neonix", and paste the MCP endpoint above. Neonix is already a public HTTPS server, so no tunnel is needed.
3. **Authorize** — Complete OAuth sign-in and approve workspace access; Grok discovers Neonix's tools automatically.
4. **Create motion** — Ask Grok to create or update an editable project.

Back to [MCP connections](/docs/mcp).

---
slug: mcp/claude-code
title: MCP for Claude Code
description: Connect Claude Code to Neonix for editable motion video projects.
---
# Neonix MCP for Claude Code

Connect Claude Code to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from a terminal session.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| Auth | OAuth 2.1 — no API key or client ID needed |
| Config scope | Local by default; add `--scope user` to share across every project |

## Setup flow

1. **Add the server** — Run:

   ```bash
   claude mcp add --transport http neonix https://www.neonix.video/api/mcp
   ```

2. **Authorize** — Inside a Claude Code session, run `/mcp`, select **neonix**, and follow the browser prompt to sign in and approve workspace access. Claude Code handles OAuth dynamic client registration and token refresh automatically, so there's no client ID or secret to configure.
3. **Verify** — Run `claude mcp get neonix` or `/mcp` to confirm the connection and see the available tools.
4. **Create motion** — Ask Claude Code to create or update an editable project.

Run `claude mcp logout neonix` to revoke access later.

Back to [MCP connections](/docs/mcp).

---
slug: mcp/codex
title: MCP for Codex
description: Connect Codex to Neonix for editable motion video projects.
---
# Neonix MCP for Codex

Connect Codex to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from a Codex session.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| Auth | OAuth 2.1 — no API key or client ID needed |
| Config file | `~/.codex/config.toml` (or `.codex/config.toml` for a trusted project) |

## Setup flow

1. **Add the server** — Run:

   ```bash
   codex mcp add neonix --url https://www.neonix.video/api/mcp
   ```

   Codex writes a matching `[mcp_servers.neonix]` table to `config.toml`. Skip `--bearer-token-env-var` — Neonix authenticates over OAuth, not a static token.
2. **Authorize** — Start a Codex session; Codex opens the browser for OAuth sign-in the first time it calls a Neonix tool. Approve workspace access.
3. **Verify** — Inside a session, run `/mcp` to confirm Neonix is connected and see its tools.
4. **Create motion** — Ask Codex to create or update an editable project.

Back to [MCP connections](/docs/mcp).

---
slug: mcp/cursor
title: MCP for Cursor
description: Connect Cursor to Neonix for editable motion video projects.
---
# Neonix MCP for Cursor

Connect Cursor to Neonix for editable motion video projects. Use the hosted MCP server to create, update, preview, and export editable motion projects from Cursor's agent.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| Auth | OAuth 2.1 — no API key or client ID needed |
| Config file | `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project) |
| Requires | Cursor v0.48.0 or later |

## Setup flow

1. **Open mcp.json** — Create or edit `~/.cursor/mcp.json` to make Neonix available in every project, or `.cursor/mcp.json` in one project's root.
2. **Add the server** — Add a `neonix` entry with the MCP endpoint as its `url`; Cursor treats a plain `url` field as Streamable HTTP:

   ```json
   {
     "mcpServers": {
       "neonix": {
         "url": "https://www.neonix.video/api/mcp"
       }
     }
   }
   ```

3. **Authorize** — Open Cursor's **Settings > MCP**, find Neonix, and connect. Cursor opens the browser for OAuth sign-in — no client ID or secret to fill in. Approve workspace access.
4. **Create motion** — Ask Cursor's agent to create or update an editable project.

Back to [MCP connections](/docs/mcp).

---
slug: mcp/antigravity
title: MCP for Antigravity
description: Connect Google Antigravity to Neonix for editable motion video projects.
---
# Neonix MCP for Antigravity

Connect Google Antigravity to Neonix for editable motion video projects. Antigravity's CLI and IDE share one MCP configuration, so this setup works in both.

## Connection details

| Field | Value |
| --- | --- |
| MCP endpoint | `https://www.neonix.video/api/mcp` |
| Auth | OAuth 2.1 — no API key or client ID needed |
| Config file | `~/.gemini/config/mcp_config.json` |

## Setup flow

1. **Open the MCP config** — In Antigravity, go to **Settings > Customizations** and click **Open MCP Config**, or open **Manage MCP Servers > View raw config**. Either one edits `~/.gemini/config/mcp_config.json` directly.
2. **Add the server** — Antigravity uses `serverUrl` for a remote server, not `url`:

   ```json
   {
     "mcpServers": {
       "neonix": {
         "serverUrl": "https://www.neonix.video/api/mcp"
       }
     }
   }
   ```

3. **Refresh and authorize** — Save the file, then refresh the Installed MCP Servers list. Antigravity opens the browser for OAuth sign-in the first time it calls a Neonix tool — no client ID or secret needed. Approve workspace access.
4. **Create motion** — Ask Antigravity to create or update an editable project.

Back to [MCP connections](/docs/mcp).
