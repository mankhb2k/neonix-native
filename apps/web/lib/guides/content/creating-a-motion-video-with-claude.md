---
slug: creating-a-motion-video-with-claude
title: How to Create a Motion Video with Claude
description: Connect Claude to Neonix and turn a single prompt into a real, exportable motion video — no video editor or rendering setup required.
summary: Connect Claude to Neonix and turn a prompt into a real, exportable video — no editor required.
---
# How to Create a Motion Video with Claude

Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video. Connect it to Claude over Remote MCP, describe what you want in a prompt, and Claude creates an editable project you can preview, refine, and export as an MP4 — without opening a video editor or setting up any rendering infrastructure yourself.

## What you need

- A Claude account with custom connectors available (Claude Pro or Max, or a Team/Enterprise workspace).
- A free Neonix account to sign in with when the connector opens OAuth.

## Step 1 — Connect Claude to Neonix

In Claude, go to **Customize > Connectors**, click **+**, choose **Add custom connector**, and paste in the hosted endpoint:

```text
https://www.neonix.video/api/mcp
```

Leave the OAuth Client ID/Secret fields empty — Neonix registers automatically, so Claude detects authentication on its own. Sign in and approve workspace access when prompted.

Full walkthrough with screenshots of each step: [MCP for Claude](/docs/mcp/claude).

## Step 2 — Describe your video in one prompt

Once the connector is enabled for your conversation, describe the video you want. Claude turns your description into a complete HTML/CSS scene and compiles it into an editable project. A prompt as simple as this is enough to start:

```text
Create a 10-second motion video announcing a product launch: dark
background, the headline "Introducing Nova" fading and sliding in,
followed by a short subheading, then a call-to-action button.
```

Claude calls Neonix's `create_project_html` tool with the HTML/CSS behind the scenes — you never write or see that HTML unless you want to.

## Step 3 — Preview, refine, and export

Ask Claude to open the project in the Neonix editor to preview it, or keep iterating in the conversation ("make the headline larger," "slow down the intro," "add a logo in the corner"). Each change updates the same project instead of starting over.

When it looks right, ask Claude to export it. Neonix renders a deterministic MP4 from the saved project and gives you a download link.

## FAQ

**Do I need a video editor or After Effects?**
No. Neonix compiles HTML/CSS into a video directly — Claude and Neonix handle both the authoring and the rendering.

**Can I still edit the video after Claude creates it?**
Yes. The project stays a real, editable document — in the conversation with Claude, or by opening it directly in the Neonix editor.

**What do I get when I export?**
A real MP4 file, rendered from your saved project and ready to download or publish.

**Does this work with other AI clients besides Claude?**
Yes — the same hosted MCP server works the same way with ChatGPT, Grok, Claude Code, Codex, Cursor, and Antigravity. See [MCP connections](/docs/mcp) for every supported client.

## Next steps

- [MCP for Claude](/docs/mcp/claude) — full connector setup with screenshots.
- [MCP overview](/docs/mcp) — every supported client and the full tool reference.
