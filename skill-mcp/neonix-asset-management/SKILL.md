---
name: neonix-asset-management
description: Discover, upload, import, attach, and safely manage media assets in a user's Neonix workspace and projects.
---

# Neonix Asset Management

## Purpose

Use this skill to discover, upload, import, attach, and safely manage media
assets used by Neonix projects.

Neonix manages project media in the user's Neonix asset library. Assets are
workspace resources first; they become usable by a project only after they are
attached to that project.

Supported asset workflows include:

- uploading a file supplied by the user;
- importing an asset from a public HTTP(S) URL;
- listing assets in a workspace or project;
- attaching a ready asset to a project;
- deleting an asset when the user explicitly requests it.

## Available tools

- `list_assets`
- `request_asset_upload`
- `complete_asset_upload`
- `import_asset`
- `attach_asset_to_project`
- `delete_asset`

## Selecting the workspace and project

Use the workspace and project identifiers supplied by the user. If they are
missing, use the project workflow to discover the user's accessible workspaces
and projects before creating or attaching anything.

Do not attach an asset to an arbitrary project when the target is ambiguous.
Ask the user to choose the project.

## Uploading a user-provided file

Follow this sequence:

```text
request_asset_upload
    -> upload the bytes to the temporary upload URL returned by Neonix
    -> complete_asset_upload
    -> attach_asset_to_project
```

1. Call `request_asset_upload` with the workspace, filename, MIME type, and
   exact byte size.
2. Use the temporary upload URL returned by Neonix to upload the file bytes when the client
   provides a file-upload or HTTP-upload capability.
3. Call `complete_asset_upload` with the returned `asset_id` only after the
   upload request succeeds.
4. Call `attach_asset_to_project` with the ready `asset_id` and target project.
5. Call `list_assets` when confirmation of the final attachment is needed.

If the client cannot transfer binary bytes to the temporary upload URL, do not
call `complete_asset_upload` prematurely. Ask the user for a supported file
upload or a public URL and use the import workflow instead.

## Importing from a public URL

Use `import_asset` when the user supplies a public HTTP(S) URL:

1. Confirm that the URL is the intended source.
2. Call `import_asset` with the workspace, source URL, and optional filename.
3. Wait for the tool result and record the new `asset_id`.
4. Call `attach_asset_to_project` if the user wants the asset in a project.

The server performs SSRF, MIME-type, size, and quota checks. Do not try to
bypass those checks, use private-network URLs, data URLs, local file paths, or
URLs supplied by an unrelated page.

## Listing and selecting assets

Call `list_assets` to inspect assets that are ready, uploading, or attached to
a project. Prefer an existing ready asset when it clearly matches the user's
request instead of uploading a duplicate.

Verify the asset's filename, MIME type, status, and project association before
using it in HTML or starting a video export.

## Attaching assets to projects

Only attach an asset after it is ready. Use `attach_asset_to_project` with the
explicit project identifier and `asset_id`.

Attaching an asset does not automatically rewrite the project's HTML. If the
user wants to display or animate the asset, update the HTML through the HTML
authoring workflow, validate it, and save a new linked Protocol V2 revision.

## Deleting assets

`delete_asset` is destructive because it may remove the asset and its associated
data. Use it only when the user explicitly asks to delete a named asset.

Before deletion:

1. Confirm the workspace and asset identity.
2. Check whether it is referenced by projects.
3. Explain that replacing references may change existing projects.
4. Pass `replace_references: true` only when the user explicitly approves the
   fallback behavior.

Do not delete an asset merely because it is currently unused or because a new
version is being uploaded.

## Security and response rules

- Never reveal temporary upload URLs, access tokens, or private credentials in
  logs or long-term project text.
- Do not claim an upload is complete until `complete_asset_upload` succeeds.
- Do not claim an asset is available in a project until attachment succeeds.
- Report MIME, size, quota, SSRF, upload, or asset errors clearly.
- Keep asset operations separate from HTML compilation and video export.
- Before export, ensure the asset is ready and attached to the saved project
  revision that will be rendered.
