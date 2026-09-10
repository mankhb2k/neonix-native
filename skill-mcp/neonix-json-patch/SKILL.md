---
name: neonix-json-patch
description: Apply small, guarded Protocol V2 JSON patches only when a requested Neonix change cannot be expressed through HTML and CSS.
---

# Neonix Protocol V2 JSON Patch

## Purpose

Use this skill only for small, precise changes that the Neonix HTML compiler
cannot express. Protocol V2 JSON is the runtime source of truth, but HTML is
the preferred authoring path.

The normal flow is:

```text
get_project_json
    -> inspect current Protocol V2 revision
    -> apply_json_patch with revision guard
    -> get_project_json to verify
```

## When to use

Use this skill when the user explicitly requests a JSON-level correction or
when the requested change is not representable by the supported HTML/CSS
authoring format. Examples may include a precise runtime field, an atomic
timing adjustment, or a Protocol V2 property that has no HTML lowering.

If the change can be expressed in HTML or CSS, do not use this skill. Use
`get_project_html`, edit the HTML, call `validate_html`, and save with
`update_project_html` instead.

## Required workflow

1. Identify the target project with `project_id` or `public_ref`.
2. Call `get_project_json`.
3. Read the current Protocol V2 revision number.
4. Construct the smallest patch possible.
5. Call `apply_json_patch` with
   `expected_protocol_revision_no` set to the revision just read.
6. If the patch succeeds, call `get_project_json` again and verify the changed
   paths.
7. Report that the JSON source of truth changed and whether the HTML source may
   now be stale.

## Safety rules

- Never apply a patch without `expected_protocol_revision_no`.
- Never replace the entire project document when a small patch is sufficient.
- Never remove unrelated layers, assets, timing, or composition fields.
- Preserve Protocol V2 schema invariants and existing identifiers.
- Do not invent unsupported layer types, properties, or values.
- Do not convert the patched JSON back into HTML.

If the revision guard fails, do not force the patch. Re-read the latest JSON,
re-evaluate the requested change, and ask the user if the new revision changes
the intended target.

## HTML source consistency

`apply_json_patch` creates a JSON revision and can make the attached HTML source
stale. Tell the user this explicitly. If the same change should be reproducible
from HTML, stop and use the HTML authoring workflow instead.

## Response rules

Summarize:

- the project reference;
- the previous and new Protocol V2 revision numbers;
- the patch paths that changed;
- any warning that HTML authoring is now stale.

Do not claim that a JSON-only patch is represented in the HTML source.
