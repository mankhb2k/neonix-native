---
name: neonix-html-authoring
description: Create and edit Neonix motion-video compositions through supported HTML and CSS, validate them, and save linked Protocol V2 revisions.
---

# Neonix HTML Authoring

## Purpose

Use this skill when creating or editing a Neonix motion-video project through
HTML and CSS. Neonix treats HTML as the authoring format and Protocol V2 JSON
as the canonical source of truth.

The normal flow is:

```text
HTML and CSS
    -> validate_html
    -> update_project_html
    -> linked Protocol V2 JSON revision
```

Never convert Protocol V2 JSON back into HTML.

## When to use

Use this skill when the user asks to:

- create a motion composition with HTML and CSS;
- edit the visual layout, text, shapes, colors, or timing of an existing project;
- validate whether an HTML document is supported by Neonix;
- compile HTML into Protocol V2 JSON for inspection.

## Document contract

The HTML document must contain a `meta` element with
`name="neonix-document"`. The metadata must describe a Protocol V2 document
and its fixed composition:

```html
<meta
  name="neonix-document"
  content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'
>
```

Use the composition requested by the user. Common compositions are 16:9,
9:16, and 1:1. Do not silently change width, height, fps, background, or color
space.

Keep the source as one complete HTML document. CSS may be included in one or
more `style` elements inside the document. Do not depend on browser JavaScript,
event handlers, forms, navigation, or web-only behavior.

## Required workflow

### Existing project

1. Call `get_project_html` with the project identifier.
2. Preserve the existing document metadata and supported structure.
3. Make the smallest HTML/CSS change that satisfies the user's request.
4. Call `validate_html` with the complete updated document.
5. Fix every error diagnostic before saving.
6. Call `update_project_html`, passing the latest revision numbers when they
   are available.
7. Report the new HTML revision and linked Protocol V2 revision.

### New project

1. Call `create_project` with the requested project title and workspace.
2. Create a complete Neonix HTML document using the requested composition.
3. Call `validate_html` before saving the authoring source.
4. Call `update_project_html` to create the linked HTML and Protocol V2
   revisions.

### Capabilities

Call `get_capabilities` when the supported HTML tags or CSS properties are
unknown. Use only tags and CSS properties returned by that tool. Unsupported
tags, properties, values, browser interaction, and layout features must not be
silently approximated as if they were supported.

## Text and layout rules

- Prefer the supported semantic text elements and CSS text properties.
- Use explicit composition-relative dimensions and positions.
- Use `br` only for intentional hard line breaks; do not use it to repair an
  incorrectly sized layout.
- Keep nested inline formatting inside a single text element when supported.
- If browser rendering and compiler output differ, report the diagnostic and
  do not claim that the browser preview is the final video output.

## JSON rules

Use `get_project_json` to inspect the canonical Protocol V2 result. Do not edit
JSON directly for a change that can be represented in HTML/CSS. Use
`apply_json_patch` only when the requested change cannot be expressed by the
HTML compiler, and then follow the JSON patch skill.

## Response rules

Tell the user whether the document was only validated, compiled in memory, or
saved as a project revision. Include important diagnostics instead of hiding
them. Never claim that an unsupported CSS feature or HTML tag was rendered
faithfully.
