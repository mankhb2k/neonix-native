---
slug: turning-html-and-css-into-a-video
title: How to Turn HTML and CSS Into a Video
description: Neonix compiles HTML and CSS into a real, exportable motion video — no React, no rendering code, and no video editor to learn.
summary: Compile HTML and CSS into a real, exportable video — no React or rendering code required.
---
# How to Turn HTML and CSS Into a Video

Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video. Write markup and styles the way you already know them — plain HTML, CSS, Tailwind, or your own components — and Neonix compiles that into an editable project you can preview and export as an MP4.

## The pipeline

```text
HTML / CSS
  → Neonix JSON V2 (editable, named layers)
  → Editor (preview and refine)
  → Export video (MP4)
```

Unlike code-first video frameworks, which need a developer writing React to render video, Neonix is agent-first: an AI agent creates the HTML/CSS project for you, and a person can refine it afterward. There's no rendering code to write and no video editor timeline to learn first.

## Step 1 — Write a complete HTML/CSS document

Every Neonix project starts from a normal HTML document with one required tag: a `<meta name="neonix-document">` declaring the composition (width, height, fps, background). Everything inside `<body>` — text, shapes, images, layout — becomes an editable, named layer.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="neonix-document"
      content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'
    />
  </head>
  <body>
    <main class="scene">
      <h1>Neonix</h1>
      <p>HTML to editable motion.</p>
    </main>
  </body>
</html>
```

Full authoring reference, including the supported HTML/CSS subset: [HTML authoring](/docs/html).

## Step 2 — Connect an AI agent

Today, an AI agent is how HTML gets compiled into a project — there's no separate upload button. Any MCP-capable client works the same way: add the hosted endpoint, sign in, and ask the agent to build or update the project from your HTML/CSS. Supported clients include Claude, ChatGPT, Grok, Claude Code, Codex, Cursor, and Antigravity.

See [MCP connections](/docs/mcp) for the full client list, or jump straight to [Creating a Motion Video with Claude](/guides/creating-a-motion-video-with-claude) for a worked example.

## Step 3 — Preview, refine, export

Once compiled, the project is a real editable document — named layers and properties, not a flattened video. Open it in the Neonix editor to preview and adjust anything by hand, or keep iterating with the agent. When it looks right, export a deterministic MP4.

## FAQ

**Do I need to know React or a rendering library?**
No. Neonix compiles HTML/CSS directly — there's no React component tree or rendering API to learn.

**Can I use Tailwind or my own components?**
Yes. Utility classes, layout, typography and reusable components all carry over into the compiled project.

**How is this different from code-first tools like Remotion?**
Code-first frameworks need a developer writing React to render video. Neonix is agent-first: an AI agent creates the HTML/CSS motion project directly over MCP, and you refine it in the editor afterward.

**What do I get when I export?**
A real MP4 file, rendered from your saved project.

## Next steps

- [HTML authoring reference](/docs/html)
- [MCP connections](/docs/mcp)
- [Creating a Motion Video with Claude](/guides/creating-a-motion-video-with-claude)
