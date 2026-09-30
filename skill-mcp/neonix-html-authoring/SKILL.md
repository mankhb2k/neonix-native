---
name: neonix-html-authoring
description: Create and edit Neonix motion-video projects as raw HTML and CSS through the Neonix MCP server.
---

# Neonix HTML Authoring

## Purpose

Use this skill when creating or editing a Neonix motion-video project through
HTML and CSS. Neonix stores the HTML as-is and renders it frame by frame; it is
the only source of truth for the project.

The normal flow is:

```text
HTML and CSS
    -> create_project_html / update_project_html
    -> open_preview
```

## When to use

Use this skill when the user asks to:

- create a motion composition with HTML and CSS;
- edit the visual layout, text, shapes, colors, or timing of an existing project.

## Document contract

The HTML document must contain a `meta` element with
`name="neonix-document"` that describes the fixed composition:

```html
<meta
  name="neonix-document"
  content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'
>
```

Rules checked when saving:

- exactly one `neonix-document` meta tag with a valid composition;
- no `<script>` tags;
- `<body>` (or its single top-level wrapping element) declares `width` and
  `height` in px matching the composition exactly.

`composition.fps` and `composition.durationMs` are required to export the
project; `durationMs` is not needed to create or edit it.

Use the composition requested by the user. Common compositions are 16:9, 9:16,
and 1:1. Do not silently change width, height, fps, background, or color space.

Keep the source as one complete HTML document. CSS may be included in one or
more `style` elements inside the document. Do not depend on browser
JavaScript, event handlers, forms, navigation, or web-only behavior.

## Required workflow

### Existing project

1. Call `get_project_html` with the project identifier.
2. Preserve the existing document metadata.
3. Make the smallest HTML/CSS change that satisfies the user's request.
4. Call `update_project_html` with the complete updated document.
5. Report that the project HTML was saved.

### New project

1. Create a complete Neonix HTML document using the requested composition, or
   omit `html` to start from the standard blank template.
2. Call `create_project_html` with the requested project title, workspace,
   and the HTML — this creates the project and saves the HTML in one step.
3. Call `update_project_html` to author real content when you started from the
   blank template.

## Text and layout rules

- Use explicit composition-relative dimensions and positions.
- Use `br` only for intentional hard line breaks; do not use it to repair an
  incorrectly sized layout.
- Keep the layout deterministic: avoid behavior that depends on the viewport,
  user input, or network content.

## Response rules

Tell the user whether the document was only drafted or saved to a project.
Report any error returned by the tool instead of hiding it.
