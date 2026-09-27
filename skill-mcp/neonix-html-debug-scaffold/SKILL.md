---
name: neonix-html-debug-scaffold
description: Minimal HTML skeleton for quick Neonix test/debug compiles — only the meta neonix-document manifest and a body sized to match it matter; let validate_html/compile_html be the source of truth for everything else.
---

# Neonix Quick Test/Debug HTML

## Purpose

Use this skill for throwaway HTML written to test or debug the compiler —
reproducing a diagnostic, checking whether one property behaves as expected,
comparing browser vs. compiled output for a single element. It is not for
authoring a real project someone will keep and edit; use `neonix-html-authoring`
plus `neonix-html-compiler-contract` for that instead, so the result is
correct on the first try instead of needing cleanup later.

For test/debug, don't pre-check tags or CSS properties against an allowlist.
Write the smallest HTML that isolates the thing being tested, compile it, and
read the diagnostic. That loop is faster than cross-referencing a contract
document for a one-off case.

## The only two things that must be right

1. **Exactly one `meta[name="neonix-document"]`** with valid JSON content:

   ```html
   <meta
     name="neonix-document"
     content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#000000","colorSpace":"srgb"}}'
   >
   ```

   Pick `width`/`height` to match whatever is being tested (1920×1080,
   1080×1920, 1080×1080, or any other value) — `fps`, `background`,
   `colorSpace: "srgb"` can stay at these defaults unless the test needs
   otherwise.

2. **A `<body>` containing the test content, sized to the composition.** The
   simplest reliable way is one root element filling the frame:

   ```html
   <style>
     #scene { position: absolute; inset: 0; width: 1920px; height: 1080px; }
   </style>
   <body>
     <div id="scene">
       <!-- whatever is being tested goes here -->
     </div>
   </body>
   ```

   Match `width`/`height` on `#scene` to the same numbers as the meta
   composition so the test element is actually inside frame.

Everything else — which tags, which CSS properties, which values — is
whatever the test needs. Do not filter it yourself first.

## JavaScript is strictly forbidden

Neonix compiles a static document; it is not a browser runtime. Never add
`<script>` tags, inline event handler attributes (`onclick`, `onload`, ...),
`javascript:` URLs, or any JS-driven style/DOM mutation — not even "just for
a quick test." The compiler does not execute anything; a `<script>` tag is
outside the tag allowlist and fails with `html-tag-unsupported` the same as
any other unsupported tag, and there is no code path where JS is read for its
side effects. If the thing under test is a dynamic/interactive behavior,
there is no way to express it in this document — say so instead of adding a
script and hoping it runs.

## `<style>` usage — how to do it correctly

- CSS must live inside one or more `<style>` elements in the document. There
  is no other legal place for it.
- **Never use inline `style="..."` attributes on an element.** They are not
  part of the compiler's contract and are ignored/rejected the same as any
  other unsupported syntax — put every declaration in a `<style>` block with
  a selector instead, even for a single one-off test element:

  ```html
  <!-- Wrong for this compiler -->
  <div style="width:200px;height:200px;background:#ff0000;"></div>

  <!-- Correct -->
  <style>
    #probe { width: 200px; height: 200px; background: #ff0000; }
  </style>
  <div id="probe"></div>
  ```

- Never reference an external stylesheet (`<link rel="stylesheet" ...>`) or
  `@import` — both are outside the contract; all CSS must be inline in the
  document's own `<style>` blocks.
- One or more `<style>` blocks are fine; the compiler joins them in document
  order before parsing, so ordering across blocks still follows normal
  cascade/source-order rules.
- Give the element under test a stable `id` and target it with `#id` (or a
  `.class`) selector rather than a bare tag selector, so the test is
  unambiguous when the scaffold has more than one element.

## Workflow

1. Write the smallest HTML/CSS that isolates the behavior under test: the
   meta tag, a sized root element, and the one thing being exercised.
2. Call `validate_html` (or `compile_html` for inspecting the compiled
   Protocol V2 output directly).
3. Read the diagnostic verbatim — `kind`/code, message, source
   `offset`/`line`/`column` — and treat it as the answer to "is this
   supported," not a guess.
4. Adjust and re-validate. Don't invent a workaround for a rejected feature;
   report the diagnostic as-is, since fail-closed behavior is intentional
   here (see `neonix-html-compiler-contract` if you need to know *why*
   something was rejected).
5. This scaffold is disposable — don't save it as a project revision unless
   the user asks to keep it.

## When not to use this skill

Anything the user will keep, share, edit, or export as a real video: use
`neonix-html-authoring` / `neonix-project-workflow` for the save workflow and
`neonix-html-compiler-contract` for the full tag/CSS contract so the
composition is right the first time.
