import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const NEONIX_WORKFLOW_GUIDE = `# Neonix MCP workflows

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
  complete html string (start from get_capabilities' document.template
  boilerplate; do not rewrite the scaffold from scratch). Adjust the
  neonix-document meta's composition only if the user asked for a specific
  size, fps, background or duration.

After either path: use the returned project id to call open_preview. Call
open_editor only when the user wants to edit manually. Call create_export
only when the user explicitly asks for an export.

## Edit an existing project

1. Call get_project_html.
2. Edit the returned HTML source while preserving the neonix-document metadata.
3. Call validate_html before saving.
4. Call update_project_html with the latest revision numbers when available.
5. On a revision conflict, read the latest HTML again and re-apply the user's change.

## JSON fallback

Use get_project_json for inspection only. Use apply_json_patch only for a small
change that HTML cannot express; this creates a JSON revision and can make the
HTML source stale.

## Safety and assets

Ask for confirmation before destructive operations such as delete_project or
cancel_export. Use import_asset only for a user-provided public URL. Assets
referenced by HTML must already be available in the user's workspace.
`;

export const NEONIX_HTML_GUIDE = `# Neonix HTML authoring contract

The input must be a complete Neonix HTML document. Keep the
meta[name="neonix-document"] manifest and put CSS in style blocks in the same
document. Start from get_capabilities' document.template (a filled-in
boilerplate) instead of writing the doctype/meta/style scaffold by hand each
time; only the CSS rules, body markup and composition values change per
project. Use get_capabilities to discover supported tags, CSS properties and
bundled fonts. For deterministic text layout, use the bundled Inter family
(weights 400 and 700); generic system fonts such as Arial are not implicit.

## Colors

get_capabilities.values.color lists every supported syntax with examples, and
every color function that is recognized but NOT implemented (oklch(), lab(),
...) so you can avoid it instead of hitting css-color-unsupported by trial
and error. In short: hex (#rgb/#rgba/#rrggbb/#rrggbbaa), rgb()/rgba() and
hsl()/hsla() (legacy comma syntax and modern space+slash-alpha syntax both
work, and rgb()/rgba() are interchangeable, as are hsl()/hsla()), named CSS
colors, transparent and currentColor. linear-gradient()/radial-gradient()/
conic-gradient() (and their repeating- variants) are fully supported on
background/background-image and never need an explicit background-size -
that requirement only applies to a repeating url() image, whose pixel size
isn't known at compile time.

## Element ids

Give an element an explicit id (matching /^[A-Za-z][A-Za-z0-9_-]{0,199}$/,
unique in the document) whenever you or a later edit will reference its
Protocol V2 layer - to animate it, restyle it, or read it back from
get_project_json. An element styled only with class does not need an
invented id: it still gets a stable, readable layer id (its own last class
token, e.g. class="card card-a" -> "card-a"; its tag name if it has no
class), deduplicated with a -2, -3, ... suffix where needed. Use class
normally for shared styling; get_capabilities.constraints has the exact
scheme if you need to predict a specific auto-generated id ahead of time.

The compiler produces Protocol V2 JSON. Protocol V2 is the canonical revision
used by the runtime and export pipeline; HTML is the linked authoring source.
Never attempt to generate HTML by reversing project JSON.
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
