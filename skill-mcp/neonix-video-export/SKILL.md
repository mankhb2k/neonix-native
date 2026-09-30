---
name: neonix-video-export
description: Export a saved Neonix HTML project, monitor the render job, and return a completed download URL.
---

# Neonix Video Export

## Purpose

Use this skill to export a saved Neonix HTML project to a video file and return
the completed download URL.

Export is an authenticated, persisted workflow. An HTML document that has not
been saved to a project cannot be exported through this skill. The export
requires `composition.fps` and `composition.durationMs` in the project's
`neonix-document` meta tag; add `durationMs` with `update_project_html`
first if the export reports it missing.

## Available tools

- `get_project`
- `create_export`
- `get_export`
- `get_export_download_url`
- `cancel_export`

## Required workflow

1. Identify the target project using `project_id` or `public_ref`.
2. Call `get_project` to confirm that the project exists.
3. Ask for any missing export preset or output requirement before starting a
   render.
4. Call `create_export` for the project. Use an `idempotency_key` when the
   client can provide one.
5. Store the returned `job_id`.
6. Call `get_export` until the job reaches a terminal state. Use a reasonable
   polling interval and do not issue rapid duplicate requests.
7. When the job is complete, call `get_export_download_url`.
8. Return the short-lived download URL and explain that it may expire.

## State handling

Treat these states as terminal:

- `done`: request the download URL;
- `failed`: report the error and do not request a download URL;
- `cancelled`: report that the render was cancelled.

For queued or rendering jobs, continue polling. If the server reports an
unknown state, stop and show the state instead of guessing.

## Safety rules

- Do not export unsaved HTML.
- Do not export a project different from the one named by the user.
- Do not cancel an export unless the user explicitly asks to cancel it.
- Do not expose internal storage paths, credentials, signed URL secrets, or
  database identifiers that are not intended for the user.
- Do not claim that a failed render succeeded.

If the project HTML was edited after the export started, explain that the
running export renders the HTML as it was when it started.

## Response rules

Before rendering, state the project being exported. Afterward, return one of:

- a completed download URL;
- a clear render failure and its diagnostics;
- a cancellation confirmation.

Do not present `create_export` job creation as if the video were already ready.
