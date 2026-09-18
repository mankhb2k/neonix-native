# MCP 27-tool E2E checklist

Internal verification checklist for the authenticated Neonix MCP endpoint. The test uses a disposable HTML project, a tiny uploaded SVG, one imported public image, one completed export, and one cancellation probe. Cleanup runs through MCP and deletes the created project and assets.

## Run

From `apps/web`:

```powershell
$env:MCP_E2E_ENDPOINT="http://localhost:3000/api/mcp"
pnpm e2e:mcp:27-tools
```

For the deployed endpoint:

```powershell
$env:MCP_E2E_ENDPOINT="https://www.neonix.video/api/mcp"
pnpm e2e:mcp:27-tools
```

Required environment values are loaded from `apps/web/.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DEV_DEMO_EMAIL`, and `DEV_DEMO_PASSWORD`. The test never prints access tokens or storage credentials.

## Acceptance criteria

- The endpoint exposes exactly the expected 27 tools and no legacy `create_project` tool.
- Every public tool has a human-readable `annotations.title`.
- All 27 tools are invoked with valid authenticated input.
- The HTML project is readable, editable, patchable, previewable, and removable.
- Upload → complete → attach → delete works for a disposable asset.
- Public URL import → delete works for a disposable asset.
- Export reaches `done`; its short-lived URL returns MP4 bytes without downloading the full file.
- Cancellation returns a valid terminal or in-flight job state; a race with a very fast export is recorded, not misclassified as a protocol failure.
- Cleanup removes the disposable project and all disposable assets through MCP.

## Tool matrix

| # | Tool | Verification |
|---:|---|---|
| 1 | `list_workspaces` | Resolves a writable demo workspace. |
| 2 | `get_project_json` | Reads the created Neonix JSON V2 revision. |
| 3 | `apply_json_patch` | Applies a no-visual-change `setComposition` patch with revision guard. |
| 4 | `get_project_html` | Reads HTML source and revision metadata. |
| 5 | `update_project_html` | Writes a changed HTML revision with optimistic revision guards. |
| 6 | `list_html_revisions` | Lists HTML history. |
| 7 | `get_html_revision` | Reads the current HTML revision. |
| 8 | `list_assets` | Lists workspace assets. |
| 9 | `request_asset_upload` | Creates a signed upload session for a tiny SVG. |
| 10 | `complete_asset_upload` | Verifies the uploaded object and marks it ready. |
| 11 | `import_asset` | Imports a public image URL into the user asset area. |
| 12 | `attach_asset_to_project` | Links the uploaded asset to the disposable project. |
| 13 | `delete_asset` | Deletes uploaded and imported test assets, replacing references. |
| 14 | `create_export` | Enqueues a disposable MP4 export. |
| 15 | `get_export` | Polls the export state to terminal success. |
| 16 | `get_export_download_url` | Obtains and range-checks the signed MP4 URL. |
| 17 | `cancel_export` | Creates a second disposable job and immediately requests cancellation. |
| 18 | `create_project_html` | Creates the disposable project from complete HTML. |
| 19 | `list_projects` | Confirms the project is visible in its workspace. |
| 20 | `get_project` | Reads project identity and current revision. |
| 21 | `update_project` | Updates title with an optimistic revision guard. |
| 22 | `delete_project` | Removes the disposable project during cleanup. |
| 23 | `open_editor` | Returns the authenticated editor URL. |
| 24 | `open_preview` | Returns the public preview URL. |
| 25 | `get_capabilities` | Returns capability metadata. |
| 26 | `validate_html` | Validates the fixture document. |
| 27 | `compile_html` | Compiles the fixture document into the public contract. |

## Evidence and feedback loop

Each run writes a JSON report to `docs/benchmark/results/mcp-27-tools-e2e-<timestamp>.json`. For every tool the report records `passed`, `failed`, or `blocked`, elapsed milliseconds, and a redacted error message. A failed case is fixed in the smallest owning layer, then the MCP package tests, app typecheck, and the full E2E are rerun. Production is only considered green when the report has 27 passed cases and cleanup verification succeeds.
