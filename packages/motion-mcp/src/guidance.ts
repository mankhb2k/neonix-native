import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const NEONIX_WORKFLOW_GUIDE = `# Neonix MCP workflows

Neonix projects are raw HTML/CSS documents (Kiến trúc A): the HTML is stored
as-is and rendered frame by frame. There is no compile step and no separate
JSON document to keep in sync.

## Create a new project from HTML

create_project_html is the only public AI path for creating a new project.
Its html field is optional - two ways to use it:

- **Two-step (default, no html needed up front)**: call create_project_html
  with no html (or an empty string). It scaffolds and actually saves the
  project from the standard blank template (doctype, charset, neonix-document
  meta, empty data-neonix-bundle style block). Then call update_project_html
  to author the real content and set composition.width/height/fps/background
  /durationMs to whatever the user actually wants (e.g. a specific aspect
  ratio like 16:9, 1:1, 9:16).
- **One-step**: if you already know the exact document to save, pass a
  complete html string. Start from the template shown in the
  create_project_html tool description; do not rewrite the scaffold from
  scratch. Adjust the neonix-document meta composition only if the user asked
  for a specific size, fps, background or duration.

After either path: use the returned project id to call open_preview. Call
create_export only when the user explicitly asks for an export.

## Edit an existing project

1. Call get_project_html.
2. Edit the returned HTML source while preserving the neonix-document metadata.
3. Call update_project_html with the latest revision number when available.
4. On a revision conflict, read the latest HTML again and re-apply the change.

## Safety and assets

Ask for confirmation before destructive operations such as delete_project or
cancel_export. Use import_asset only for a user-provided public URL. Assets
referenced by HTML must already be available in the workspace.
`;

export const NEONIX_HTML_GUIDE = `# Neonix HTML authoring contract

The input must be a complete Neonix HTML document. Keep the
meta[name="neonix-document"] manifest (exactly one, with a valid composition)
and put CSS in style blocks in the same document. Start from the template in
the create_project_html tool description instead of writing the
doctype/meta/style scaffold by hand each time; only the CSS rules, body markup
and composition values change per project.

Rules checked when saving:

- exactly one meta[name="neonix-document"] with a valid composition;
- no <script> tags;
- <body> (or its single top-level wrapping element) declares width and height
  in px, matching the composition exactly.

composition.fps and composition.durationMs are required to export the project
(durationMs is not required to create or edit it).
`;

export function registerNeonixGuidance(server: McpServer) {
  server.registerResource(
    "neonix-workflows",
    "neonix://docs/workflows",
    {
      title: "Neonix MCP workflows",
      description: "Recommended workflows for creating, editing and exporting Neonix projects.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: NEONIX_WORKFLOW_GUIDE }] }),
  );

  server.registerResource(
    "neonix-html-authoring",
    "neonix://docs/html-authoring",
    {
      title: "Neonix HTML authoring contract",
      description: "HTML, CSS and Protocol V2 rules for Neonix documents.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: NEONIX_HTML_GUIDE }] }),
  );

  server.registerPrompt(
    "create_html_project",
    {
      title: "Create Neonix project from HTML",
      description: "Guide an agent through the HTML-first Neonix project workflow.",
    },
    async () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `${NEONIX_WORKFLOW_GUIDE}\n\nCreate the project only after the user has supplied or approved the HTML source.` },
      }],
    }),
  );

  server.registerPrompt(
    "edit_html_project",
    {
      title: "Edit Neonix project HTML",
      description: "Guide an agent through safe HTML revision and conflict handling.",
    },
    async () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `${NEONIX_WORKFLOW_GUIDE}\n\nEdit the existing authoring source and preserve revision checks.` },
      }],
    }),
  );
}
